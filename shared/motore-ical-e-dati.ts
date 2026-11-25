import {
  ALLOGGI_INIZIALI,
  DESTINAZIONI_INIZIALI,
} from '../src/CONTENUTI_ALLOGGI.ts';
import type {
  BookingConflict,
  BookingRecord,
  Suite,
  SuiteLocation,
  WaitlistEntry,
} from '../src/types.ts';

export const AUTO_SYNC_INTERVAL_MINUTES = 15;
const AUTO_SYNC_INTERVAL_MS = AUTO_SYNC_INTERVAL_MINUTES * 60 * 1000;

export interface DatabaseState {
  locations: SuiteLocation[];
  suites: Suite[];
  bookings: BookingRecord[];
  waitlist: WaitlistEntry[];
}

export interface SuiteUpdatePatch {
  name?: string;
  subtitle?: string;
  status?: 'open' | 'development';
  openingDateLabel?: string;
  pricePerNight?: number;
  cleaningFee?: number;
  cityTaxPerNight?: number;
  maxGuests?: number;
  sizeSqm?: number;
  bedrooms?: number;
  bathrooms?: number;
  floor?: string;
  description?: string;
  designNotes?: string;
  amenities?: string[];
  houseRules?: string[];
}

export function createSeedState(): DatabaseState {
  return {
    locations: structuredClone(DESTINAZIONI_INIZIALI),
    suites: structuredClone(ALLOGGI_INIZIALI),
    bookings: [
      {
        id: 'MS-2026-101',
        suiteId: 'carlone-lumiere',
        channel: 'airbnb',
        checkIn: '2026-11-18',
        checkOut: '2026-11-22',
        guestName: 'Claire Moreau',
        guestsCount: 2,
        totalAmountEur: 0,
        paymentStatus: 'external',
        externalUid: 'airbnb-hm882910@airbnb.com',
        notes: 'Importata dal feed .ics Airbnb (Reserved)',
        createdAt: '2026-11-10T09:15:00.000Z',
      },
      {
        id: 'MS-2026-102',
        suiteId: 'carlone-lumiere',
        channel: 'booking',
        checkIn: '2026-11-26',
        checkOut: '2026-11-29',
        guestName: 'Lukas Weber',
        guestsCount: 2,
        totalAmountEur: 0,
        paymentStatus: 'external',
        externalUid: 'booking-449102883@booking.com',
        notes: 'Importata dal feed .ics Booking.com',
        createdAt: '2026-11-11T14:30:00.000Z',
      },
      {
        id: 'MS-2026-103',
        suiteId: 'carlone-lumiere',
        channel: 'direct',
        checkIn: '2026-12-04',
        checkOut: '2026-12-08',
        guestName: 'Giulia Ferretti',
        guestEmail: 'giulia.ferretti@example.it',
        guestPhone: '+39 347 555 0192',
        guestsCount: 2,
        totalAmountEur: 1041,
        paymentStatus: 'paid',
        stripeSessionId: 'cs_test_modo_stays_demo_103',
        notes: 'Prenotazione diretta dal sito con pagamento carta Stripe',
        createdAt: '2026-11-12T17:05:00.000Z',
      },
      {
        id: 'MS-2026-104',
        suiteId: 'promenade-terrazza',
        channel: 'booking',
        checkIn: '2026-11-20',
        checkOut: '2026-11-24',
        guestName: 'Sophie Laurent',
        guestsCount: 3,
        totalAmountEur: 0,
        paymentStatus: 'external',
        externalUid: 'booking-992011221@booking.com',
        notes: 'Importata dal feed .ics Booking.com',
        createdAt: '2026-11-09T11:20:00.000Z',
      },
      {
        id: 'MS-2026-105',
        suiteId: 'promenade-terrazza',
        channel: 'direct',
        checkIn: '2026-12-11',
        checkOut: '2026-12-14',
        guestName: 'Marco Bellini',
        guestEmail: 'm.bellini@example.it',
        guestsCount: 2,
        totalAmountEur: 1022,
        paymentStatus: 'paid',
        stripeSessionId: 'cs_test_modo_stays_demo_105',
        notes: 'Prenotazione diretta dal sito',
        createdAt: '2026-11-13T08:40:00.000Z',
      },
    ],
    waitlist: [],
  };
}

