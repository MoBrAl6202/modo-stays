import {
  AUTO_SYNC_INTERVAL_MINUTES,
  applySuitePatch,
  buildSampleExternalIcs,
  convertiLinkMyMaps,
  createSeedState,
  detectConflicts,
  diffNights,
  findSuiteInState,
  generateSuiteIcsFeed,
  hasDateOverlap,
  parseIcsFeed,
  replaceChannelBookingsInState,
  syncSuiteIcsIfNeeded,
  type DatabaseState,
  type SuiteUpdatePatch,
} from '../../shared/motore-ical-e-dati.ts';
import { BRAND_INFO } from '../../src/CONTENUTI_ALLOGGI.ts';
import {
  IMPOSTAZIONI_EMAIL,
  inviaEmailConfermaResend,
} from '../../src/EMAIL_CONFERMA.ts';
import type {
  BookingRecord,
  GeoCoordinates,
  SuiteLocation,
  WaitlistEntry,
} from '../../src/types.ts';

interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

interface CloudflareEnv {
  MODO_DB?: KVNamespaceLike;
  MAISON_DB?: KVNamespaceLike;
  HOST_ACCESS_CODE?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  GOOGLE_MAPS_API_KEY?: string;
  VITE_GOOGLE_MAPS_API_KEY?: string;
  APP_URL?: string;
  GMAIL_WEBHOOK_URL?: string;
  GMAIL_WEBHOOK_SECRET?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  HOST_NOTIFICATION_EMAIL?: string;
}

interface PagesEventContext {
  request: Request;
  env: CloudflareEnv;
  params: Record<string, string | string[]>;
}

const KV_STATE_KEY = 'modo_stays_state_v1';
let memoryFallbackState: DatabaseState | null = null;

