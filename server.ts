import dotenv from 'dotenv';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import Stripe from 'stripe';
import { createServer as createViteServer } from 'vite';
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
} from './shared/motore-ical-e-dati.ts';
import { BRAND_INFO } from './src/CONTENUTI_ALLOGGI.ts';
import { inviaEmailConfermaResend } from './src/EMAIL_CONFERMA.ts';
import type { GeoCoordinates, SuiteLocation } from './src/types.ts';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const HOST_ACCESS_CODE = process.env.HOST_ACCESS_CODE || '2026';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const stripeClient = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// ============================================================================
// DATABASE LOCALE SU FILE JSON (data/modo-stays-db.json)
// ============================================================================
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'modo-stays-db.json');

function loadLocalDb(): DatabaseState {
  try {
    if (fs.existsSync(DB_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')) as DatabaseState;
      if (parsed && Array.isArray(parsed.suites) && Array.isArray(parsed.locations)) {
        return parsed;
      }
    }
  } catch {
    // Rigenera il database se il file non esiste o è corrotto
  }
  const seed = createSeedState();
  saveLocalDb(seed);
  return seed;
}

function saveLocalDb(state: DatabaseState): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tmpPath, DB_PATH);
}

const dbState: DatabaseState = loadLocalDb();

function resolveAppBaseUrl(req: express.Request): string {
  if (process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL') {
    return process.env.APP_URL.replace(/\/+$/, '');
  }
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host') || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

async function geocodeLocationViaGoogle(
  loc: SuiteLocation
): Promise<GeoCoordinates | null> {
  if (loc.coordinates) return loc.coordinates;

  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '';
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
      const coords: GeoCoordinates = {
        lat: first.location.latitude,
        lng: first.location.longitude,
        placeId: first.placeId,
        formattedAddress: first.formattedAddress,
      };
      loc.coordinates = coords;
      saveLocalDb(dbState);
      return coords;
    }
  } catch {
    // Fallback su Places API lato client
  }

  return null;
}

function requireHostAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const provided = String(req.headers['x-host-code'] || '');
  if (!provided || provided !== HOST_ACCESS_CODE) {
    res.status(401).json({
      error: 'Accesso Host non autorizzato. Inserisci il codice proprietario.',
    });
    return;
  }
  next();
}