export function findSuiteInState(
  state: DatabaseState,
  idOrSlug: string
): Suite | undefined {
  const clean = idOrSlug.replace(/\.ics$/i, '');
  return state.suites.find((s) => s.id === clean || s.slug === clean);
}

export function applySuitePatch(suite: Suite, patch: SuiteUpdatePatch): Suite {
  if (typeof patch.name === 'string' && patch.name.trim()) {
    suite.name = patch.name.trim();
  }
  if (typeof patch.subtitle === 'string') {
    suite.subtitle = patch.subtitle.trim();
  }
  if (patch.status === 'open' || patch.status === 'development') {
    suite.status = patch.status;
  }
  if (typeof patch.openingDateLabel === 'string') {
    suite.openingDateLabel = patch.openingDateLabel.trim();
  }
  if (typeof patch.pricePerNight === 'number' && patch.pricePerNight >= 0) {
    suite.pricePerNight = Math.round(patch.pricePerNight);
  }
  if (typeof patch.cleaningFee === 'number' && patch.cleaningFee >= 0) {
    suite.cleaningFee = Math.round(patch.cleaningFee);
  }
  if (typeof patch.cityTaxPerNight === 'number' && patch.cityTaxPerNight >= 0) {
    suite.cityTaxPerNight = Math.round(patch.cityTaxPerNight);
  }
  if (typeof patch.maxGuests === 'number' && patch.maxGuests >= 1) {
    suite.maxGuests = Math.round(patch.maxGuests);
  }
  if (typeof patch.sizeSqm === 'number' && patch.sizeSqm >= 1) {
    suite.sizeSqm = Math.round(patch.sizeSqm);
  }
  if (typeof patch.bedrooms === 'number' && patch.bedrooms >= 0) {
    suite.bedrooms = Math.round(patch.bedrooms);
  }
  if (typeof patch.bathrooms === 'number' && patch.bathrooms >= 1) {
    suite.bathrooms = Math.round(patch.bathrooms);
  }
  if (typeof patch.floor === 'string') {
    suite.floor = patch.floor.trim();
  }
  if (typeof patch.description === 'string') {
    suite.description = patch.description.trim();
  }
  if (typeof patch.designNotes === 'string') {
    suite.designNotes = patch.designNotes.trim();
  }
  if (Array.isArray(patch.amenities)) {
    suite.amenities = patch.amenities.map((s) => s.trim()).filter(Boolean);
  }
  if (Array.isArray(patch.houseRules)) {
    suite.houseRules = patch.houseRules.map((s) => s.trim()).filter(Boolean);
  }
  return suite;
}

export function hasDateOverlap(
  state: DatabaseState,
  suiteId: string,
  checkIn: string,
  checkOut: string
): boolean {
  return state.bookings.some(
    (b) => b.suiteId === suiteId && b.checkIn < checkOut && b.checkOut > checkIn
  );
}

export function detectConflicts(state: DatabaseState): BookingConflict[] {
  const conflicts: BookingConflict[] = [];
  for (const suite of state.suites) {
    const list = state.bookings
      .filter((b) => b.suiteId === suite.id)
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        if (a.checkIn < b.checkOut && a.checkOut > b.checkIn) {
          conflicts.push({
            suiteId: suite.id,
            bookingA: a,
            bookingB: b,
            overlapStart: a.checkIn > b.checkIn ? a.checkIn : b.checkIn,
            overlapEnd: a.checkOut < b.checkOut ? a.checkOut : b.checkOut,
          });
        }
      }
    }
  }
  return conflicts;
}

export function diffNights(checkIn: string, checkOut: string): number {
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

// ============================================================================
// MOTORE ICALENDER (.ics) RFC 5545 + AUTO-SYNC INTELLIGENTE
// ============================================================================

export interface ParsedIcsEvent {
  uid: string;
  summary: string;
  description: string;
  checkIn: string;
  checkOut: string;
}

function unfoldIcsLines(raw: string): string[] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = normalized.split('\n');
  const unfolded: string[] = [];

  for (const line of rawLines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }
  return unfolded;
}

