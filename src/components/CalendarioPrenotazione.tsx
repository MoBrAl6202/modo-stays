import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Lock,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { AvailabilityBlock, BookingRecord, Suite, SuiteLocation } from '../types';

interface CalendarioPrenotazioneProps {
  suite: Suite;
  location?: SuiteLocation;
}

const ITALIAN_MONTHS = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
];

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

function toIsoDate(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function getTodayIso(): string {
  const now = new Date();
  return toIsoDate(now.getFullYear(), now.getMonth(), now.getDate());
}

function countNights(checkIn: string, checkOut: string): number {
  const a = Date.parse(`${checkIn}T00:00:00Z`);
  const b = Date.parse(`${checkOut}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function formatItalianDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${ITALIAN_MONTHS[m - 1]} ${y}`;
}

export function CalendarioPrenotazione({
  suite,
  location,
}: CalendarioPrenotazioneProps) {
  const todayIso = useMemo(() => getTodayIso(), []);
  const [viewYear, setViewYear] = useState<number>(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => new Date().getMonth());

  const [blockedRanges, setBlockedRanges] = useState<AvailabilityBlock[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(true);

  const [checkIn, setCheckIn] = useState<string>('');
  const [checkOut, setCheckOut] = useState<string>('');
  const [calendarHint, setCalendarHint] = useState<string>('');

  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestsCount, setGuestsCount] = useState(1);
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [sandboxCheckout, setSandboxCheckout] = useState<{
    booking: BookingRecord;
    totalAmountEur: number;
    nights: number;
  } | null>(null);
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('424');
  const [confirmedBooking, setConfirmedBooking] = useState<BookingRecord | null>(null);

  const [wlName, setWlName] = useState('');
  const [wlEmail, setWlEmail] = useState('');
  const [wlPeriod, setWlPeriod] = useState('');
  const [wlSubmitted, setWlSubmitted] = useState(false);

  const fetchAvailability = useCallback(async () => {
    setLoadingAvail(true);
    try {
      const res = await fetch(`/api/suites/${suite.id}/availability`);
      if (res.ok) {
        const data = (await res.json()) as { blockedRanges: AvailabilityBlock[] };
        setBlockedRanges(data.blockedRanges || []);
      }
    } finally {
      setLoadingAvail(false);
    }
  }, [suite.id]);

  useEffect(() => {
    fetchAvailability();
    setCheckIn('');
    setCheckOut('');
    setConfirmedBooking(null);
    setCalendarHint('');
    setWlSubmitted(false);
  }, [fetchAvailability]);

  const isDateOccupied = useCallback(
    (iso: string) =>
      blockedRanges.some((b) => iso >= b.checkIn && iso < b.checkOut),
    [blockedRanges]
  );

  const rangeHasOccupiedNight = useCallback(
    (startIso: string, endIso: string) =>
      blockedRanges.some((b) => b.checkIn < endIso && b.checkOut > startIso),
    [blockedRanges]
  );

  const handleDayClick = (iso: string) => {
    setCalendarHint('');
    setFormError('');
    if (iso < todayIso) return;

    if (!checkIn || (checkIn && checkOut)) {
      if (isDateOccupied(iso)) {
        setCalendarHint('Questa data risulta già occupata. Scegli una data libera.');
        return;
      }
      setCheckIn(iso);
      setCheckOut('');
      return;
    }

    if (iso <= checkIn) {
      if (isDateOccupied(iso)) {
        setCalendarHint('Questa data risulta già occupata.');
        return;
      }
      setCheckIn(iso);
      setCheckOut('');
      return;
    }

    if (rangeHasOccupiedNight(checkIn, iso)) {
      setCalendarHint(
        'L’intervallo scelto include notti già prenotate. Seleziona date contigue disponibili.'
      );
      return;
    }

    setCheckOut(iso);
  };

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    return countNights(checkIn, checkOut);
  }, [checkIn, checkOut]);

  const accommodationTotal = nights * suite.pricePerNight;
  const cityTaxTotal = nights * suite.cityTaxPerNight;
  const grandTotal =
    nights > 0 ? accommodationTotal + suite.cleaningFee + cityTaxTotal : 0;

  const calendarCells = useMemo(() => {
    const firstDay = new Date(Date.UTC(viewYear, viewMonth, 1));
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    const jsDay = firstDay.getUTCDay();
    const leadingEmpty = jsDay === 0 ? 6 : jsDay - 1;

    const cells: Array<{ day: number | null; iso: string | null }> = [];
    for (let i = 0; i < leadingEmpty; i += 1) {
      cells.push({ day: null, iso: null });
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      cells.push({ day: d, iso: toIsoDate(viewYear, viewMonth, d) });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!checkIn || !checkOut || nights < 1) {
      setFormError('Seleziona prima le date di check-in e check-out sul calendario.');
      return;
    }
    if (!guestName.trim() || !guestEmail.includes('@')) {
      setFormError('Inserisci il tuo nome completo e un indirizzo email valido.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/bookings/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suiteId: suite.id,
          checkIn,
          checkOut,
          guestName,
          guestEmail,
          guestPhone,
          guestsCount,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Impossibile avviare la prenotazione.');
        return;
      }

      if (data.mode === 'stripe_live' && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      if (data.mode === 'stripe_sandbox') {
        setSandboxCheckout({
          booking: data.booking,
          totalAmountEur: data.breakdown.totalAmountEur,
          nights: data.breakdown.nights,
        });
      }
    } catch {
      setFormError('Errore di connessione durante la prenotazione.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmSandboxPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sandboxCheckout) return;
    setSubmitting(true);
    try {
      const last4 = cardNumber.replace(/\s+/g, '').slice(-4) || '4242';
      const res = await fetch('/api/bookings/confirm-sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: sandboxCheckout.booking.id,
          cardLast4: last4,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setConfirmedBooking(data.booking);
        setSandboxCheckout(null);
        setCheckIn('');
        setCheckOut('');
        await fetchAvailability();
      } else {
        setFormError(data.error || 'Pagamento non riuscito.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSandbox = async () => {
    if (!sandboxCheckout) return;
    await fetch(`/api/bookings/pending/${sandboxCheckout.booking.id}`, {
      method: 'DELETE',
    });
    setSandboxCheckout(null);
    await fetchAvailability();
  };

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!wlName.trim() || !wlEmail.includes('@')) {
      setFormError('Inserisci nome ed email per la lista d’attesa.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: suite.locationId,
          suiteId: suite.id,
          name: wlName,
          email: wlEmail,
          preferredPeriod: wlPeriod,
        }),
      });
      if (res.ok) {
        setWlSubmitted(true);
      } else {
        const d = await res.json();
        setFormError(d.error || 'Errore nella registrazione.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (suite.status === 'development') {
    const cityLabel = location?.city || 'questa destinazione';
    const openingLabel =
      suite.openingDateLabel || location?.openingEstimate || 'Prossimamente';

    return (
      <div className="border border-[#E6E2DA] bg-[#FFFFFF] p-7">
        <div className="text-xs text-[#9A7B4F] font-semibold mb-2">
          In Sviluppo · Apertura prevista {openingLabel}
        </div>
        <h3 className="font-serif text-2xl font-medium text-[#1C1A17]">
          Accesso prioritario per {cityLabel}
        </h3>
        <p className="text-sm text-[#666158] mt-2 leading-relaxed">
          La dimora {suite.name} ({location?.address}) aprirà a {openingLabel}. Lascia i tuoi recapiti per ricevere l’invito anticipato all’apertura del calendario Modo Stays.
        </p>

        {wlSubmitted ? (
          <div className="mt-6 p-5 bg-[#F3F1EC] border border-[#D8D3C8]">
            <p className="font-medium text-sm text-[#2C3E35]">
              Iscrizione confermata per {cityLabel}
            </p>
            <p className="text-xs text-[#666158] mt-1">
              Ti contatteremo all’indirizzo <span className="font-medium">{wlEmail}</span> appena le date saranno prenotabili.
            </p>
          </div>
        ) : (
          <form onSubmit={handleWaitlistSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#4B4740] mb-1.5">
                Nome e Cognome
              </label>
              <input
                type="text"
                required
                value={wlName}
                onChange={(e) => setWlName(e.target.value)}
                placeholder="Es. Lorenzo Conti"
                className="w-full px-3.5 py-2.5 text-sm bg-[#FAF9F6] border border-[#D8D3C8] focus:outline-none focus:border-[#2C3E35]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4B4740] mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={wlEmail}
                onChange={(e) => setWlEmail(e.target.value)}
                placeholder="nome@esempio.it"
                className="w-full px-3.5 py-2.5 text-sm bg-[#FAF9F6] border border-[#D8D3C8] focus:outline-none focus:border-[#2C3E35]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4B4740] mb-1.5">
                Periodo di interesse (opzionale)
              </label>
              <input
                type="text"
                value={wlPeriod}
                onChange={(e) => setWlPeriod(e.target.value)}
                placeholder={`Es. ${openingLabel}`}
                className="w-full px-3.5 py-2.5 text-sm bg-[#FAF9F6] border border-[#D8D3C8] focus:outline-none focus:border-[#2C3E35]"
              />
            </div>
            {formError && <p className="text-xs text-[#B84A39]">{formError}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-5 bg-[#2C3E35] text-[#FAF9F6] text-sm font-medium hover:bg-[#1F2D26] transition-colors cursor-pointer disabled:opacity-60"
            >
              {submitting ? 'Invio in corso...' : 'Avvisami all’apertura'}
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="border border-[#E6E2DA] bg-[#FFFFFF] p-6 sm:p-7">
      <div className="flex items-baseline justify-between gap-4 pb-5 border-b border-[#E6E2DA]">
        <div>
          <span className="font-serif text-3xl font-medium text-[#1C1A17] tabular-nums">
            €{suite.pricePerNight}
          </span>
          <span className="text-sm text-[#666158]"> / notte</span>
        </div>
        <span className="text-xs text-[#2C3E35] font-medium">
          Auto-Sync .ics attivo
        </span>
      </div>

      {confirmedBooking && (
        <div className="mt-5 p-5 bg-[#E9EFEA] border border-[#C6D5CA] text-[#1C1A17]">
          <div className="flex items-start gap-3">
            <CalendarCheck2 className="w-5 h-5 text-[#2C3E35] shrink-0 mt-0.5" />
            <div>
              <h4 className="font-serif text-xl font-semibold text-[#1C1A17]">
                Prenotazione Confermata
              </h4>
              <p className="text-xs text-[#3D3A34] mt-1">
                Codice riferimento:{' '}
                <span className="font-mono font-medium">{confirmedBooking.id}</span>
              </p>
              <p className="text-sm text-[#1C1A17] mt-2">
                {formatItalianDate(confirmedBooking.checkIn)} —{' '}
                {formatItalianDate(confirmedBooking.checkOut)} ·{' '}
                <span className="font-semibold tabular-nums">
                  €{confirmedBooking.totalAmountEur}
                </span>
              </p>
              <p className="text-xs text-[#4B4740] mt-2 leading-relaxed">
                Le date sono ora bloccate sul sito e aggiornate automaticamente nel feed .ics per Airbnb e Booking.com.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Mese precedente"
            className="p-2 border border-[#E6E2DA] hover:bg-[#F3F1EC] text-[#1C1A17] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-serif text-lg font-medium text-[#1C1A17]">
            {ITALIAN_MONTHS[viewMonth]} {viewYear}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Mese successivo"
            className="p-2 border border-[#E6E2DA] hover:bg-[#F3F1EC] text-[#1C1A17] transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-[#666158] mb-1.5">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>

        {loadingAvail ? (
          <div className="h-56 flex items-center justify-center bg-[#FAF9F6] text-xs text-[#666158]">
            Verifica disponibilità...
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, idx) => {
              if (!cell.day || !cell.iso) {
                return <div key={`empty-${idx}`} className="h-10" />;
              }
              const iso = cell.iso;
              const isPast = iso < todayIso;
              const occupied = isDateOccupied(iso);
              const isCheckIn = checkIn === iso;
              const isCheckOut = checkOut === iso;
              const isInRange =
                Boolean(checkIn && checkOut) && iso > checkIn && iso < checkOut;

              const canBeCheckoutOnly =
                Boolean(checkIn && !checkOut && iso > checkIn) &&
                !rangeHasOccupiedNight(checkIn, iso);

              const disabled = isPast || (occupied && !canBeCheckoutOnly);

              let cellStyle =
                'bg-[#FAF9F6] text-[#1C1A17] border-[#E6E2DA] hover:border-[#2C3E35]';
              if (isPast) {
                cellStyle =
                  'bg-[#F7F5F0] text-[#B8B1A3] border-transparent cursor-not-allowed';
              } else if (occupied && !canBeCheckoutOnly) {
                cellStyle =
                  'bg-[#EFECE6] text-[#8E877B] border-transparent line-through cursor-not-allowed';
              } else if (isCheckIn || isCheckOut) {
                cellStyle =
                  'bg-[#2C3E35] text-[#FAF9F6] border-[#2C3E35] font-semibold';
              } else if (isInRange) {
                cellStyle = 'bg-[#E9EFEA] text-[#1C1A17] border-[#C6D5CA]';
              }

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleDayClick(iso)}
                  title={
                    occupied && !canBeCheckoutOnly
                      ? 'Data occupata'
                      : isPast
                      ? 'Data passata'
                      : `Seleziona ${formatItalianDate(iso)}`
                  }
                  className={`h-10 text-xs border transition-colors tabular-nums flex items-center justify-center ${cellStyle} ${
                    disabled ? '' : 'cursor-pointer'
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-[#666158]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 border border-[#E6E2DA] bg-[#FAF9F6] inline-block" />
            Disponibile
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 bg-[#EFECE6] inline-block" />
            Occupata
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 bg-[#2C3E35] inline-block" />
            Selezionata
          </span>
        </div>

        {calendarHint && (
          <p className="mt-2.5 text-xs text-[#9A7B4F]">{calendarHint}</p>
        )}
      </div>

      <div className="mt-5 p-4 bg-[#FAF9F6] border border-[#E6E2DA]">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-[#666158] block">Check-in</span>
            <span className="font-medium text-[#1C1A17] mt-0.5 block">
              {checkIn ? formatItalianDate(checkIn) : 'Seleziona data'}
            </span>
          </div>
          <div>
            <span className="text-[#666158] block">Check-out</span>
            <span className="font-medium text-[#1C1A17] mt-0.5 block">
              {checkOut ? formatItalianDate(checkOut) : 'Seleziona data'}
            </span>
          </div>
        </div>

        {nights > 0 && (
          <div className="mt-4 pt-4 border-t border-[#E6E2DA] space-y-2 text-xs text-[#3D3A34] tabular-nums">
            <div className="flex justify-between">
              <span>
                €{suite.pricePerNight} × {nights} {nights === 1 ? 'notte' : 'notti'}
              </span>
              <span>€{accommodationTotal}</span>
            </div>
            <div className="flex justify-between">
              <span>Pulizia finale</span>
              <span>€{suite.cleaningFee}</span>
            </div>
            <div className="flex justify-between">
              <span>Tassa di soggiorno ({nights} notti)</span>
              <span>€{cityTaxTotal}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[#E6E2DA] text-sm font-semibold text-[#1C1A17]">
              <span>Totale</span>
              <span>€{grandTotal}</span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleCheckoutSubmit} className="mt-5 space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#4B4740] mb-1">
              Nome e Cognome
            </label>
            <input
              type="text"
              required
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Es. Chiara Bianchi"
              className="w-full px-3 py-2 text-sm bg-[#FAF9F6] border border-[#D8D3C8] focus:outline-none focus:border-[#2C3E35]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#4B4740] mb-1">
              Ospiti (max {suite.maxGuests})
            </label>
            <select
              value={guestsCount}
              onChange={(e) => setGuestsCount(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-[#FAF9F6] border border-[#D8D3C8] focus:outline-none focus:border-[#2C3E35]"
            >
              {Array.from({ length: suite.maxGuests }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'ospite' : 'ospiti'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#4B4740] mb-1">
              Email per conferma
            </label>
            <input
              type="email"
              required
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="chiara@esempio.it"
              className="w-full px-3 py-2 text-sm bg-[#FAF9F6] border border-[#D8D3C8] focus:outline-none focus:border-[#2C3E35]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#4B4740] mb-1">
              Telefono
            </label>
            <input
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="+39 340 000 0000"
              className="w-full px-3 py-2 text-sm bg-[#FAF9F6] border border-[#D8D3C8] focus:outline-none focus:border-[#2C3E35]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#4B4740] mb-1">
            Note per il soggiorno (opzionale)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Orario indicativo di arrivo o richieste particolari"
            className="w-full px-3 py-2 text-sm bg-[#FAF9F6] border border-[#D8D3C8] focus:outline-none focus:border-[#2C3E35]"
          />
        </div>

        {formError && <p className="text-xs text-[#B84A39]">{formError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 px-5 bg-[#2C3E35] text-[#FAF9F6] text-sm font-medium hover:bg-[#1F2D26] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
        >
          <CreditCard className="w-4 h-4" />
          {submitting
            ? 'Preparazione pagamento Stripe...'
            : nights > 0
            ? `Prenota Ora · €${grandTotal} con Carta`
            : 'Prenota Ora con Carta (Stripe)'}
        </button>

        <div className="flex items-center justify-center gap-2 text-[11px] text-[#666158] pt-1">
          <Lock className="w-3.5 h-3.5" />
          <span>Pagamento protetto predisposto per Stripe Checkout</span>
        </div>
      </form>

      {sandboxCheckout && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[#D8D3C8] max-w-md w-full p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E6E2DA]">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-[#2C3E35]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Stripe Checkout · Modalità Test</span>
                </div>
                <h4 className="font-serif text-2xl font-medium text-[#1C1A17] mt-1">
                  Completa pagamento soggiorno
                </h4>
              </div>
              <button
                type="button"
                onClick={handleCancelSandbox}
                aria-label="Annulla pagamento"
                className="p-1.5 text-[#666158] hover:text-[#1C1A17] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 p-3.5 bg-[#FAF9F6] border border-[#E6E2DA] text-xs space-y-1">
              <div className="flex justify-between font-medium text-[#1C1A17]">
                <span>{suite.name}</span>
                <span className="tabular-nums">€{sandboxCheckout.totalAmountEur}</span>
              </div>
              <div className="text-[#666158]">
                {formatItalianDate(sandboxCheckout.booking.checkIn)} —{' '}
                {formatItalianDate(sandboxCheckout.booking.checkOut)} ({sandboxCheckout.nights} notti)
              </div>
            </div>

            <form onSubmit={handleConfirmSandboxPayment} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#4B4740] mb-1">
                  Numero carta (Carta test Stripe precompilata)
                </label>
                <input
                  type="text"
                  required
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#FAF9F6] border border-[#D8D3C8]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#4B4740] mb-1">
                    Scadenza
                  </label>
                  <input
                    type="text"
                    required
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-[#FAF9F6] border border-[#D8D3C8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4B4740] mb-1">
                    CVC
                  </label>
                  <input
                    type="text"
                    required
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-[#FAF9F6] border border-[#D8D3C8]"
                  />
                </div>
              </div>

              <p className="text-[11px] text-[#666158] leading-relaxed">
                Quando inserirai <span className="font-mono">STRIPE_SECRET_KEY</span> nel backend, questo passaggio reindirizzerà automaticamente alla pagina ufficiale di Stripe Checkout.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCancelSandbox}
                  className="flex-1 py-2.5 px-4 border border-[#D8D3C8] text-xs font-medium text-[#1C1A17] hover:bg-[#F3F1EC] cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 bg-[#2C3E35] text-[#FAF9F6] text-xs font-medium hover:bg-[#1F2D26] cursor-pointer disabled:opacity-60"
                >
                  {submitting
                    ? 'Autorizzazione...'
                    : `Paga €${sandboxCheckout.totalAmountEur}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