async function startServer(): Promise<void> {
  const app = express();
  app.set('trust proxy', 1);

  // Webhook Stripe (raw body richiesto prima di express.json)
  app.post(
    '/api/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      if (!stripeClient || !STRIPE_WEBHOOK_SECRET) {
        res.status(200).json({ received: true, mode: 'sandbox_unverified' });
        return;
      }

      const sig = req.headers['stripe-signature'];
      if (!sig || typeof sig !== 'string') {
        res.status(400).send('Missing stripe-signature');
        return;
      }

      try {
        const event = stripeClient.webhooks.constructEvent(
          req.body,
          sig,
          STRIPE_WEBHOOK_SECRET
        );
        if (event.type === 'checkout.session.completed') {
          const session = event.data.object as Stripe.Checkout.Session;
          const bookingId = session.metadata?.bookingId;
          if (bookingId) {
            const found = dbState.bookings.find((b) => b.id === bookingId);
            if (found) {
              found.paymentStatus = 'paid';
              found.stripeSessionId = session.id;
              if (!found.confirmationEmailSentAt && found.guestEmail) {
                const suite = dbState.suites.find((s) => s.id === found.suiteId);
                if (suite) {
                  const location = dbState.locations.find(
                    (l) => l.id === suite.locationId
                  );
                  const emailRes = await inviaEmailConfermaResend({
                    gmailWebhookUrl: process.env.GMAIL_WEBHOOK_URL,
                    gmailWebhookSecret: process.env.GMAIL_WEBHOOK_SECRET,
                    resendApiKey: process.env.RESEND_API_KEY,
                    fromEmail: process.env.EMAIL_FROM,
                    hostNotificationEmail: process.env.HOST_NOTIFICATION_EMAIL,
                    booking: found,
                    suite,
                    location,
                  });
                  if (emailRes.sent) {
                    found.confirmationEmailSentAt = new Date().toISOString();
                  }
                }
              }
              saveLocalDb(dbState);
            }
          }
        }
        res.json({ received: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Webhook error';
        res.status(400).send(`Webhook Error: ${message}`);
      }
    }
  );

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', brand: 'Modo Stays', timestamp: new Date().toISOString() });
  });

  app.get('/api/locations', async (_req, res) => {
    const enriched = await Promise.all(
      dbState.locations.map(async (loc) => {
        const coords = await geocodeLocationViaGoogle(loc);
        return { ...loc, coordinates: coords ?? loc.coordinates ?? null };
      })
    );
    res.json({
      locations: enriched,
      mapEmbedUrl: convertiLinkMyMaps(dbState.mapEmbedUrl ?? BRAND_INFO.mappaMyMapsUrl),
    });
  });

  app.get('/api/suites', (_req, res) => {
    res.json({ suites: dbState.suites });
  });

  app.get('/api/suites/:id', (req, res) => {
    const suite = findSuiteInState(dbState, req.params.id);
    if (!suite) {
      res.status(404).json({ error: 'Suite non trovata' });
      return;
    }
    res.json({ suite });
  });

  // Disponibilita pubblica con AUTO-SYNC INTELLIGENTE ogni 15 minuti
  app.get('/api/suites/:id/availability', async (req, res) => {
    const suite = findSuiteInState(dbState, req.params.id);
    if (!suite) {
      res.status(404).json({ error: 'Suite non trovata' });
      return;
    }

    const syncOutcome = await syncSuiteIcsIfNeeded(dbState, suite, false);
    if (syncOutcome.mutated) {
      saveLocalDb(dbState);
    }

    const blockedRanges = dbState.bookings
      .filter((b) => b.suiteId === suite.id)
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
      .map((b) => ({
        bookingId: b.id,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
      }));

    res.json({
      suiteId: suite.id,
      blockedRanges,
      autoSynced: syncOutcome.ran,
      lastAutoSyncAt: suite.lastAutoSyncAt || null,
    });
  });

  // Checkout cliente (verifica auto-sync prima di confermare le date)
  app.post('/api/bookings/checkout', async (req, res) => {
    const {
      suiteId,
      checkIn,
      checkOut,
      guestName,
      guestEmail,
      guestPhone,
      guestsCount,
      notes,
    } = req.body as {
      suiteId?: string;
      checkIn?: string;
      checkOut?: string;
      guestName?: string;
      guestEmail?: string;
      guestPhone?: string;
      guestsCount?: number;
      notes?: string;
    };

    if (!suiteId || !checkIn || !checkOut || !guestName || !guestEmail) {
      res.status(400).json({
        error: 'Compila tutti i campi richiesti (suite, date, nome ed email).',
      });
      return;
    }

    const suite = findSuiteInState(dbState, suiteId);
    if (!suite) {
      res.status(404).json({ error: 'Suite non trovata.' });
      return;
    }
    if (suite.status !== 'open') {
      res.status(400).json({
        error:
          'Questa dimora è in sviluppo. Iscriviti alla lista d’attesa per l’apertura.',
      });
      return;
    }

    // Controllo automatico feed .ics se scaduti i 15 minuti prima del pagamento
    const syncOutcome = await syncSuiteIcsIfNeeded(dbState, suite, false);
    if (syncOutcome.mutated) {
      saveLocalDb(dbState);
    }

    const nights = diffNights(checkIn, checkOut);
    if (nights < 1) {
      res.status(400).json({ error: 'Seleziona un soggiorno di almeno 1 notte.' });
      return;
    }

    if (hasDateOverlap(dbState, suite.id, checkIn, checkOut)) {
      res.status(409).json({
        error:
          'Una o più date selezionate risultano già occupate. Aggiorna il calendario e scegli un altro periodo.',
      });
      return;
    }

    const accommodationTotal = nights * suite.pricePerNight;
    const cityTaxTotal = nights * suite.cityTaxPerNight;
    const totalAmountEur = accommodationTotal + suite.cleaningFee + cityTaxTotal;

    const bookingId = `MS-${new Date().getFullYear()}-${Math.floor(
      1000 + Math.random() * 8999
    )}`;
    const appBaseUrl = resolveAppBaseUrl(req);

    const pendingBooking = {
      id: bookingId,
      suiteId: suite.id,
      channel: 'direct' as const,
      checkIn,
      checkOut,
      guestName: guestName.trim(),
      guestEmail: guestEmail.trim(),
      guestPhone: guestPhone?.trim() || '',
      guestsCount: Math.min(Math.max(Number(guestsCount) || 1, 1), suite.maxGuests),
      totalAmountEur,
      paymentStatus: 'pending' as const,
      notes: notes?.trim() || 'Prenotazione diretta dal sito Modo Stays',
      createdAt: new Date().toISOString(),
    };

    dbState.bookings.push(pendingBooking);
    saveLocalDb(dbState);

    if (stripeClient) {
      try {
        const session = await stripeClient.checkout.sessions.create({
          mode: 'payment',
          customer_email: guestEmail.trim(),
          line_items: [
            {
              price_data: {
                currency: 'eur',
                product_data: {
                  name: `${suite.name} (${nights} ${nights === 1 ? 'notte' : 'notti'})`,
                  description: `Check-in ${checkIn} · Check-out ${checkOut}`,
                },
                unit_amount: Math.round(accommodationTotal * 100),
              },
              quantity: 1,
            },
            {
              price_data: {
                currency: 'eur',
                product_data: { name: 'Pulizia finale e preparazione suite' },
                unit_amount: Math.round(suite.cleaningFee * 100),
              },
              quantity: 1,
            },
            {
              price_data: {
                currency: 'eur',
                product_data: { name: 'Tassa di soggiorno municipale' },
                unit_amount: Math.round(cityTaxTotal * 100),
              },
              quantity: 1,
            },
          ],
          metadata: { bookingId, suiteId: suite.id, checkIn, checkOut },
          success_url: `${appBaseUrl}/?bookingSuccess=${bookingId}&suite=${suite.id}`,
          cancel_url: `${appBaseUrl}/?bookingCancelled=${bookingId}&suite=${suite.id}`,
        });

        res.json({
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
        return;
      } catch (err) {
        dbState.bookings = dbState.bookings.filter((b) => b.id !== bookingId);
        saveLocalDb(dbState);
        const msg = err instanceof Error ? err.message : 'Errore Stripe';
        res.status(502).json({ error: `Errore Stripe: ${msg}` });
        return;
      }
    }

    res.json({
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
  });

  app.post('/api/bookings/confirm-sandbox', async (req, res) => {
    const { bookingId, cardLast4 } = req.body as {
      bookingId?: string;
      cardLast4?: string;
    };
    if (!bookingId) {
      res.status(400).json({ error: 'ID prenotazione mancante.' });
      return;
    }
    const found = dbState.bookings.find((b) => b.id === bookingId);
    if (!found) {
      res.status(404).json({ error: 'Prenotazione non trovata.' });
      return;
    }
    found.paymentStatus = 'paid';
    found.stripeSessionId = `cs_sandbox_${cardLast4 || '4242'}_${Date.now()}`;

    const suite = dbState.suites.find((s) => s.id === found.suiteId);
    const location = suite
      ? dbState.locations.find((l) => l.id === suite.locationId)
      : undefined;

    let emailStatus: { sent: boolean; reason?: string; recipient?: string } = {
      sent: false,
      reason: 'missing_suite',
      recipient: found.guestEmail,
    };
    if (suite) {
      emailStatus = await inviaEmailConfermaResend({
        gmailWebhookUrl: process.env.GMAIL_WEBHOOK_URL,
        gmailWebhookSecret: process.env.GMAIL_WEBHOOK_SECRET,
        resendApiKey: process.env.RESEND_API_KEY,
        fromEmail: process.env.EMAIL_FROM,
        hostNotificationEmail: process.env.HOST_NOTIFICATION_EMAIL,
        booking: found,
        suite,
        location,
      });
      if (emailStatus.sent) {
        found.confirmationEmailSentAt = new Date().toISOString();
      }
    }

    saveLocalDb(dbState);
    res.json({ booking: found, emailStatus });
  });

  app.delete('/api/bookings/pending/:id', (req, res) => {
    const before = dbState.bookings.length;
    dbState.bookings = dbState.bookings.filter(
      (b) => !(b.id === req.params.id && b.paymentStatus === 'pending')
    );
    if (dbState.bookings.length === before) {
      res.status(404).json({ error: 'Prenotazione in attesa non trovata.' });
      return;
    }
    saveLocalDb(dbState);
    res.json({ removed: true });
  });

  app.post('/api/waitlist', (req, res) => {
    const { locationId, suiteId, name, email, preferredPeriod } = req.body as {
      locationId?: string;
      suiteId?: string;
      name?: string;
      email?: string;
      preferredPeriod?: string;
    };
    if (!locationId || !name || !email || !email.includes('@')) {
      res.status(400).json({ error: 'Inserisci nome e indirizzo email validi.' });
      return;
    }
    const entry = {
      id: `WL-${Date.now().toString(36)}`,
      locationId,
      suiteId,
      name: name.trim(),
      email: email.trim(),
      preferredPeriod: preferredPeriod?.trim() || '',
      createdAt: new Date().toISOString(),
    };
    dbState.waitlist.push(entry);
    saveLocalDb(dbState);
    res.status(201).json({ entry });
  });

  // Feed .ics in uscita per Airbnb e Booking.com
  app.get('/api/ical/:suiteSlug', (req, res) => {
    const suite = findSuiteInState(dbState, req.params.suiteSlug);
    if (!suite) {
      res.status(404).type('text/plain').send('Suite not found');
      return;
    }
    const bookings = dbState.bookings.filter((b) => b.suiteId === suite.id);
    const icsPayload = generateSuiteIcsFeed(suite, bookings);
    res
      .status(200)
      .setHeader('Content-Type', 'text/calendar; charset=utf-8')
      .setHeader('Content-Disposition', `inline; filename="${suite.slug}.ics"`)
      .setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      .send(icsPayload);
  });

  app.post('/api/host/auth', (req, res) => {
    const { code } = req.body as { code?: string };
    if (String(code || '') === HOST_ACCESS_CODE) {
      res.json({ authenticated: true });
      return;
    }
    res.status(401).json({ error: 'Codice proprietario non valido.' });
  });

  // Calendario Host con Auto-Sync intelligente all'apertura
  app.get('/api/host/calendar', requireHostAuth, async (req, res) => {
    let anyMutated = false;
    for (const suite of dbState.suites) {
      const outcome = await syncSuiteIcsIfNeeded(dbState, suite, false);
      if (outcome.mutated) anyMutated = true;
    }
    if (anyMutated) saveLocalDb(dbState);

    const sortedBookings = [...dbState.bookings].sort((a, b) =>
      a.checkIn.localeCompare(b.checkIn)
    );

    res.json({
      suites: dbState.suites,
      bookings: sortedBookings,
      conflicts: detectConflicts(dbState),
      waitlist: dbState.waitlist,
      integrationStatus: {
        stripeConfigured: Boolean(stripeClient),
        stripeMode: stripeClient ? 'live_or_test_api' : 'sandbox_preview',
        appBaseUrl: resolveAppBaseUrl(req),
        autoSyncIntervalMinutes: AUTO_SYNC_INTERVAL_MINUTES,
        mapEmbedUrl: convertiLinkMyMaps(dbState.mapEmbedUrl ?? BRAND_INFO.mappaMyMapsUrl),
        emailConfigured: Boolean(
          process.env.GMAIL_WEBHOOK_URL || process.env.RESEND_API_KEY
        ),
      },
    });
  });

  app.put('/api/host/map-url', requireHostAuth, (req, res) => {
    const { mapEmbedUrl } = (req.body || {}) as { mapEmbedUrl?: string };
    const converted = convertiLinkMyMaps(mapEmbedUrl || '');
    dbState.mapEmbedUrl = converted;
    saveLocalDb(dbState);
    res.json({ mapEmbedUrl: dbState.mapEmbedUrl });
  });

  app.put('/api/host/suites/:id', requireHostAuth, (req, res) => {
    const suite = findSuiteInState(dbState, req.params.id);
    if (!suite) {
      res.status(404).json({ error: 'Suite non trovata.' });
      return;
    }
    applySuitePatch(suite, (req.body || {}) as SuiteUpdatePatch);
    saveLocalDb(dbState);
    res.json({ suite });
  });

  app.put('/api/host/suites/:id/ics-config', requireHostAuth, (req, res) => {
    const suite = findSuiteInState(dbState, req.params.id);
    if (!suite) {
      res.status(404).json({ error: 'Suite non trovata.' });
      return;
    }
    const { airbnbIcsUrl, bookingIcsUrl } = req.body as {
      airbnbIcsUrl?: string;
      bookingIcsUrl?: string;
    };
    suite.airbnbIcsUrl = (airbnbIcsUrl || '').trim();
    suite.bookingIcsUrl = (bookingIcsUrl || '').trim();
    saveLocalDb(dbState);
    res.json({ suite });
  });

  app.post('/api/host/suites/:id/sync-ics', requireHostAuth, async (req, res) => {
    const suite = findSuiteInState(dbState, req.params.id);
    if (!suite) {
      res.status(404).json({ error: 'Suite non trovata.' });
      return;
    }
    if (!suite.airbnbIcsUrl && !suite.bookingIcsUrl) {
      res.status(400).json({
        error: 'Inserisci almeno un link .ics di Airbnb o Booking.com prima di sincronizzare.',
      });
      return;
    }
    const results = await syncSuiteIcsIfNeeded(dbState, suite, true);
    saveLocalDb(dbState);
    res.json({
      results,
      bookings: [...dbState.bookings].sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
      conflicts: detectConflicts(dbState),
    });
  });

  app.post('/api/host/suites/:id/import-ics-raw', requireHostAuth, (req, res) => {
    const suite = findSuiteInState(dbState, req.params.id);
    if (!suite) {
      res.status(404).json({ error: 'Suite non trovata.' });
      return;
    }

    const { channel, rawIcs, sampleMode, sampleCheckIn, sampleCheckOut, sampleGuest } =
      req.body as {
        channel?: 'airbnb' | 'booking';
        rawIcs?: string;
        sampleMode?: boolean;
        sampleCheckIn?: string;
        sampleCheckOut?: string;
        sampleGuest?: string;
      };

    if (channel !== 'airbnb' && channel !== 'booking') {
      res.status(400).json({ error: 'Specifica il canale: airbnb o booking.' });
      return;
    }

    const icsToParse = sampleMode
      ? buildSampleExternalIcs(
          suite.name,
          channel,
          sampleCheckIn || '2026-12-18',
          sampleCheckOut || '2026-12-22',
          sampleGuest ||
            (channel === 'airbnb' ? 'Elena Rossi (Airbnb)' : 'Thomas Meyer (Booking)')
        )
      : rawIcs || '';

    if (!icsToParse.includes('BEGIN:VCALENDAR')) {
      res.status(400).json({
        error: 'Il contenuto non sembra un file iCalendar (.ics) valido.',
      });
      return;
    }

    const parsed = parseIcsFeed(icsToParse);
    const importedCount = replaceChannelBookingsInState(dbState, suite, channel, parsed);
    suite.lastAutoSyncAt = new Date().toISOString();
    saveLocalDb(dbState);

    res.json({
      importedCount,
      parsedIcsPreview: icsToParse,
      bookings: [...dbState.bookings].sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
      conflicts: detectConflicts(dbState),
    });
  });

  app.post('/api/host/blocks', requireHostAuth, (req, res) => {
    const { suiteId, checkIn, checkOut, notes } = req.body as {
      suiteId?: string;
      checkIn?: string;
      checkOut?: string;
      notes?: string;
    };
    if (!suiteId || !checkIn || !checkOut || checkOut <= checkIn) {
      res.status(400).json({ error: 'Date o suite non valide.' });
      return;
    }
    const block = {
      id: `BLK-${Date.now().toString(36).toUpperCase()}`,
      suiteId,
      channel: 'manual' as const,
      checkIn,
      checkOut,
      guestName: notes?.trim() || 'Blocco manuale proprietario',
      guestsCount: 0,
      totalAmountEur: 0,
      paymentStatus: 'blocked' as const,
      notes: notes?.trim() || 'Chiusura calendario gestita dal proprietario',
      createdAt: new Date().toISOString(),
    };
    dbState.bookings.push(block);
    saveLocalDb(dbState);
    res.status(201).json({ block, conflicts: detectConflicts(dbState) });
  });

  app.post('/api/host/bookings/:id/send-confirmation', requireHostAuth, async (req, res) => {
    const found = dbState.bookings.find((b) => b.id === req.params.id);
    if (!found) {
      res.status(404).json({ error: 'Prenotazione non trovata.' });
      return;
    }
    if (!found.guestEmail) {
      res.status(400).json({ error: 'Questa prenotazione non contiene un indirizzo email ospite.' });
      return;
    }
    const suite = dbState.suites.find((s) => s.id === found.suiteId);
    if (!suite) {
      res.status(404).json({ error: 'Suite collegata non trovata.' });
      return;
    }
    const location = dbState.locations.find((l) => l.id === suite.locationId);
    const emailStatus = await inviaEmailConfermaResend({
      gmailWebhookUrl: process.env.GMAIL_WEBHOOK_URL,
      gmailWebhookSecret: process.env.GMAIL_WEBHOOK_SECRET,
      resendApiKey: process.env.RESEND_API_KEY,
      fromEmail: process.env.EMAIL_FROM,
      hostNotificationEmail: process.env.HOST_NOTIFICATION_EMAIL,
      booking: found,
      suite,
      location,
    });
    if (emailStatus.sent) {
      found.confirmationEmailSentAt = new Date().toISOString();
      saveLocalDb(dbState);
    }
    res.json({ booking: found, emailStatus });
  });

  app.delete('/api/host/bookings/:id', requireHostAuth, (req, res) => {
    const before = dbState.bookings.length;
    dbState.bookings = dbState.bookings.filter((b) => b.id !== req.params.id);
    if (dbState.bookings.length === before) {
      res.status(404).json({ error: 'Prenotazione non trovata.' });
      return;
    }
    saveLocalDb(dbState);
    res.json({ deleted: true, conflicts: detectConflicts(dbState) });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Modo Stays server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