function parseIcsDateValue(rawValue: string): string | null {
  const match = rawValue.trim().match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${year}-${month}-${day}`;
}

function addOneDay(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}

function unescapeIcsText(val: string): string {
  return val
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

export function parseIcsFeed(rawIcs: string): ParsedIcsEvent[] {
  const lines = unfoldIcsLines(rawIcs);
  const events: ParsedIcsEvent[] = [];

  let inEvent = false;
  let uid = '';
  let summary = '';
  let description = '';
  let dtStart = '';
  let dtEnd = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      uid = '';
      summary = '';
      description = '';
      dtStart = '';
      dtEnd = '';
      continue;
    }

    if (trimmed === 'END:VEVENT') {
      if (inEvent && dtStart) {
        const resolvedEnd = dtEnd && dtEnd > dtStart ? dtEnd : addOneDay(dtStart);
        events.push({
          uid: uid || `${dtStart}_${resolvedEnd}_${events.length}`,
          summary: summary || 'Prenotazione esterna',
          description,
          checkIn: dtStart,
          checkOut: resolvedEnd,
        });
      }
      inEvent = false;
      continue;
    }

    if (!inEvent) continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const propPart = line.slice(0, colonIndex).toUpperCase();
    const valuePart = line.slice(colonIndex + 1);
    const propName = propPart.split(';')[0];

    if (propName === 'UID') uid = valuePart.trim();
    else if (propName === 'SUMMARY') summary = unescapeIcsText(valuePart);
    else if (propName === 'DESCRIPTION') description = unescapeIcsText(valuePart);
    else if (propName === 'DTSTART') {
      const parsed = parseIcsDateValue(valuePart);
      if (parsed) dtStart = parsed;
    } else if (propName === 'DTEND') {
      const parsed = parseIcsDateValue(valuePart);
      if (parsed) dtEnd = parsed;
    }
  }

  return events;
}

function toIcsCompactDate(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

function toIcsTimestamp(isoTimestamp: string): string {
  const dt = new Date(isoTimestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T` +
    `${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}${pad(dt.getUTCSeconds())}Z`
  );
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function generateSuiteIcsFeed(suite: Suite, bookings: BookingRecord[]): string {
  const exportable = bookings.filter(
    (b) =>
      b.suiteId === suite.id &&
      (b.channel === 'direct' || b.channel === 'manual') &&
      b.paymentStatus !== 'pending'
  );

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Modo Stays//Channel Sync//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(`Modo Stays - ${suite.name}`)}`,
    'X-WR-TIMEZONE:Europe/Rome',
  ];

  const nowStamp = toIcsTimestamp(new Date().toISOString());

  for (const booking of exportable) {
    const summaryLabel =
      booking.channel === 'manual'
        ? 'Modo Stays - Non disponibile (Blocco Host)'
        : `Modo Stays - Riservato (${booking.id})`;

    const descriptionText =
      booking.channel === 'manual'
        ? 'Blocco calendario inserito dal proprietario su Modo Stays.'
        : `Prenotazione diretta confermata su Modo Stays (${booking.checkIn} -> ${booking.checkOut}).`;

    lines.push(
      'BEGIN:VEVENT',
      `UID:${booking.id}@modostays.com`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART;VALUE=DATE:${toIcsCompactDate(booking.checkIn)}`,
      `DTEND;VALUE=DATE:${toIcsCompactDate(booking.checkOut)}`,
      `SUMMARY:${escapeIcsText(summaryLabel)}`,
      `DESCRIPTION:${escapeIcsText(descriptionText)}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR', '');
  return lines.join('\r\n');
}

export function buildSampleExternalIcs(
  suiteName: string,
  channel: 'airbnb' | 'booking',
  checkIn: string,
  checkOut: string,
  guestHint: string
): string {
  const summary =
    channel === 'airbnb'
      ? `Reserved - ${guestHint}`
      : `CLOSED - Booking.com (${guestHint})`;
  const description =
    channel === 'airbnb'
      ? `Reservation URL: https://www.airbnb.com/hosting/reservations/details/HM${Math.floor(100000 + Math.random() * 899999)}\\nProperty: ${suiteName}`
      : `Booking.com Reservation ID: ${Math.floor(100000000 + Math.random() * 899999999)} - ${suiteName}`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${channel === 'airbnb' ? 'Airbnb Inc' : 'Booking.com'}//Calendar Sync//EN`,
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${channel}-${Date.now()}-${checkIn}@external.sync`,
    `DTSTAMP:${toIcsTimestamp(new Date().toISOString())}`,
    `DTSTART;VALUE=DATE:${toIcsCompactDate(checkIn)}`,
    `DTEND;VALUE=DATE:${toIcsCompactDate(checkOut)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function replaceChannelBookingsInState(
  state: DatabaseState,
  suite: Suite,
  channel: 'airbnb' | 'booking',
  events: ParsedIcsEvent[]
): number {
  state.bookings = state.bookings.filter(
    (b) => !(b.suiteId === suite.id && b.channel === channel)
  );

  const nowIso = new Date().toISOString();
  let added = 0;

  for (const ev of events) {
    if (!ev.checkIn || !ev.checkOut || ev.checkOut <= ev.checkIn) continue;
    added += 1;
    state.bookings.push({
      id: `${channel.toUpperCase()}-${Date.now().toString(36)}-${added}`,
      suiteId: suite.id,
      channel,
      checkIn: ev.checkIn,
      checkOut: ev.checkOut,
      guestName:
        ev.summary ||
        `Prenotazione ${channel === 'airbnb' ? 'Airbnb' : 'Booking.com'}`,
      guestsCount: 2,
      totalAmountEur: 0,
      paymentStatus: 'external',
      externalUid: ev.uid,
      notes: `Sincronizzata automaticamente da feed .ics ${
        channel === 'airbnb' ? 'Airbnb' : 'Booking.com'
      }`,
      createdAt: nowIso,
    });
  }

  if (channel === 'airbnb') suite.lastAirbnbSync = nowIso;
  if (channel === 'booking') suite.lastBookingSync = nowIso;
  suite.lastSyncSummary = `Auto-Sync: ${added} eventi da ${
    channel === 'airbnb' ? 'Airbnb' : 'Booking.com'
  }`;

  return added;
}

export interface SyncSuiteResult {
  ran: boolean;
  mutated: boolean;
  airbnbCount: number | null;
  bookingCount: number | null;
  errors: string[];
}

/**
 * AUTO-SYNC INTELLIGENTE:
 * Quando un cliente apre il calendario di una suite (o prima di un checkout),
 * controlla se i link .ics di Airbnb/Booking sono impostati e se sono passati
 * piu' di 15 minuti dall'ultimo aggiornamento. Se si', scarica e salva subito
 * i nuovi dati nel database prima di mostrare le date al cliente.
 */
export async function syncSuiteIcsIfNeeded(
  state: DatabaseState,
  suite: Suite,
  force = false
): Promise<SyncSuiteResult> {
  const hasAnyLink = Boolean(suite.airbnbIcsUrl || suite.bookingIcsUrl);
  if (!hasAnyLink) {
    return { ran: false, mutated: false, airbnbCount: null, bookingCount: null, errors: [] };
  }

  const nowMs = Date.now();
  const lastMs = suite.lastAutoSyncAt ? Date.parse(suite.lastAutoSyncAt) : 0;
  const elapsed = Number.isNaN(lastMs) ? Infinity : nowMs - lastMs;

  if (!force && elapsed < AUTO_SYNC_INTERVAL_MS) {
    return { ran: false, mutated: false, airbnbCount: null, bookingCount: null, errors: [] };
  }

  let airbnbCount: number | null = null;
  let bookingCount: number | null = null;
  const errors: string[] = [];
  let mutated = false;

  if (suite.airbnbIcsUrl) {
    try {
      const resp = await fetch(suite.airbnbIcsUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const parsed = parseIcsFeed(await resp.text());
      airbnbCount = replaceChannelBookingsInState(state, suite, 'airbnb', parsed);
      mutated = true;
    } catch (err) {
      errors.push(`Airbnb .ics: ${err instanceof Error ? err.message : 'Errore'}`);
    }
  }

  if (suite.bookingIcsUrl) {
    try {
      const resp = await fetch(suite.bookingIcsUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const parsed = parseIcsFeed(await resp.text());
      bookingCount = replaceChannelBookingsInState(state, suite, 'booking', parsed);
      mutated = true;
    } catch (err) {
      errors.push(`Booking.com .ics: ${err instanceof Error ? err.message : 'Errore'}`);
    }
  }

  suite.lastAutoSyncAt = new Date().toISOString();
  mutated = true;

  return { ran: true, mutated, airbnbCount, bookingCount, errors };
}
