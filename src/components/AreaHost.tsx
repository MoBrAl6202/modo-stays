import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  FileCode2,
  FolderOpen,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { BRAND_INFO, FOTO_ALLOGGI } from '../CONTENUTI_ALLOGGI';
import { generaEmailConferma } from '../EMAIL_CONFERMA';
import type {
  BookingChannel,
  BookingConflict,
  BookingRecord,
  Suite,
  SystemIntegrationStatus,
  WaitlistEntry,
} from '../types';

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

const CHANNEL_META: Record<
  BookingChannel,
  { label: string; shortLabel: string; cellClass: string; badgeClass: string }
> = {
  direct: {
    label: 'Sito Diretto',
    shortLabel: 'Sito',
    cellClass: 'bg-[#E9EFEA] text-[#1F2D26] border-[#B7CBBC]',
    badgeClass: 'text-[#2C3E35]',
  },
  airbnb: {
    label: 'Airbnb (.ics)',
    shortLabel: 'Airbnb',
    cellClass: 'bg-[#FBF0EE] text-[#8E3528] border-[#E7C6C0]',
    badgeClass: 'text-[#B84A39]',
  },
  booking: {
    label: 'Booking.com (.ics)',
    shortLabel: 'Booking',
    cellClass: 'bg-[#EDF3F8] text-[#173D63] border-[#BED1E3]',
    badgeClass: 'text-[#1E4D7B]',
  },
  manual: {
    label: 'Blocco Host',
    shortLabel: 'Blocco',
    cellClass: 'bg-[#EFECE6] text-[#4B4740] border-[#D5CFC2]',
    badgeClass: 'text-[#5C574F]',
  },
};