function getKv(env: CloudflareEnv): KVNamespaceLike | undefined {
  return env.MODO_DB || env.MAISON_DB;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

async function loadState(env: CloudflareEnv): Promise<DatabaseState> {
  const kv = getKv(env);
  if (kv) {
    try {
      const raw = await kv.get(KV_STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DatabaseState;
        if (parsed && Array.isArray(parsed.suites) && Array.isArray(parsed.locations)) {
          return parsed;
        }
      }
    } catch {
      // Fallback sul seed iniziale
    }
    const seed = createSeedState();
    await kv.put(KV_STATE_KEY, JSON.stringify(seed));
    return seed;
  }

  if (!memoryFallbackState) {
    memoryFallbackState = createSeedState();
  }
  return memoryFallbackState;
}

async function saveState(env: CloudflareEnv, state: DatabaseState): Promise<void> {
  const kv = getKv(env);
  if (kv) {
    await kv.put(KV_STATE_KEY, JSON.stringify(state));
  } else {
    memoryFallbackState = state;
  }
}

function resolveAppBaseUrl(request: Request, env: CloudflareEnv): string {
  if (env.APP_URL && env.APP_URL !== 'MY_APP_URL') {
    return env.APP_URL.replace(/\/+$/, '');
  }
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

async function geocodeLocationViaGoogle(
  loc: SuiteLocation,
  env: CloudflareEnv
): Promise<GeoCoordinates | null> {
  if (loc.coordinates) return loc.coordinates;
  const apiKey = env.GOOGLE_MAPS_API_KEY || env.VITE_GOOGLE_MAPS_API_KEY || '';
  if (!apiKey) return null;

  try {
    const url = `https://geocode.googleapis.com/v4/geocode/address/${encodeURIComponent(
      loc.geocodeQuery
    )}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'results.placeId,results.location,results.formattedAddress',
        'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
      },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      results?: Array<{
        placeId?: string;
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
      }>;
    };
    const first = data.results?.[0];
    if (
      first?.location?.latitude !== undefined &&
      first?.location?.longitude !== undefined
    ) {
      return {
        lat: first.location.latitude,
        lng: first.location.longitude,
        placeId: first.placeId,
        formattedAddress: first.formattedAddress,
      };
    }
  } catch {
    // Fallback su Places API lato client
  }
  return null;
}

async function createStripeCheckoutSessionRest(params: {
  secretKey: string;
  customerEmail: string;
  suiteName: string;
  nights: number;
  checkIn: string;
  checkOut: string;
  accommodationTotal: number;
  cleaningFee: number;
  cityTaxTotal: number;
  bookingId: string;
  suiteId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; url: string }> {
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('customer_email', params.customerEmail);
  form.set('success_url', params.successUrl);
  form.set('cancel_url', params.cancelUrl);
  form.set('metadata[bookingId]', params.bookingId);
  form.set('metadata[suiteId]', params.suiteId);
  form.set('metadata[checkIn]', params.checkIn);
  form.set('metadata[checkOut]', params.checkOut);

  form.set('line_items[0][price_data][currency]', 'eur');
  form.set(
    'line_items[0][price_data][product_data][name]',
    `${params.suiteName} (${params.nights} ${params.nights === 1 ? 'notte' : 'notti'})`
  );
  form.set(
    'line_items[0][price_data][product_data][description]',
    `Check-in ${params.checkIn} · Check-out ${params.checkOut}`
  );
  form.set(
    'line_items[0][price_data][unit_amount]',
    String(Math.round(params.accommodationTotal * 100))
  );
  form.set('line_items[0][quantity]', '1');

  form.set('line_items[1][price_data][currency]', 'eur');
  form.set(
    'line_items[1][price_data][product_data][name]',
    'Pulizia finale e preparazione suite'
  );
  form.set(
    'line_items[1][price_data][unit_amount]',
    String(Math.round(params.cleaningFee * 100))
  );
  form.set('line_items[1][quantity]', '1');

  form.set('line_items[2][price_data][currency]', 'eur');
  form.set(
    'line_items[2][price_data][product_data][name]',
    'Tassa di soggiorno municipale'
  );
  form.set(
    'line_items[2][price_data][unit_amount]',
    String(Math.round(params.cityTaxTotal * 100))
  );
  form.set('line_items[2][quantity]', '1');

  const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  const payload = (await resp.json()) as {
    id?: string;
    url?: string;
    error?: { message?: string };
  };

  if (!resp.ok || !payload.url || !payload.id) {
    throw new Error(payload.error?.message || `Stripe HTTP ${resp.status}`);
  }
  return { id: payload.id, url: payload.url };
}

async function verifyStripeSignature(
  rawBody: string,
  sigHeader: string,
  secret: string
): Promise<boolean> {
  const parts = Object.fromEntries(
    sigHeader.split(',').map((item) => {
      const [k, v] = item.split('=');
      return [k, v];
    })
  );
  if (!parts.t || !parts.v1) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBytes = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${parts.t}.${rawBody}`)
  );
  const computedHex = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return computedHex === parts.v1;
}

function isHostAuthorized(request: Request, env: CloudflareEnv): boolean {
  const expected = env.HOST_ACCESS_CODE || '2026';
  const provided = request.headers.get('x-host-code') || '';
  return Boolean(provided) && provided === expected;
}

export async function onRequest(context: PagesEventContext): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method.toUpperCase();

  if (pathname === '/api/health' && method === 'GET') {
    return jsonResponse({
      status: 'ok',
      brand: 'Modo Stays',
      runtime: 'cloudflare-pages',
      kvConnected: Boolean(getKv(env)),
      timestamp: new Date().toISOString(),
    });
  }

  if (pathname === '/api/webhooks/stripe' && method === 'POST') {
    const rawBody = await request.text();
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
      return jsonResponse({ received: true, mode: 'sandbox_unverified' });
    }
    const sig = request.headers.get('stripe-signature') || '';
    const valid = await verifyStripeSignature(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
    if (!valid) {
      return new Response('Invalid signature', { status: 400 });
    }
    const event = JSON.parse(rawBody) as {
      type?: string;
      data?: { object?: { id?: string; metadata?: { bookingId?: string } } };
    };
    if (event.type === 'checkout.session.completed') {
      const bookingId = event.data?.object?.metadata?.bookingId;
      if (bookingId) {
        const state = await loadState(env);
        const found = state.bookings.find((b) => b.id === bookingId);
        if (found) {
          found.paymentStatus = 'paid';
          found.stripeSessionId = event.data?.object?.id;
          if (!found.confirmationEmailSentAt && found.guestEmail) {
            const suite = state.suites.find((s) => s.id === found.suiteId);
            if (suite) {
              const location = state.locations.find((l) => l.id === suite.locationId);
              const emailRes = await inviaEmailConfermaResend({
                gmailWebhookUrl: env.GMAIL_WEBHOOK_URL,
                gmailWebhookSecret: env.GMAIL_WEBHOOK_SECRET,
                resendApiKey: env.RESEND_API_KEY,
                fromEmail: env.EMAIL_FROM,
                hostNotificationEmail: env.HOST_NOTIFICATION_EMAIL,
                booking: found,
                suite,
                location,
              });
              if (emailRes.sent) {
                found.confirmationEmailSentAt = new Date().toISOString();
              }
            }
          }
          await saveState(env, state);
        }
      }
    }
    return jsonResponse({ received: true });
  }

  if (pathname === '/api/locations' && method === 'GET') {
    const state = await loadState(env);
    let mutated = false;
    const enriched = await Promise.all(
      state.locations.map(async (loc) => {
        if (loc.coordinates) return loc;
        const coords = await geocodeLocationViaGoogle(loc, env);
        if (coords) {
          loc.coordinates = coords;
          mutated = true;
        }
        return { ...loc, coordinates: coords ?? null };
      })
    );
    if (mutated) await saveState(env, state);
    return jsonResponse({
      locations: enriched,
      mapEmbedUrl: convertiLinkMyMaps(state.mapEmbedUrl ?? BRAND_INFO.mappaMyMapsUrl),
    });
  }

  if (pathname === '/api/suites' && method === 'GET') {
    const state = await loadState(env);
    return jsonResponse({ suites: state.suites });
  }

  // Disponibilita pubblica con AUTO-SYNC INTELLIGENTE ogni 15 minuti
  const availMatch = pathname.match(/^\/api\/suites\/([^/]+)\/availability$/);
  if (availMatch && method === 'GET') {
    const state = await loadState(env);
    const suite = findSuiteInState(state, decodeURIComponent(availMatch[1]));
    if (!suite) return jsonResponse({ error: 'Suite non trovata' }, 404);

    const syncOutcome = await syncSuiteIcsIfNeeded(state, suite, false);
    if (syncOutcome.mutated) {
      await saveState(env, state);
    }

    const blockedRanges = state.bookings
      .filter((b) => b.suiteId === suite.id)
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
      .map((b) => ({
        bookingId: b.id,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
      }));
    return jsonResponse({
      suiteId: suite.id,
      blockedRanges,
      autoSynced: syncOutcome.ran,
      lastAutoSyncAt: suite.lastAutoSyncAt || null,
    });
  }

  const suiteMatch = pathname.match(/^\/api\/suites\/([^/]+)$/);
  if (suiteMatch && method === 'GET') {
    const state = await loadState(env);
    const suite = findSuiteInState(state, decodeURIComponent(suiteMatch[1]));
    if (!suite) return jsonResponse({ error: 'Suite non trovata' }, 404);
    return jsonResponse({ suite });
  }

  if (pathname === '/api/bookings/checkout' && method === 'POST') {
    const body = (await request.json()) as {
      suiteId?: string;
      checkIn?: string;
      checkOut?: string;
      guestName?: string;
      guestEmail?: string;
      guestPhone?: string;
      guestsCount?: number;
      notes?: string;
    };

    if (!body.suiteId || !body.checkIn || !body.checkOut || !body.guestName || !body.guestEmail) {
      return jsonResponse({ error: 'Compila tutti i campi richiesti.' }, 400);
    }

    const state = await loadState(env);
    const suite = findSuiteInState(state, body.suiteId);
    if (!suite) return jsonResponse({ error: 'Suite non trovata.' }, 404);
    if (suite.status !== 'open') {
      return jsonResponse({ error: 'Suite attualmente in fase di sviluppo.' }, 400);
    }

    const syncOutcome = await syncSuiteIcsIfNeeded(state, suite, false);
    if (syncOutcome.mutated) {
      await saveState(env, state);
    }

    const nights = diffNights(body.checkIn, body.checkOut);
    if (nights < 1) {
      return jsonResponse({ error: 'Seleziona almeno 1 notte.' }, 400);
    }
    if (hasDateOverlap(state, suite.id, body.checkIn, body.checkOut)) {
      return jsonResponse(
        { error: 'Una o più date selezionate risultano già occupate.' },
        409
      );
    }

    const accommodationTotal = nights * suite.pricePerNight;
    const cityTaxTotal = nights * suite.cityTaxPerNight;
    const totalAmountEur = accommodationTotal + suite.cleaningFee + cityTaxTotal;
    const bookingId = `MS-${new Date().getFullYear()}-${Math.floor(
      1000 + Math.random() * 8999
    )}`;

    const pendingBooking: BookingRecord = {
      id: bookingId,
      suiteId: suite.id,
      channel: 'direct',
      checkIn: body.checkIn,
      checkOut: body.checkOut,
      guestName: body.guestName.trim(),
      guestEmail: body.guestEmail.trim(),
      guestPhone: body.guestPhone?.trim() || '',
      guestsCount: Math.min(Math.max(Number(body.guestsCount) || 1, 1), suite.maxGuests),
      totalAmountEur,
      paymentStatus: 'pending',
      notes: body.notes?.trim() || 'Prenotazione diretta dal sito Modo Stays',
      createdAt: new Date().toISOString(),
    };

    state.bookings.push(pendingBooking);
    await saveState(env, state);

    if (env.STRIPE_SECRET_KEY) {
      try {
        const baseUrl = resolveAppBaseUrl(request, env);
        const session = await createStripeCheckoutSessionRest({
          secretKey: env.STRIPE_SECRET_KEY,
          customerEmail: body.guestEmail.trim(),
          suiteName: suite.name,
          nights,
          checkIn: body.checkIn,
          checkOut: body.checkOut,
          accommodationTotal,
          cleaningFee: suite.cleaningFee,
          cityTaxTotal,
          bookingId,
          suiteId: suite.id,
          successUrl: `${baseUrl}/?bookingSuccess=${bookingId}&suite=${suite.id}`,
          cancelUrl: `${baseUrl}/?bookingCancelled=${bookingId}&suite=${suite.id}`,
        });
        return jsonResponse({
          mode: 'stripe_live',
          checkoutUrl: session.url,
          booking: pendingBooking,
          breakdown: {
            nights,
            accommodationTotal,
            cleaningFee: suite.cleaningFee,
            cityTaxTotal,
            totalAmountEur,
          },
        });
      } catch (err) {
        state.bookings = state.bookings.filter((b) => b.id !== bookingId);
        await saveState(env, state);
        const msg = err instanceof Error ? err.message : 'Errore Stripe';
        return jsonResponse({ error: `Errore Stripe: ${msg}` }, 502);
      }
    }

    return jsonResponse({
      mode: 'stripe_sandbox',
      booking: pendingBooking,
      breakdown: {
        nights,
        accommodationTotal,
        cleaningFee: suite.cleaningFee,
        cityTaxTotal,
        totalAmountEur,
      },
    });
  }

  if (pathname === '/api/bookings/confirm-sandbox' && method === 'POST') {
    const body = (await request.json()) as { bookingId?: string; cardLast4?: string };
    if (!body.bookingId) return jsonResponse({ error: 'ID prenotazione mancante.' }, 400);
    const state = await loadState(env);
    const found = state.bookings.find((b) => b.id === body.bookingId);
    if (!found) return jsonResponse({ error: 'Prenotazione non trovata.' }, 404);
    found.paymentStatus = 'paid';
    found.stripeSessionId = `cs_sandbox_${body.cardLast4 || '4242'}_${Date.now()}`;

    const suite = state.suites.find((s) => s.id === found.suiteId);
    const location = suite
      ? state.locations.find((l) => l.id === suite.locationId)
      : undefined;

    let emailStatus: { sent: boolean; reason?: string; recipient?: string } = {
      sent: false,
      reason: 'missing_suite',
      recipient: found.guestEmail,
    };
    if (suite) {
      emailStatus = await inviaEmailConfermaResend({
        gmailWebhookUrl: env.GMAIL_WEBHOOK_URL,
        gmailWebhookSecret: env.GMAIL_WEBHOOK_SECRET,
        resendApiKey: env.RESEND_API_KEY,
        fromEmail: env.EMAIL_FROM,
        hostNotificationEmail: env.HOST_NOTIFICATION_EMAIL,
        booking: found,
        suite,
        location,
      });
      if (emailStatus.sent) {
        found.confirmationEmailSentAt = new Date().toISOString();
      }
    }

    await saveState(env, state);
    return jsonResponse({ booking: found, emailStatus });
  }

  const pendingMatch = pathname.match(/^\/api\/bookings\/pending\/([^/]+)$/);
  if (pendingMatch && method === 'DELETE') {
    const state = await loadState(env);
    const id = decodeURIComponent(pendingMatch[1]);
    const before = state.bookings.length;
    state.bookings = state.bookings.filter(
      (b) => !(b.id === id && b.paymentStatus === 'pending')
    );
    if (state.bookings.length === before) {
      return jsonResponse({ error: 'Prenotazione in attesa non trovata.' }, 404);
    }
    await saveState(env, state);
    return jsonResponse({ removed: true });
  }

  if (pathname === '/api/waitlist' && method === 'POST') {
    const body = (await request.json()) as {
      locationId?: string;
      suiteId?: string;
      name?: string;
      email?: string;
      preferredPeriod?: string;
    };
    if (!body.locationId || !body.name || !body.email || !body.email.includes('@')) {
      return jsonResponse({ error: 'Inserisci nome e email validi.' }, 400);
    }
    const state = await loadState(env);
    const entry: WaitlistEntry = {
      id: `WL-${Date.now().toString(36)}`,
      locationId: body.locationId,
      suiteId: body.suiteId,
      name: body.name.trim(),
      email: body.email.trim(),
      preferredPeriod: body.preferredPeriod?.trim() || '',
      createdAt: new Date().toISOString(),
    };
    state.waitlist.push(entry);
    await saveState(env, state);
    return jsonResponse({ entry }, 201);
  }

  const icalMatch = pathname.match(/^\/api\/ical\/([^/]+)$/);
  if (icalMatch && method === 'GET') {
    const state = await loadState(env);
    const suite = findSuiteInState(state, decodeURIComponent(icalMatch[1]));
    if (!suite) {
      return new Response('Suite not found', { status: 404 });
    }
    const bookings = state.bookings.filter((b) => b.suiteId === suite.id);
    const icsPayload = generateSuiteIcsFeed(suite, bookings);
    return new Response(icsPayload, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `inline; filename="${suite.slug}.ics"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }

  if (pathname === '/api/host/auth' && method === 'POST') {
    const body = (await request.json()) as { code?: string };
    const expected = env.HOST_ACCESS_CODE || '2026';
    if (String(body.code || '') === expected) {
      return jsonResponse({ authenticated: true });
    }
    return jsonResponse({ error: 'Codice proprietario non valido.' }, 401);
  }

  if (pathname.startsWith('/api/host/')) {
    if (!isHostAuthorized(request, env)) {
      return jsonResponse({ error: 'Accesso Host non autorizzato.' }, 401);
    }

    if (pathname === '/api/host/calendar' && method === 'GET') {
      const state = await loadState(env);
      let anyMutated = false;
      for (const suite of state.suites) {
        const outcome = await syncSuiteIcsIfNeeded(state, suite, false);
        if (outcome.mutated) anyMutated = true;
      }
      if (anyMutated) await saveState(env, state);

      const sortedBookings = [...state.bookings].sort((a, b) =>
        a.checkIn.localeCompare(b.checkIn)
      );
      return jsonResponse({
        suites: state.suites,
        bookings: sortedBookings,
        conflicts: detectConflicts(state),
        waitlist: state.waitlist,
        integrationStatus: {
          stripeConfigured: Boolean(env.STRIPE_SECRET_KEY),
          stripeMode: env.STRIPE_SECRET_KEY ? 'live_or_test_api' : 'sandbox_preview',
          appBaseUrl: resolveAppBaseUrl(request, env),
          autoSyncIntervalMinutes: AUTO_SYNC_INTERVAL_MINUTES,
          mapEmbedUrl: convertiLinkMyMaps(state.mapEmbedUrl ?? BRAND_INFO.mappaMyMapsUrl),
          emailConfigured: Boolean(env.GMAIL_WEBHOOK_URL || env.RESEND_API_KEY),
          emailProvider: env.GMAIL_WEBHOOK_URL
            ? 'gmail_webhook'
            : env.RESEND_API_KEY
            ? 'resend'
            : 'none',
          hostNotificationConfigured: Boolean(
            (
              env.HOST_NOTIFICATION_EMAIL ||
              IMPOSTAZIONI_EMAIL.emailNotificaHost ||
              ''
            ).trim()
          ),
        },
      });
    }

    if (pathname === '/api/host/map-url' && method === 'PUT') {
      const state = await loadState(env);
      const body = (await request.json()) as { mapEmbedUrl?: string };
      state.mapEmbedUrl = convertiLinkMyMaps(body.mapEmbedUrl || '');
      await saveState(env, state);
      return jsonResponse({ mapEmbedUrl: state.mapEmbedUrl });
    }

    const hostSuiteEditMatch = pathname.match(/^\/api\/host\/suites\/([^/]+)$/);
    if (hostSuiteEditMatch && method === 'PUT') {
      const state = await loadState(env);
      const suite = findSuiteInState(state, decodeURIComponent(hostSuiteEditMatch[1]));
      if (!suite) return jsonResponse({ error: 'Suite non trovata.' }, 404);
      const patch = (await request.json()) as SuiteUpdatePatch;
      applySuitePatch(suite, patch || {});
      await saveState(env, state);
      return jsonResponse({ suite });
    }

    const icsConfigMatch = pathname.match(/^\/api\/host\/suites\/([^/]+)\/ics-config$/);
    if (icsConfigMatch && method === 'PUT') {
      const state = await loadState(env);
      const suite = findSuiteInState(state, decodeURIComponent(icsConfigMatch[1]));
      if (!suite) return jsonResponse({ error: 'Suite non trovata.' }, 404);
      const body = (await request.json()) as {
        airbnbIcsUrl?: string;
        bookingIcsUrl?: string;
      };
      suite.airbnbIcsUrl = (body.airbnbIcsUrl || '').trim();
      suite.bookingIcsUrl = (body.bookingIcsUrl || '').trim();
      await saveState(env, state);
      return jsonResponse({ suite });
    }

    const syncMatch = pathname.match(/^\/api\/host\/suites\/([^/]+)\/sync-ics$/);
    if (syncMatch && method === 'POST') {
      const state = await loadState(env);
      const suite = findSuiteInState(state, decodeURIComponent(syncMatch[1]));
      if (!suite) return jsonResponse({ error: 'Suite non trovata.' }, 404);
      if (!suite.airbnbIcsUrl && !suite.bookingIcsUrl) {
        return jsonResponse(
          { error: 'Inserisci almeno un link .ics prima di sincronizzare.' },
          400
        );
      }

      const results = await syncSuiteIcsIfNeeded(state, suite, true);
      await saveState(env, state);
      return jsonResponse({
        results,
        bookings: [...state.bookings].sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
        conflicts: detectConflicts(state),
      });
    }

    const rawImportMatch = pathname.match(/^\/api\/host\/suites\/([^/]+)\/import-ics-raw$/);
    if (rawImportMatch && method === 'POST') {
      const state = await loadState(env);
      const suite = findSuiteInState(state, decodeURIComponent(rawImportMatch[1]));
      if (!suite) return jsonResponse({ error: 'Suite non trovata.' }, 404);

      const body = (await request.json()) as {
        channel?: 'airbnb' | 'booking';
        rawIcs?: string;
        sampleMode?: boolean;
        sampleCheckIn?: string;
        sampleCheckOut?: string;
        sampleGuest?: string;
      };

      if (body.channel !== 'airbnb' && body.channel !== 'booking') {
        return jsonResponse({ error: 'Specifica airbnb o booking.' }, 400);
      }

      const icsToParse = body.sampleMode
        ? buildSampleExternalIcs(
            suite.name,
            body.channel,
            body.sampleCheckIn || '2026-12-18',
            body.sampleCheckOut || '2026-12-22',
            body.sampleGuest || 'Ospite Test'
          )
        : body.rawIcs || '';

      if (!icsToParse.includes('BEGIN:VCALENDAR')) {
        return jsonResponse({ error: 'Contenuto .ics non valido.' }, 400);
      }

      const parsed = parseIcsFeed(icsToParse);
      const importedCount = replaceChannelBookingsInState(
        state,
        suite,
        body.channel,
        parsed
      );
      suite.lastAutoSyncAt = new Date().toISOString();

      await saveState(env, state);
      return jsonResponse({
        importedCount,
        parsedIcsPreview: icsToParse,
        bookings: [...state.bookings].sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
        conflicts: detectConflicts(state),
      });
    }

    if (pathname === '/api/host/blocks' && method === 'POST') {
      const body = (await request.json()) as {
        suiteId?: string;
        checkIn?: string;
        checkOut?: string;
        notes?: string;
      };
      if (!body.suiteId || !body.checkIn || !body.checkOut || body.checkOut <= body.checkIn) {
        return jsonResponse({ error: 'Date o suite non valide.' }, 400);
      }
      const state = await loadState(env);
      const block: BookingRecord = {
        id: `BLK-${Date.now().toString(36).toUpperCase()}`,
        suiteId: body.suiteId,
        channel: 'manual',
        checkIn: body.checkIn,
        checkOut: body.checkOut,
        guestName: body.notes?.trim() || 'Blocco manuale proprietario',
        guestsCount: 0,
        totalAmountEur: 0,
        paymentStatus: 'blocked',
        notes: body.notes?.trim() || 'Chiusura calendario gestita dal proprietario',
        createdAt: new Date().toISOString(),
      };
      state.bookings.push(block);
      await saveState(env, state);
      return jsonResponse({ block, conflicts: detectConflicts(state) }, 201);
    }

    const sendEmailMatch = pathname.match(
      /^\/api\/host\/bookings\/([^/]+)\/send-confirmation$/
    );
    if (sendEmailMatch && method === 'POST') {
      const id = decodeURIComponent(sendEmailMatch[1]);
      const state = await loadState(env);
      const found = state.bookings.find((b) => b.id === id);
      if (!found) return jsonResponse({ error: 'Prenotazione non trovata.' }, 404);
      if (!found.guestEmail) {
        return jsonResponse(
          { error: 'Questa prenotazione non contiene un indirizzo email ospite.' },
          400
        );
      }
      const suite = state.suites.find((s) => s.id === found.suiteId);
      if (!suite) return jsonResponse({ error: 'Suite collegata non trovata.' }, 404);
      const location = state.locations.find((l) => l.id === suite.locationId);
      const emailStatus = await inviaEmailConfermaResend({
        gmailWebhookUrl: env.GMAIL_WEBHOOK_URL,
        gmailWebhookSecret: env.GMAIL_WEBHOOK_SECRET,
        resendApiKey: env.RESEND_API_KEY,
        fromEmail: env.EMAIL_FROM,
        hostNotificationEmail: env.HOST_NOTIFICATION_EMAIL,
        booking: found,
        suite,
        location,
      });
      if (emailStatus.sent) {
        found.confirmationEmailSentAt = new Date().toISOString();
        await saveState(env, state);
      }
      return jsonResponse({ booking: found, emailStatus });
    }

    if (pathname === '/api/host/test-email' && method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as {
        testEmail?: string;
      };
      const targetEmail = (
        body.testEmail ||
        env.HOST_NOTIFICATION_EMAIL ||
        IMPOSTAZIONI_EMAIL.emailNotificaHost ||
        ''
      ).trim();

      if (!targetEmail || !targetEmail.includes('@')) {
        return jsonResponse(
          { error: 'Inserisci un indirizzo email valido su cui fare il test.' },
          400
        );
      }

      const state = await loadState(env);
      const suite = state.suites.find((s) => s.status === 'open') || state.suites[0];
      if (!suite) {
        return jsonResponse({ error: 'Nessuna suite disponibile per il test.' }, 404);
      }
      const location = state.locations.find((l) => l.id === suite.locationId);

      const testBooking: BookingRecord = {
        id: `TEST-${new Date().getFullYear()}`,
        suiteId: suite.id,
        channel: 'direct',
        checkIn: '2027-05-10',
        checkOut: '2027-05-13',
        guestName: 'Ospite Test Modo Stays',
        guestEmail: targetEmail,
        guestPhone: '+39 000 000 0000',
        guestsCount: 2,
        totalAmountEur:
          suite.pricePerNight * 3 + suite.cleaningFee + suite.cityTaxPerNight * 3,
        paymentStatus: 'paid',
        stripeSessionId: 'cs_sandbox_test',
        notes: 'Email diagnostica inviata dall’Area Host',
        createdAt: new Date().toISOString(),
      };

      const emailStatus = await inviaEmailConfermaResend({
        gmailWebhookUrl: env.GMAIL_WEBHOOK_URL,
        gmailWebhookSecret: env.GMAIL_WEBHOOK_SECRET,
        resendApiKey: env.RESEND_API_KEY,
        fromEmail: env.EMAIL_FROM,
        hostNotificationEmail: env.HOST_NOTIFICATION_EMAIL,
        booking: testBooking,
        suite,
        location,
      });

      const emailProvider = env.GMAIL_WEBHOOK_URL
        ? 'gmail_webhook'
        : env.RESEND_API_KEY
        ? 'resend'
        : 'none';

      return jsonResponse({
        emailProvider,
        hostNotificationConfigured: Boolean(
          (
            env.HOST_NOTIFICATION_EMAIL ||
            IMPOSTAZIONI_EMAIL.emailNotificaHost ||
            ''
          ).trim()
        ),
        emailStatus,
      });
    }

    const deleteBookingMatch = pathname.match(/^\/api\/host\/bookings\/([^/]+)$/);
    if (deleteBookingMatch && method === 'DELETE') {
      const id = decodeURIComponent(deleteBookingMatch[1]);
      const state = await loadState(env);
      const before = state.bookings.length;
      state.bookings = state.bookings.filter((b) => b.id !== id);
      if (state.bookings.length === before) {
        return jsonResponse({ error: 'Prenotazione non trovata.' }, 404);
      }
      await saveState(env, state);
      return jsonResponse({ deleted: true, conflicts: detectConflicts(state) });
    }
  }

  return jsonResponse({ error: 'Endpoint non trovato.' }, 404);
}