function toIsoDate(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(
    2,
    '0'
  )}`;
}

interface AreaHostProps {
  onCatalogUpdated?: () => Promise<void> | void;
}

export function AreaHost({ onCatalogUpdated }: AreaHostProps) {
  const [hostCode, setHostCode] = useState<string>(
    () => sessionStorage.getItem('modo_stays_host_code') || ''
  );
  const [codeInput, setCodeInput] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  const [suites, setSuites] = useState<Suite[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [conflicts, setConflicts] = useState<BookingConflict[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [integrationStatus, setIntegrationStatus] =
    useState<SystemIntegrationStatus | null>(null);

  const [activeTab, setActiveTab] = useState<
    'calendar' | 'ics' | 'suites' | 'ledger'
  >('calendar');
  const [selectedSuiteFilter, setSelectedSuiteFilter] = useState<string>('all');
  const [selectedChannelFilter, setSelectedChannelFilter] = useState<
    BookingChannel | 'all'
  >('all');
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(null);

  const [viewYear, setViewYear] = useState<number>(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => new Date().getMonth());

  const [blockSuiteId, setBlockSuiteId] = useState('carlone-lumiere');
  const [blockCheckIn, setBlockCheckIn] = useState('2026-12-27');
  const [blockCheckOut, setBlockCheckOut] = useState('2026-12-30');
  const [blockNotes, setBlockNotes] = useState('Manutenzione / Uso personale');

  const [icsDrafts, setIcsDrafts] = useState<
    Record<string, { airbnbIcsUrl: string; bookingIcsUrl: string }>
  >({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [syncError, setSyncError] = useState<string>('');
  const [syncingSuiteId, setSyncingSuiteId] = useState<string | null>(null);

  const [rawIcsModalSuite, setRawIcsModalSuite] = useState<Suite | null>(null);
  const [rawIcsChannel, setRawIcsChannel] = useState<'airbnb' | 'booking'>('airbnb');
  const [rawIcsText, setRawIcsText] = useState('');
  const [sampleCheckIn, setSampleCheckIn] = useState('2026-12-18');
  const [sampleCheckOut, setSampleCheckOut] = useState('2026-12-21');
  const [sampleGuest, setSampleGuest] = useState('Sophie Martin');

  const [editingSuiteId, setEditingSuiteId] = useState<string>('carlone-lumiere');
  const [savingSuite, setSavingSuite] = useState(false);
  const [mapUrlDraft, setMapUrlDraft] = useState<string>(BRAND_INFO.mappaMyMapsUrl);
  const [savingMapUrl, setSavingMapUrl] = useState(false);
  const [emailPreviewBooking, setEmailPreviewBooking] = useState<BookingRecord | null>(
    null
  );
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [suiteDraft, setSuiteDraft] = useState<{
    name: string;
    subtitle: string;
    status: 'open' | 'development';
    openingDateLabel: string;
    pricePerNight: number;
    cleaningFee: number;
    cityTaxPerNight: number;
    maxGuests: number;
    sizeSqm: number;
    bedrooms: number;
    bathrooms: number;
    floor: string;
    description: string;
    designNotes: string;
    amenitiesText: string;
    houseRulesText: string;
  } | null>(null);

  const fetchHostData = useCallback(
    async (code: string) => {
      setLoading(true);
      setAuthError('');
      try {
        const res = await fetch('/api/host/calendar', {
          headers: { 'x-host-code': code },
        });
        if (res.status === 401) {
          setAuthenticated(false);
          sessionStorage.removeItem('modo_stays_host_code');
          return;
        }
        if (!res.ok) throw new Error('Errore nel caricamento dati Host');

        const data = (await res.json()) as {
          suites: Suite[];
          bookings: BookingRecord[];
          conflicts: BookingConflict[];
          waitlist: WaitlistEntry[];
          integrationStatus: SystemIntegrationStatus;
        };
        setSuites(data.suites);
        setBookings(data.bookings);
        setConflicts(data.conflicts);
        setWaitlist(data.waitlist);
        setIntegrationStatus(data.integrationStatus);
        if (data.integrationStatus?.mapEmbedUrl !== undefined) {
          setMapUrlDraft(data.integrationStatus.mapEmbedUrl);
        }
        setAuthenticated(true);

        const drafts: Record<string, { airbnbIcsUrl: string; bookingIcsUrl: string }> = {};
        for (const s of data.suites) {
          drafts[s.id] = {
            airbnbIcsUrl: s.airbnbIcsUrl || '',
            bookingIcsUrl: s.bookingIcsUrl || '',
          };
        }
        setIcsDrafts(drafts);

        const targetSuite =
          data.suites.find((s) => s.id === editingSuiteId) || data.suites[0];
        if (targetSuite) {
          setEditingSuiteId(targetSuite.id);
          setSuiteDraft({
            name: targetSuite.name,
            subtitle: targetSuite.subtitle,
            status: targetSuite.status,
            openingDateLabel: targetSuite.openingDateLabel || '',
            pricePerNight: targetSuite.pricePerNight,
            cleaningFee: targetSuite.cleaningFee,
            cityTaxPerNight: targetSuite.cityTaxPerNight,
            maxGuests: targetSuite.maxGuests,
            sizeSqm: targetSuite.sizeSqm,
            bedrooms: targetSuite.bedrooms,
            bathrooms: targetSuite.bathrooms,
            floor: targetSuite.floor,
            description: targetSuite.description,
            designNotes: targetSuite.designNotes,
            amenitiesText: targetSuite.amenities.join('\n'),
            houseRulesText: targetSuite.houseRules.join('\n'),
          });
        }
      } catch {
        setAuthError('Impossibile connettersi al server Host.');
      } finally {
        setLoading(false);
      }
    },
    [editingSuiteId]
  );

  useEffect(() => {
    if (hostCode) {
      fetchHostData(hostCode);
    }
  }, [hostCode, fetchHostData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const res = await fetch('/api/host/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: codeInput }),
    });
    if (res.ok) {
      sessionStorage.setItem('modo_stays_host_code', codeInput);
      setHostCode(codeInput);
    } else {
      setAuthError('Codice proprietario non valido. Prova con 2026.');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('modo_stays_host_code');
    setHostCode('');
    setCodeInput('');
    setAuthenticated(false);
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (selectedSuiteFilter !== 'all' && b.suiteId !== selectedSuiteFilter) {
        return false;
      }
      if (selectedChannelFilter !== 'all' && b.channel !== selectedChannelFilter) {
        return false;
      }
      return true;
    });
  }, [bookings, selectedSuiteFilter, selectedChannelFilter]);

  const channelCounts = useMemo(() => {
    const counts: Record<BookingChannel, number> = {
      direct: 0,
      airbnb: 0,
      booking: 0,
      manual: 0,
    };
    for (const b of bookings) {
      counts[b.channel] += 1;
    }
    return counts;
  }, [bookings]);

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

  const suiteNameMap = useMemo(() => {
    const rec: Record<string, string> = {};
    for (const s of suites) rec[s.id] = s.name;
    return rec;
  }, [suites]);

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncMessage('');
    setSyncError('');
    const res = await fetch('/api/host/blocks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-host-code': hostCode,
      },
      body: JSON.stringify({
        suiteId: blockSuiteId,
        checkIn: blockCheckIn,
        checkOut: blockCheckOut,
        notes: blockNotes,
      }),
    });
    if (res.ok) {
      setSyncMessage('Blocco manuale salvato ed esportato nel feed .ics.');
      await fetchHostData(hostCode);
    } else {
      const err = await res.json();
      setSyncError(err.error || 'Errore nella creazione del blocco.');
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    const res = await fetch(`/api/host/bookings/${bookingId}`, {
      method: 'DELETE',
      headers: { 'x-host-code': hostCode },
    });
    if (res.ok) {
      if (selectedBooking?.id === bookingId) setSelectedBooking(null);
      await fetchHostData(hostCode);
    }
  };

  const handleSaveIcsUrls = async (suiteId: string) => {
    setSyncMessage('');
    setSyncError('');
    const draft = icsDrafts[suiteId] || { airbnbIcsUrl: '', bookingIcsUrl: '' };
    const res = await fetch(`/api/host/suites/${suiteId}/ics-config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-host-code': hostCode,
      },
      body: JSON.stringify(draft),
    });
    if (res.ok) {
      setSyncMessage('Link .ics salvati correttamente. L’Auto-Sync intelligente è attivo.');
      await fetchHostData(hostCode);
    } else {
      setSyncError('Errore nel salvataggio dei link .ics.');
    }
  };

  const handleSyncIcsNow = async (suiteId: string) => {
    setSyncMessage('');
    setSyncError('');
    setSyncingSuiteId(suiteId);
    try {
      const draft = icsDrafts[suiteId] || { airbnbIcsUrl: '', bookingIcsUrl: '' };
      await fetch(`/api/host/suites/${suiteId}/ics-config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-host-code': hostCode,
        },
        body: JSON.stringify(draft),
      });

      const res = await fetch(`/api/host/suites/${suiteId}/sync-ics`, {
        method: 'POST',
        headers: { 'x-host-code': hostCode },
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncError(data.error || 'Sincronizzazione non riuscita.');
        return;
      }
      const errs = data.results?.errors || [];
      if (errs.length > 0) {
        setSyncError(errs.join(' · '));
      } else {
        setSyncMessage(
          `Sincronizzazione completata (Airbnb: ${
            data.results.airbnbCount ?? 'n/d'
          }, Booking.com: ${data.results.bookingCount ?? 'n/d'}).`
        );
      }
      await fetchHostData(hostCode);
    } finally {
      setSyncingSuiteId(null);
    }
  };

  const handleImportSampleOrRaw = async (sampleMode: boolean) => {
    if (!rawIcsModalSuite) return;
    setSyncMessage('');
    setSyncError('');
    const res = await fetch(
      `/api/host/suites/${rawIcsModalSuite.id}/import-ics-raw`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-host-code': hostCode,
        },
        body: JSON.stringify({
          channel: rawIcsChannel,
          rawIcs: rawIcsText,
          sampleMode,
          sampleCheckIn,
          sampleCheckOut,
          sampleGuest,
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      setSyncError(data.error || 'Errore nel parsing .ics.');
      return;
    }
    setSyncMessage(
      `Importati ${data.importedCount} eventi ${
        rawIcsChannel === 'airbnb' ? 'Airbnb' : 'Booking.com'
      } nel calendario personale e pubblico.`
    );
    setRawIcsModalSuite(null);
    setRawIcsText('');
    await fetchHostData(hostCode);
  };

  const handleCopyUrl = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSelectSuiteForEdit = (suite: Suite) => {
    setEditingSuiteId(suite.id);
    setSyncMessage('');
    setSyncError('');
    setSuiteDraft({
      name: suite.name,
      subtitle: suite.subtitle,
      status: suite.status,
      openingDateLabel: suite.openingDateLabel || '',
      pricePerNight: suite.pricePerNight,
      cleaningFee: suite.cleaningFee,
      cityTaxPerNight: suite.cityTaxPerNight,
      maxGuests: suite.maxGuests,
      sizeSqm: suite.sizeSqm,
      bedrooms: suite.bedrooms,
      bathrooms: suite.bathrooms,
      floor: suite.floor,
      description: suite.description,
      designNotes: suite.designNotes,
      amenitiesText: suite.amenities.join('\n'),
      houseRulesText: suite.houseRules.join('\n'),
    });
  };

  const handleSaveSuiteDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suiteDraft || !editingSuiteId) return;
    setSavingSuite(true);
    setSyncMessage('');
    setSyncError('');
    try {
      const res = await fetch(`/api/host/suites/${editingSuiteId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-host-code': hostCode,
        },
        body: JSON.stringify({
          name: suiteDraft.name,
          subtitle: suiteDraft.subtitle,
          status: suiteDraft.status,
          openingDateLabel: suiteDraft.openingDateLabel,
          pricePerNight: Number(suiteDraft.pricePerNight),
          cleaningFee: Number(suiteDraft.cleaningFee),
          cityTaxPerNight: Number(suiteDraft.cityTaxPerNight),
          maxGuests: Number(suiteDraft.maxGuests),
          sizeSqm: Number(suiteDraft.sizeSqm),
          bedrooms: Number(suiteDraft.bedrooms),
          bathrooms: Number(suiteDraft.bathrooms),
          floor: suiteDraft.floor,
          description: suiteDraft.description,
          designNotes: suiteDraft.designNotes,
          amenities: suiteDraft.amenitiesText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
          houseRules: suiteDraft.houseRulesText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setSyncError(err.error || 'Impossibile aggiornare i dati della suite.');
        return;
      }
      setSyncMessage('Prezzi e informazioni dell’alloggio aggiornati sul sito pubblico.');
      await fetchHostData(hostCode);
      if (onCatalogUpdated) {
        await onCatalogUpdated();
      }
    } finally {
      setSavingSuite(false);
    }
  };

  const handleSaveMapUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMapUrl(true);
    setSyncMessage('');
    setSyncError('');
    try {
      const res = await fetch('/api/host/map-url', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-host-code': hostCode,
        },
        body: JSON.stringify({ mapEmbedUrl: mapUrlDraft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncError(data.error || 'Impossibile salvare il link della mappa.');
        return;
      }
      setMapUrlDraft(data.mapEmbedUrl || '');
      setSyncMessage('Link Google My Maps aggiornato sul sito pubblico.');
      if (onCatalogUpdated) {
        await onCatalogUpdated();
      }
    } finally {
      setSavingMapUrl(false);
    }
  };

  const handleSendConfirmationEmail = async (bookingId: string) => {
    setSendingEmailId(bookingId);
    setSyncMessage('');
    setSyncError('');
    try {
      const res = await fetch(`/api/host/bookings/${bookingId}/send-confirmation`, {
        method: 'POST',
        headers: { 'x-host-code': hostCode },
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncError(data.error || 'Impossibile inviare l’email di conferma.');
        return;
      }
      if (data.emailStatus?.sent) {
        setSyncMessage(`Email di conferma inviata a ${data.emailStatus.recipient}.`);
        await fetchHostData(hostCode);
        if (emailPreviewBooking?.id === bookingId) {
          setEmailPreviewBooking(data.booking);
        }
      } else {
        setSyncError(
          data.emailStatus?.reason === 'missing_api_key'
            ? 'Invio reale non ancora attivo: aggiungi GMAIL_WEBHOOK_URL (senza dominio) su Cloudflare — vedi Sezione 7 di CLOUDFLARE_GUIDA.md.'
            : `Invio ospite non riuscito: ${
                data.emailStatus?.reason || 'errore sconosciuto'
              }${
                data.emailStatus?.hostNotified
                  ? ' — L’avviso all’Host invece è stato inviato!'
                  : ''
              }`
        );
      }
    } finally {
      setSendingEmailId(null);
    }
  };

  if (!authenticated) {
    return (
      <section className="max-w-lg mx-auto py-16 px-6">
        <div className="border border-[#E6E2DA] bg-[#FFFFFF] p-8">
          <div className="flex items-center gap-2 text-xs text-[#666158] mb-3">
            <Lock className="w-4 h-4 text-[#2C3E35]" />
            <span>Area Riservata al Proprietario · {BRAND_INFO.nome}</span>
          </div>
          <h1 className="font-serif text-3xl font-medium text-[#1C1A17]">
            Calendario Personale & Channel Manager
          </h1>
          <p className="text-sm text-[#666158] mt-3 leading-relaxed">
            Console privata separata dal sito pubblico: visualizza la provenienza di ogni prenotazione (Sito Diretto, Airbnb, Booking.com), gestisci i link <span className="font-mono">.ics</span> con Auto-Sync intelligente e aggiorna prezzi e descrizioni degli alloggi.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#4B4740] mb-1.5">
                Codice di accesso Host
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder="Inserisci il codice proprietario"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#FAF9F6] border border-[#D8D3C8] focus:outline-none focus:border-[#2C3E35]"
                />
                <KeyRound className="w-4 h-4 text-[#8E877B] absolute right-3 top-3" />
              </div>
              <p className="text-[11px] text-[#666158] mt-1.5">
                Codice dimostrativo predefinito: <span className="font-mono font-medium">2026</span> (modificabile tramite variabile <span className="font-mono">HOST_ACCESS_CODE</span>).
              </p>
            </div>

            {authError && <p className="text-xs text-[#B84A39]">{authError}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-5 bg-[#2C3E35] text-[#FAF9F6] text-sm font-medium hover:bg-[#1F2D26] transition-colors cursor-pointer"
            >
              Accedi alla Console Host
            </button>
          </form>
        </div>
      </section>
    );
  }

  const baseUrl =
    integrationStatus?.appBaseUrl ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  return (
    <section className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#E6E2DA]">
        <div>
          <div className="text-xs text-[#666158] mb-1.5">
            Console Privata Host · Auto-Sync ogni {integrationStatus?.autoSyncIntervalMinutes || 15} minuti
          </div>
          <h1 className="font-serif text-4xl font-medium text-[#1C1A17]">
            Calendario Unificato & Gestione Alloggi
          </h1>
          <p className="text-sm text-[#666158] mt-2 max-w-2xl">
            Monitora prenotazioni per canale (Sito Diretto, Airbnb, Booking.com), collega i feed iCal bidirezionali e aggiorna tariffe e descrizioni in autonomia.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#F3F1EC] border border-[#E6E2DA]">
            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              className={`px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'calendar'
                  ? 'bg-[#FFFFFF] text-[#1C1A17]'
                  : 'text-[#666158] hover:text-[#1C1A17]'
              }`}
            >
              Calendario Master
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ics')}
              className={`px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'ics'
                  ? 'bg-[#FFFFFF] text-[#1C1A17]'
                  : 'text-[#666158] hover:text-[#1C1A17]'
              }`}
            >
              Link .ics & Auto-Sync
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('suites')}
              className={`px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'suites'
                  ? 'bg-[#FFFFFF] text-[#1C1A17]'
                  : 'text-[#666158] hover:text-[#1C1A17]'
              }`}
            >
              Alloggi & Prezzi
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'ledger'
                  ? 'bg-[#FFFFFF] text-[#1C1A17]'
                  : 'text-[#666158] hover:text-[#1C1A17]'
              }`}
            >
              Registro & Stripe
            </button>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-[#D8D3C8] bg-[#FFFFFF] text-[#4B4740] hover:bg-[#F3F1EC] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Esci
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 border border-[#E6E2DA] bg-[#FFFFFF] divide-y lg:divide-y-0 lg:divide-x divide-[#E6E2DA]">
        <div className="p-5">
          <div className="text-xs text-[#2C3E35] font-medium">Sito Diretto (Stripe)</div>
          <div className="font-serif text-3xl text-[#1C1A17] mt-1 tabular-nums">
            {channelCounts.direct}
          </div>
          <div className="text-xs text-[#666158] mt-1">Prenotazioni dirette</div>
        </div>
        <div className="p-5">
          <div className="text-xs text-[#B84A39] font-medium">Airbnb (Feed .ics)</div>
          <div className="font-serif text-3xl text-[#1C1A17] mt-1 tabular-nums">
            {channelCounts.airbnb}
          </div>
          <div className="text-xs text-[#666158] mt-1">Importate via iCal</div>
        </div>
        <div className="p-5">
          <div className="text-xs text-[#1E4D7B] font-medium">Booking.com (Feed .ics)</div>
          <div className="font-serif text-3xl text-[#1C1A17] mt-1 tabular-nums">
            {channelCounts.booking}
          </div>
          <div className="text-xs text-[#666158] mt-1">Importate via iCal</div>
        </div>
        <div className="p-5">
          <div className="text-xs text-[#5C574F] font-medium">Blocchi & Lista d’Attesa</div>
          <div className="font-serif text-3xl text-[#1C1A17] mt-1 tabular-nums">
            {channelCounts.manual} / {waitlist.length}
          </div>
          <div className="text-xs text-[#666158] mt-1">Blocchi / Iscritti Ibiza & Milano</div>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="p-4 bg-[#FBF0EE] border border-[#E7C6C0] flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#B84A39] shrink-0 mt-0.5" />
          <div className="text-xs text-[#8E3528] space-y-1">
            <p className="font-semibold">
              Attenzione: rilevate {conflicts.length} sovrapposizioni di date tra canali diversi
            </p>
            {conflicts.map((c, idx) => (
              <p key={idx}>
                {suiteNameMap[c.suiteId]}: {CHANNEL_META[c.bookingA.channel].label} (
                {c.bookingA.guestName}) e {CHANNEL_META[c.bookingB.channel].label} (
                {c.bookingB.guestName}) si sovrappongono dal{' '}
                <span className="font-mono">{c.overlapStart}</span> al{' '}
                <span className="font-mono">{c.overlapEnd}</span>.
              </p>
            ))}
          </div>
        </div>
      )}

      {(syncMessage || syncError) && (
        <div
          className={`p-4 border text-xs ${
            syncError
              ? 'bg-[#FBF0EE] border-[#E7C6C0] text-[#8E3528]'
              : 'bg-[#E9EFEA] border-[#C6D5CA] text-[#1F2D26]'
          }`}
        >
          {syncError || syncMessage}
        </div>
      )}

      {/* TAB 1: MASTER CALENDAR */}
      {activeTab === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 border border-[#E6E2DA] bg-[#FFFFFF] p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E6E2DA]">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedSuiteFilter}
                  onChange={(e) => setSelectedSuiteFilter(e.target.value)}
                  className="px-3 py-2 text-xs bg-[#FAF9F6] border border-[#D8D3C8] text-[#1C1A17]"
                >
                  <option value="all">Tutte le suite</option>
                  {suites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedChannelFilter}
                  onChange={(e) =>
                    setSelectedChannelFilter(e.target.value as BookingChannel | 'all')
                  }
                  className="px-3 py-2 text-xs bg-[#FAF9F6] border border-[#D8D3C8] text-[#1C1A17]"
                >
                  <option value="all">Tutti i canali</option>
                  <option value="direct">Solo Sito Diretto</option>
                  <option value="airbnb">Solo Airbnb</option>
                  <option value="booking">Solo Booking.com</option>
                  <option value="manual">Solo Blocchi Host</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (viewMonth === 0) {
                      setViewMonth(11);
                      setViewYear((y) => y - 1);
                    } else {
                      setViewMonth((m) => m - 1);
                    }
                  }}
                  aria-label="Mese precedente"
                  className="p-2 border border-[#E6E2DA] hover:bg-[#F3F1EC] cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-serif text-xl font-medium min-w-[150px] text-center">
                  {ITALIAN_MONTHS[viewMonth]} {viewYear}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (viewMonth === 11) {
                      setViewMonth(0);
                      setViewYear((y) => y + 1);
                    } else {
                      setViewMonth((m) => m + 1);
                    }
                  }}
                  aria-label="Mese successivo"
                  className="p-2 border border-[#E6E2DA] hover:bg-[#F3F1EC] cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5 py-3 text-xs text-[#4B4740]">
              {(['direct', 'airbnb', 'booking', 'manual'] as BookingChannel[]).map(
                (ch) => (
                  <span key={ch} className="inline-flex items-center gap-2">
                    <span
                      className={`w-3.5 h-3.5 border inline-block ${CHANNEL_META[ch].cellClass}`}
                    />
                    {CHANNEL_META[ch].label}
                  </span>
                )
              )}
            </div>

            <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium text-[#666158] mt-2 mb-1.5">
              {WEEKDAYS.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {calendarCells.map((cell, idx) => {
                if (!cell.day || !cell.iso) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="min-h-[84px] bg-[#FAF9F6]/60 border border-[#F0EDE6]"
                    />
                  );
                }

                const dayBookings = filteredBookings.filter(
                  (b) => cell.iso! >= b.checkIn && cell.iso! < b.checkOut
                );

                return (
                  <div
                    key={cell.iso}
                    className="min-h-[84px] p-1.5 bg-[#FAF9F6] border border-[#E6E2DA] flex flex-col gap-1"
                  >
                    <span className="text-[11px] font-mono text-[#666158] tabular-nums">
                      {cell.day}
                    </span>
                    <div className="space-y-1 overflow-hidden">
                      {dayBookings.map((b) => {
                        const meta = CHANNEL_META[b.channel];
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setSelectedBooking(b)}
                            className={`w-full text-left px-1.5 py-0.5 text-[10px] font-medium border truncate cursor-pointer ${meta.cellClass}`}
                            title={`${meta.label} · ${b.guestName} · ${
                              suiteNameMap[b.suiteId]
                            }`}
                          >
                            {meta.shortLabel}: {b.guestName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="border border-[#E6E2DA] bg-[#FFFFFF] p-6">
              <div className="flex items-center gap-2 text-xs text-[#666158] mb-2">
                <Calendar className="w-4 h-4" />
                <span>Dettaglio Prenotazione Selezionata</span>
              </div>

              {selectedBooking ? (
                <div className="space-y-3 mt-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-semibold ${
                        CHANNEL_META[selectedBooking.channel].badgeClass
                      }`}
                    >
                      Canale: {CHANNEL_META[selectedBooking.channel].label}
                    </span>
                    <span className="text-xs font-mono text-[#666158]">
                      {selectedBooking.id}
                    </span>
                  </div>

                  <h3 className="font-serif text-2xl font-medium text-[#1C1A17]">
                    {selectedBooking.guestName}
                  </h3>

                  <p className="text-xs text-[#4B4740]">
                    {suiteNameMap[selectedBooking.suiteId]}
                  </p>

                  <div className="p-3 bg-[#FAF9F6] border border-[#E6E2DA] text-xs space-y-1.5 tabular-nums">
                    <div className="flex justify-between">
                      <span className="text-[#666158]">Check-in</span>
                      <span className="font-mono font-medium">
                        {selectedBooking.checkIn}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#666158]">Check-out</span>
                      <span className="font-mono font-medium">
                        {selectedBooking.checkOut}
                      </span>
                    </div>
                    {selectedBooking.totalAmountEur > 0 && (
                      <div className="flex justify-between pt-1.5 border-t border-[#E6E2DA]">
                        <span className="text-[#666158]">Importo incassato</span>
                        <span className="font-semibold">
                          €{selectedBooking.totalAmountEur}
                        </span>
                      </div>
                    )}
                  </div>

                  {selectedBooking.guestEmail && (
                    <p className="text-xs text-[#666158]">
                      Email: {selectedBooking.guestEmail}
                    </p>
                  )}
                  {selectedBooking.externalUid && (
                    <p className="text-[11px] font-mono text-[#666158] break-all">
                      UID .ics: {selectedBooking.externalUid}
                    </p>
                  )}
                  {selectedBooking.notes && (
                    <p className="text-xs text-[#666158] leading-relaxed">
                      {selectedBooking.notes}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDeleteBooking(selectedBooking.id)}
                    className="w-full mt-2 py-2 px-3 border border-[#E7C6C0] text-[#B84A39] text-xs font-medium hover:bg-[#FBF0EE] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Rimuovi dal calendario
                  </button>
                </div>
              ) : (
                <p className="text-xs text-[#666158] mt-3 leading-relaxed">
                  Seleziona una prenotazione sul calendario per visualizzare il canale di origine (Airbnb, Booking.com, Sito Diretto), i dettagli ospite e l’eventuale UID `.ics`.
                </p>
              )}
            </div>

            <div className="border border-[#E6E2DA] bg-[#FFFFFF] p-6">
              <h3 className="font-serif text-xl font-medium text-[#1C1A17]">
                Blocca Date Manualmente
              </h3>
              <p className="text-xs text-[#666158] mt-1">
                I blocchi manuali chiudono il calendario pubblico e vengono esportati automaticamente nei feed `.ics` verso Airbnb e Booking.
              </p>

              <form onSubmit={handleCreateBlock} className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#4B4740] mb-1">
                    Suite
                  </label>
                  <select
                    value={blockSuiteId}
                    onChange={(e) => setBlockSuiteId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-[#D8D3C8]"
                  >
                    {suites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-[#4B4740] mb-1">
                      Dal
                    </label>
                    <input
                      type="date"
                      required
                      value={blockCheckIn}
                      onChange={(e) => setBlockCheckIn(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs font-mono bg-[#FAF9F6] border border-[#D8D3C8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#4B4740] mb-1">
                      Al (check-out)
                    </label>
                    <input
                      type="date"
                      required
                      value={blockCheckOut}
                      onChange={(e) => setBlockCheckOut(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs font-mono bg-[#FAF9F6] border border-[#D8D3C8]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4B4740] mb-1">
                    Motivo blocco
                  </label>
                  <input
                    type="text"
                    value={blockNotes}
                    onChange={(e) => setBlockNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-[#D8D3C8]"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-[#2C3E35] text-[#FAF9F6] text-xs font-medium hover:bg-[#1F2D26] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Aggiungi Blocco Host
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: .ICS CHANNEL SYNC + AUTO-SYNC */}
      {activeTab === 'ics' && (
        <div className="space-y-6">
          <div className="p-6 bg-[#F3F1EC] border border-[#E6E2DA]">
            <h2 className="font-serif text-2xl font-medium text-[#1C1A17]">
              Auto-Sync Intelligente & Collegamento Bidirezionale (.ics)
            </h2>
            <p className="text-sm text-[#4B4740] mt-2 leading-relaxed max-w-4xl">
              Una volta incollati i link <span className="font-mono">.ics</span> di Airbnb e Booking.com, il sistema attiva l’<strong>Auto-Sync Intelligente</strong>: ogni volta che un cliente visita il calendario per prenotare (se sono trascorsi almeno {integrationStatus?.autoSyncIntervalMinutes || 15} minuti dall’ultimo controllo), il server scarica in automatico gli aggiornamenti dai portali e li salva nel database prima di mostrare le date.
            </p>
          </div>

          <div className="space-y-6">
            {suites.map((suite) => {
              const outboundUrl = `${baseUrl}/api/ical/${suite.slug}.ics`;
              const draft = icsDrafts[suite.id] || {
                airbnbIcsUrl: '',
                bookingIcsUrl: '',
              };

              return (
                <div
                  key={suite.id}
                  className="border border-[#E6E2DA] bg-[#FFFFFF] p-6 space-y-6"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E6E2DA]">
                    <div>
                      <div className="text-xs text-[#666158]">
                        {suite.locationId.toUpperCase()} ·{' '}
                        {suite.status === 'open'
                          ? 'Aperta'
                          : `In Sviluppo (${suite.openingDateLabel || ''})`}
                      </div>
                      <h3 className="font-serif text-2xl font-medium text-[#1C1A17]">
                        {suite.name}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setRawIcsModalSuite(suite)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-[#D8D3C8] text-[#1C1A17] hover:bg-[#F3F1EC] cursor-pointer"
                      >
                        <FileCode2 className="w-3.5 h-3.5" />
                        Testa / Simula Import .ics
                      </button>
                      <button
                        type="button"
                        disabled={syncingSuiteId === suite.id}
                        onClick={() => handleSyncIcsNow(suite.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#2C3E35] text-[#FAF9F6] hover:bg-[#1F2D26] cursor-pointer disabled:opacity-60"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${
                            syncingSuiteId === suite.id ? 'animate-spin' : ''
                          }`}
                        />
                        Sincronizza Ora
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-[#FAF9F6] border border-[#E6E2DA]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold text-[#2C3E35] block">
                          1. Link .ics in Uscita (da copiare dentro Airbnb e Booking.com)
                        </span>
                        <p className="text-xs font-mono text-[#1C1A17] mt-1 break-all">
                          {outboundUrl}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyUrl(suite.id, outboundUrl)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-[#D8D3C8] bg-[#FFFFFF] hover:bg-[#F3F1EC] cursor-pointer"
                        >
                          {copiedKey === suite.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#2C3E35]" />
                              Copiato
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copia URL
                            </>
                          )}
                        </button>
                        <a
                          href={`/api/ical/${suite.slug}.ics`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-[#D8D3C8] bg-[#FFFFFF] hover:bg-[#F3F1EC]"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Apri .ics
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#B84A39] mb-1.5">
                        2a. Link .ics in Entrata da Airbnb
                      </label>
                      <input
                        type="url"
                        value={draft.airbnbIcsUrl}
                        onChange={(e) =>
                          setIcsDrafts((prev) => ({
                            ...prev,
                            [suite.id]: {
                              ...draft,
                              airbnbIcsUrl: e.target.value,
                            },
                          }))
                        }
                        placeholder="https://www.airbnb.it/calendar/ical/123456.ics?s=..."
                        className="w-full px-3 py-2 text-xs font-mono bg-[#FAF9F6] border border-[#D8D3C8] focus:outline-none focus:border-[#2C3E35]"
                      />
                      <p className="text-[11px] text-[#666158] mt-1">
                        Ultima ricezione Airbnb:{' '}
                        {suite.lastAirbnbSync
                          ? new Date(suite.lastAirbnbSync).toLocaleString('it-IT')
                          : 'Non ancora sincronizzato'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#1E4D7B] mb-1.5">
                        2b. Link .ics in Entrata da Booking.com
                      </label>
                      <input
                        type="url"
                        value={draft.bookingIcsUrl}
                        onChange={(e) =>
                          setIcsDrafts((prev) => ({
                            ...prev,
                            [suite.id]: {
                              ...draft,
                              bookingIcsUrl: e.target.value,
                            },
                          }))
                        }
                        placeholder="https://ical.booking.com/v1/export?t=..."
                        className="w-full px-3 py-2 text-xs font-mono bg-[#FAF9F6] border border-[#D8D3C8] focus:outline-none focus:border-[#2C3E35]"
                      />
                      <p className="text-[11px] text-[#666158] mt-1">
                        Ultima ricezione Booking:{' '}
                        {suite.lastBookingSync
                          ? new Date(suite.lastBookingSync).toLocaleString('it-IT')
                          : 'Non ancora sincronizzato'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <span className="text-xs text-[#666158]">
                      {suite.lastSyncSummary}
                      {suite.lastAutoSyncAt
                        ? ` · Ultimo controllo Auto-Sync: ${new Date(
                            suite.lastAutoSyncAt
                          ).toLocaleString('it-IT')}`
                        : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSaveIcsUrls(suite.id)}
                      className="px-4 py-2 text-xs font-medium border border-[#2C3E35] text-[#2C3E35] hover:bg-[#2C3E35] hover:text-[#FAF9F6] transition-colors cursor-pointer shrink-0"
                    >
                      Salva Link .ics
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: EDIT SUITE PRICING & INFO + PHOTO FOLDER GUIDE */}
      {activeTab === 'suites' && (
        <div className="space-y-6">
          <div className="p-5 bg-[#F3F1EC] border border-[#E6E2DA] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <FolderOpen className="w-5 h-5 text-[#2C3E35] shrink-0 mt-0.5" />
              <div className="text-xs text-[#3D3A34] space-y-1">
                <p className="font-semibold text-[#1C1A17]">
                  Cartella Foto JPEG & File Contenuti
                </p>
                <p>
                  Le foto definitive in formato <span className="font-mono">.jpg</span> vanno caricate nella cartella{' '}
                  <span className="font-mono font-semibold">{BRAND_INFO.cartellaFotoSpiegazione}</span>. I testi iniziali sono modificabili anche nel file{' '}
                  <span className="font-mono font-semibold">src/CONTENUTI_ALLOGGI.ts</span>.
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSaveMapUrl}
            className="p-5 bg-[#FFFFFF] border border-[#E6E2DA] space-y-3"
          >
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-[#2C3E35] shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-xs font-semibold text-[#1C1A17]">
                  Mappa Destinazioni (Google My Maps)
                </p>
                <p className="text-xs text-[#666158]">
                  Incolla il link della tua mappa Google My Maps (anche il link <span className="font-mono">/edit?mid=...</span>, il sito lo converte automaticamente). Ricorda su Google My Maps di impostare <span className="font-medium text-[#1C1A17]">Condividi → Chiunque abbia questo link può visualizzare</span>. Puoi modificarlo anche in <span className="font-mono">src/CONTENUTI_ALLOGGI.ts</span> alla voce <span className="font-mono">mappaMyMapsUrl</span>.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="url"
                value={mapUrlDraft}
                onChange={(e) => setMapUrlDraft(e.target.value)}
                placeholder="https://www.google.com/maps/d/edit?mid=..."
                className="flex-1 px-3 py-2 text-xs font-mono bg-[#FAF9F6] border border-[#D8D3C8]"
              />
              <button
                type="submit"
                disabled={savingMapUrl}
                className="px-4 py-2 bg-[#2C3E35] text-[#FAF9F6] text-xs font-medium hover:bg-[#1F2D26] transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                {savingMapUrl ? 'Salvataggio...' : 'Salva Link Mappa'}
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-4 space-y-3">
              {suites.map((suite) => {
                const isSelected = editingSuiteId === suite.id;
                const suitePhotos = FOTO_ALLOGGI[suite.id] || [];
                return (
                  <button
                    key={suite.id}
                    type="button"
                    onClick={() => handleSelectSuiteForEdit(suite)}
                    className={`w-full text-left p-5 border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#FFFFFF] border-[#2C3E35]'
                        : 'bg-[#F3F1EC] border-[#E6E2DA] hover:border-[#B8B1A3]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-[#666158]">
                      <span>{suite.locationId.toUpperCase()}</span>
                      <span
                        className={
                          suite.status === 'open'
                            ? 'font-semibold text-[#2C3E35]'
                            : 'font-semibold text-[#9A7B4F]'
                        }
                      >
                        {suite.status === 'open'
                          ? 'Aperta'
                          : suite.openingDateLabel || 'In Sviluppo'}
                      </span>
                    </div>
                    <div className="font-serif text-xl font-medium text-[#1C1A17] mt-1.5">
                      {suite.name}
                    </div>
                    <div className="text-xs text-[#4B4740] mt-2 font-mono tabular-nums">
                      €{suite.pricePerNight}/notte · Pulizia €{suite.cleaningFee} · Tassa €{suite.cityTaxPerNight}
                    </div>
                    <div className="text-[11px] font-mono text-[#666158] mt-2 truncate">
                      Foto: {suitePhotos[0] || 'n/d'}
                    </div>
                  </button>
                );
              })}
            </div>

            {suiteDraft && (
              <form
                onSubmit={handleSaveSuiteDetails}
                className="lg:col-span-8 border border-[#E6E2DA] bg-[#FFFFFF] p-6 sm:p-7 space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E6E2DA]">
                  <div>
                    <div className="text-xs text-[#666158]">
                      Modifica Tariffe e Contenuti Pubblici
                    </div>
                    <h2 className="font-serif text-2xl font-medium text-[#1C1A17] mt-0.5">
                      {suiteDraft.name}
                    </h2>
                  </div>

                  <button
                    type="submit"
                    disabled={savingSuite}
                    className="px-5 py-2.5 bg-[#2C3E35] text-[#FAF9F6] text-xs font-medium hover:bg-[#1F2D26] transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    {savingSuite ? 'Salvataggio...' : 'Salva Modifiche sul Sito'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#4B4740] mb-1">
                      Prezzo / notte (€)
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={suiteDraft.pricePerNight}
                      onChange={(e) =>
                        setSuiteDraft({ ...suiteDraft, pricePerNight: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#FAF9F6] border border-[#D8D3C8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#4B4740] mb-1">
                      Pulizia finale (€)
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={suiteDraft.cleaningFee}
                      onChange={(e) =>
                        setSuiteDraft({ ...suiteDraft, cleaningFee: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#FAF9F6] border border-[#D8D3C8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#4B4740] mb-1">
                      Tassa / notte (€)
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={suiteDraft.cityTaxPerNight}
                      onChange={(e) =>
                        setSuiteDraft({ ...suiteDraft, cityTaxPerNight: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#FAF9F6] border border-[#D8D3C8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#4B4740] mb-1">
                      Stato
                    </label>
                    <select
                      value={suiteDraft.status}
                      onChange={(e) =>
                        setSuiteDraft({
                          ...suiteDraft,
                          status: e.target.value as 'open' | 'development',
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#FAF9F6] border border-[#D8D3C8]"
                    >
                      <option value="open">Aperta</option>
                      <option value="development">In Sviluppo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#4B4740] mb-1">
                      Data apertura
                    </label>
                    <input
                      type="text"
                      value={suiteDraft.openingDateLabel}
                      placeholder="Es. Febbraio 2027"
                      onChange={(e) =>
                        setSuiteDraft({ ...suiteDraft, openingDateLabel: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#FAF9F6] border border-[#D8D3C8]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-2 border-t border-[#E6E2DA]">
                  <div>
                    <label className="block text-xs font-medium text-[#4B4740] mb-1">
                      Max Ospiti
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={suiteDraft.maxGuests}
                      onChange={(e) =>
                        setSuiteDraft({ ...suiteDraft, maxGuests: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#FAF9F6] border border-[#D8D3C8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#4B4740] mb-1">
                      Superficie (m²)
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={suiteDraft.sizeSqm}
                      onChange={(e) =>
                        setSuiteDraft({ ...suiteDraft, sizeSqm: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#FAF9F6] border border-[#D8D3C8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#4B4740] mb-1">
                      Camere
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={suiteDraft.bedrooms}
                      onChange={(e) =>
                        setSuiteDraft({ ...suiteDraft, bedrooms: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#FAF9F6] border border-[#D8D3C8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#4B4740] mb-1">
                      Bagni
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={suiteDraft.bathrooms}
                      onChange={(e) =>
                        setSuiteDraft({ ...suiteDraft, bathrooms: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#FAF9F6] border border-[#D8D3C8]"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-medium text-[#4B4740] mb-1">
                      Piano
                    </label>
                    <input
                      type="text"
                      value={suiteDraft.floor}
                      onChange={(e) => setSuiteDraft({ ...suiteDraft, floor: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-[#FAF9F6] border border-[#D8D3C8]"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-2 border-t border-[#E6E2DA]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#4B4740] mb-1">
                        Nome Suite
                      </label>
                      <input
                        type="text"
                        required
                        value={suiteDraft.name}
                        onChange={(e) => setSuiteDraft({ ...suiteDraft, name: e.target.value })}
                        className="w-full px-3 py-2 text-sm bg-[#FAF9F6] border border-[#D8D3C8]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#4B4740] mb-1">
                        Sottotitolo breve
                      </label>
                      <input
                        type="text"
                        value={suiteDraft.subtitle}
                        onChange={(e) =>
                          setSuiteDraft({ ...suiteDraft, subtitle: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm bg-[#FAF9F6] border border-[#D8D3C8]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#4B4740] mb-1">
                      Descrizione principale
                    </label>
                    <textarea
                      rows={3}
                      value={suiteDraft.description}
                      onChange={(e) =>
                        setSuiteDraft({ ...suiteDraft, description: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#FAF9F6] border border-[#D8D3C8]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#4B4740] mb-1">
                      Note di Design & Materiali
                    </label>
                    <textarea
                      rows={2}
                      value={suiteDraft.designNotes}
                      onChange={(e) =>
                        setSuiteDraft({ ...suiteDraft, designNotes: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#FAF9F6] border border-[#D8D3C8]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#4B4740] mb-1">
                        Dotazioni & Comfort (una per riga)
                      </label>
                      <textarea
                        rows={5}
                        value={suiteDraft.amenitiesText}
                        onChange={(e) =>
                          setSuiteDraft({ ...suiteDraft, amenitiesText: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-[#D8D3C8]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#4B4740] mb-1">
                        Regole della Casa (una per riga)
                      </label>
                      <textarea
                        rows={5}
                        value={suiteDraft.houseRulesText}
                        onChange={(e) =>
                          setSuiteDraft({ ...suiteDraft, houseRulesText: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-[#D8D3C8]"
                      />
                    </div>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: LEDGER, STRIPE STATUS & WAITLIST */}
      {activeTab === 'ledger' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-[#E6E2DA] bg-[#FFFFFF] p-6 flex flex-col justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-[#666158]">
                  Infrastruttura Pagamenti
                </div>
                <h3 className="font-serif text-2xl font-medium text-[#1C1A17] mt-1">
                  Stato Integrazione Stripe Checkout
                </h3>
                <p className="text-xs text-[#666158] mt-2 leading-relaxed">
                  {integrationStatus?.stripeConfigured
                    ? 'STRIPE_SECRET_KEY rilevata nel backend: il sito crea sessioni Stripe Checkout reali per incassi con carta di credito.'
                    : 'Al momento è attiva la modalità Sandbox Test. Per incassi reali aggiungi STRIPE_SECRET_KEY su Cloudflare.'}
                </p>
              </div>
              <div className="px-4 py-2 border border-[#D8D3C8] bg-[#FAF9F6] text-xs font-mono text-[#1C1A17] self-start">
                {integrationStatus?.stripeConfigured
                  ? 'Stripe API: Attivo'
                  : 'Stripe: Modalità Prova (Sandbox)'}
              </div>
            </div>

            <div className="border border-[#E6E2DA] bg-[#FFFFFF] p-6 flex flex-col justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-[#666158]">
                  File Modello: <span className="font-mono">src/EMAIL_CONFERMA.ts</span>
                </div>
                <h3 className="font-serif text-2xl font-medium text-[#1C1A17] mt-1">
                  Email Automatiche di Conferma
                </h3>
                <p className="text-xs text-[#666158] mt-2 leading-relaxed">
                  {integrationStatus?.emailConfigured
                    ? 'Invio automatico attivo: ogni prenotazione confermata spedisce l’email HTML all’ospite e la notifica all’Host.'
                    : 'Il file src/EMAIL_CONFERMA.ts genera già l’email completa. Aggiungi GMAIL_WEBHOOK_URL su Cloudflare (gratis, senza comprare alcun dominio!) per inviarla a qualsiasi ospite.'}
                </p>
              </div>
              <div className="px-4 py-2 border border-[#D8D3C8] bg-[#FAF9F6] text-xs font-mono text-[#1C1A17] self-start">
                {integrationStatus?.emailConfigured
                  ? 'Invio Email: Attivo'
                  : 'Email: Solo Anteprima (manca GMAIL_WEBHOOK_URL)'}
              </div>
            </div>
          </div>

          <div className="border border-[#E6E2DA] bg-[#FFFFFF] overflow-x-auto">
            <div className="p-5 border-b border-[#E6E2DA]">
              <h3 className="font-serif text-2xl font-medium text-[#1C1A17]">
                Registro Completo Prenotazioni
              </h3>
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E6E2DA] bg-[#FAF9F6] text-[#666158]">
                  <th className="py-3 px-4 font-medium">ID</th>
                  <th className="py-3 px-4 font-medium">Suite</th>
                  <th className="py-3 px-4 font-medium">Canale</th>
                  <th className="py-3 px-4 font-medium">Ospite / Nota</th>
                  <th className="py-3 px-4 font-medium">Check-in</th>
                  <th className="py-3 px-4 font-medium">Check-out</th>
                  <th className="py-3 px-4 font-medium text-right">Importo</th>
                  <th className="py-3 px-4 font-medium text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E2DA]">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-[#FAF9F6]">
                    <td className="py-3 px-4 font-mono text-[#4B4740]">{b.id}</td>
                    <td className="py-3 px-4 font-medium text-[#1C1A17]">
                      {suiteNameMap[b.suiteId] || b.suiteId}
                    </td>
                    <td className={`py-3 px-4 font-semibold ${CHANNEL_META[b.channel].badgeClass}`}>
                      {CHANNEL_META[b.channel].label}
                    </td>
                    <td className="py-3 px-4 text-[#1C1A17]">
                      <div>{b.guestName}</div>
                      {b.guestEmail && (
                        <div className="text-[11px] text-[#666158]">{b.guestEmail}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums">{b.checkIn}</td>
                    <td className="py-3 px-4 font-mono tabular-nums">{b.checkOut}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {b.totalAmountEur > 0 ? `€${b.totalAmountEur}` : 'Esterno'}
                    </td>
                    <td className="py-3 px-4 text-right space-x-3 whitespace-nowrap">
                      {b.guestEmail && (
                        <button
                          type="button"
                          onClick={() => setEmailPreviewBooking(b)}
                          className="text-[#2C3E35] font-medium hover:underline cursor-pointer"
                        >
                          {b.confirmationEmailSentAt ? 'Email Inviata' : 'Vedi/Invia Email'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteBooking(b.id)}
                        className="text-[#B84A39] hover:underline cursor-pointer"
                      >
                        Elimina
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border border-[#E6E2DA] bg-[#FFFFFF] overflow-x-auto">
            <div className="p-5 border-b border-[#E6E2DA]">
              <h3 className="font-serif text-2xl font-medium text-[#1C1A17]">
                Lista d’Attesa Nuove Aperture (Ibiza & Milano)
              </h3>
            </div>
            {waitlist.length === 0 ? (
              <div className="p-6 text-xs text-[#666158]">
                Nessun iscritto alla lista d’attesa al momento. Le richieste inviate dalle schede di Ibiza e Milano appariranno qui.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E6E2DA] bg-[#FAF9F6] text-[#666158]">
                    <th className="py-3 px-4 font-medium">Città</th>
                    <th className="py-3 px-4 font-medium">Nome</th>
                    <th className="py-3 px-4 font-medium">Email</th>
                    <th className="py-3 px-4 font-medium">Periodo richiesto</th>
                    <th className="py-3 px-4 font-medium">Data iscrizione</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E2DA]">
                  {waitlist.map((w) => (
                    <tr key={w.id}>
                      <td className="py-3 px-4 uppercase font-mono">{w.locationId}</td>
                      <td className="py-3 px-4 font-medium">{w.name}</td>
                      <td className="py-3 px-4">{w.email}</td>
                      <td className="py-3 px-4">{w.preferredPeriod || '—'}</td>
                      <td className="py-3 px-4 font-mono">
                        {new Date(w.createdAt).toLocaleDateString('it-IT')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {rawIcsModalSuite && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[#D8D3C8] max-w-xl w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#E6E2DA]">
              <div>
                <div className="text-xs text-[#666158]">Verifica Parser RFC 5545</div>
                <h4 className="font-serif text-2xl font-medium text-[#1C1A17]">
                  Importa o Simula Feed .ics — {rawIcsModalSuite.name}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setRawIcsModalSuite(null)}
                className="text-xs text-[#666158] hover:text-[#1C1A17] cursor-pointer"
              >
                Chiudi
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRawIcsChannel('airbnb')}
                className={`px-3.5 py-2 text-xs font-medium border cursor-pointer ${
                  rawIcsChannel === 'airbnb'
                    ? 'bg-[#FBF0EE] border-[#B84A39] text-[#8E3528]'
                    : 'bg-[#FAF9F6] border-[#D8D3C8] text-[#4B4740]'
                }`}
              >
                Canale Airbnb (.ics)
              </button>
              <button
                type="button"
                onClick={() => setRawIcsChannel('booking')}
                className={`px-3.5 py-2 text-xs font-medium border cursor-pointer ${
                  rawIcsChannel === 'booking'
                    ? 'bg-[#EDF3F8] border-[#1E4D7B] text-[#173D63]'
                    : 'bg-[#FAF9F6] border-[#D8D3C8] text-[#4B4740]'
                }`}
              >
                Canale Booking.com (.ics)
              </button>
            </div>

            <div className="p-4 bg-[#FAF9F6] border border-[#E6E2DA] space-y-3">
              <div className="text-xs font-medium text-[#1C1A17]">
                Opzione A — Genera e importa un evento .ics simulato
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="date"
                  value={sampleCheckIn}
                  onChange={(e) => setSampleCheckIn(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-mono bg-[#FFFFFF] border border-[#D8D3C8]"
                />
                <input
                  type="date"
                  value={sampleCheckOut}
                  onChange={(e) => setSampleCheckOut(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-mono bg-[#FFFFFF] border border-[#D8D3C8]"
                />
                <input
                  type="text"
                  value={sampleGuest}
                  onChange={(e) => setSampleGuest(e.target.value)}
                  placeholder="Nome ospite"
                  className="px-2.5 py-1.5 text-xs bg-[#FFFFFF] border border-[#D8D3C8]"
                />
              </div>
              <button
                type="button"
                onClick={() => handleImportSampleOrRaw(true)}
                className="px-4 py-2 bg-[#2C3E35] text-[#FAF9F6] text-xs font-medium hover:bg-[#1F2D26] cursor-pointer"
              >
                Esegui Test Parser su Calendario
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#1C1A17]">
                Opzione B — Incolla il contenuto grezzo di un file .ics (BEGIN:VCALENDAR...)
              </label>
              <textarea
                rows={5}
                value={rawIcsText}
                onChange={(e) => setRawIcsText(e.target.value)}
                placeholder={'BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20261218\nDTEND;VALUE=DATE:20261221\nSUMMARY:Reserved\nEND:VEVENT\nEND:VCALENDAR'}
                className="w-full p-3 text-xs font-mono bg-[#FAF9F6] border border-[#D8D3C8]"
              />
              <button
                type="button"
                disabled={!rawIcsText.trim()}
                onClick={() => handleImportSampleOrRaw(false)}
                className="px-4 py-2 border border-[#2C3E35] text-[#2C3E35] text-xs font-medium hover:bg-[#2C3E35] hover:text-[#FAF9F6] disabled:opacity-40 cursor-pointer"
              >
                Analizza e Importa Testo .ics
              </button>
            </div>
          </div>
        </div>
      )}

      {emailPreviewBooking && (() => {
        const suiteObj = suites.find((s) => s.id === emailPreviewBooking.suiteId);
        if (!suiteObj) return null;
        const preview = generaEmailConferma({
          booking: emailPreviewBooking,
          suite: suiteObj,
        });
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-[#FFFFFF] border border-[#D8D3C8] max-w-2xl w-full shadow-xl flex flex-col max-h-[90vh]">
              <div className="p-4 border-b border-[#E6E2DA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-mono text-[#666158]">
                    Destinatario: {emailPreviewBooking.guestEmail} · Modello: src/EMAIL_CONFERMA.ts
                  </div>
                  <div className="text-sm font-medium text-[#1C1A17] mt-0.5">
                    {preview.subject}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    disabled={sendingEmailId === emailPreviewBooking.id}
                    onClick={() => handleSendConfirmationEmail(emailPreviewBooking.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#2C3E35] text-[#FAF9F6] text-xs font-medium hover:bg-[#1F2D26] cursor-pointer disabled:opacity-60"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {sendingEmailId === emailPreviewBooking.id
                      ? 'Invio...'
                      : emailPreviewBooking.confirmationEmailSentAt
                      ? 'Reinvia Email'
                      : 'Invia Email Ora'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailPreviewBooking(null)}
                    className="text-xs text-[#666158] hover:text-[#1C1A17] cursor-pointer"
                  >
                    Chiudi
                  </button>
                </div>
              </div>
              <iframe
                title="Anteprima Email Conferma Host"
                srcDoc={preview.html}
                className="w-full h-[500px] border-0 bg-[#FAF9F6]"
              />
            </div>
          </div>
        );
      })()}
    </section>
  );
}
