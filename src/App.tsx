import { useCallback, useEffect, useMemo, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { ArrowRight, MapPin, Menu, X } from 'lucide-react';
import { AreaHost } from './components/AreaHost';
import { DettaglioSuite, ElencoSuite, FotoSicura } from './components/CatalogoSuite';
import { MappaDestinazioni } from './components/MappaDestinazioni';
import { BRAND_INFO, FOTO_ALLOGGI, FOTO_GENERALI } from './CONTENUTI_ALLOGGI';
import type { Suite, SuiteLocation } from './types';

type AppView = 'home' | 'suites' | 'suite-detail' | 'host';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export default function App() {
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const handler = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  const content = <ModoStaysShell quotaExceeded={quotaExceeded} />;

  if (!MAPS_API_KEY) {
    return content;
  }

  return (
    <APIProvider
      apiKey={MAPS_API_KEY}
      libraries={['marker', 'places']}
      language="it"
      region="IT"
    >
      {content}
    </APIProvider>
  );
}

function ModoStaysShell({ quotaExceeded }: { quotaExceeded: boolean }) {
  const [view, setView] = useState<AppView>('home');
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null);
  const [suitesLocationFilter, setSuitesLocationFilter] = useState<string>('all');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [locations, setLocations] = useState<SuiteLocation[]>([]);
  const [suites, setSuites] = useState<Suite[]>([]);
  const [mapEmbedUrl, setMapEmbedUrl] = useState<string>(BRAND_INFO.mappaMyMapsUrl);
  const [loadingData, setLoadingData] = useState(true);
  const [stripeReturnNotice, setStripeReturnNotice] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const successId = params.get('bookingSuccess');
    const cancelledId = params.get('bookingCancelled');
    const suiteParam = params.get('suite');

    if (successId) {
      setStripeReturnNotice(
        `Pagamento Stripe completato per la prenotazione ${successId}. Le date sono state confermate sul calendario.`
      );
      if (suiteParam) {
        setSelectedSuiteId(suiteParam);
        setView('suite-detail');
      }
      window.history.replaceState({}, '', window.location.pathname);
    } else if (cancelledId) {
      setStripeReturnNotice(
        `Procedura di pagamento annullata per la richiesta ${cancelledId}. Puoi selezionare nuove date quando desideri.`
      );
      if (suiteParam) {
        setSelectedSuiteId(suiteParam);
        setView('suite-detail');
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    setLoadingData(true);
    try {
      const [locRes, suiteRes] = await Promise.all([
        fetch('/api/locations'),
        fetch('/api/suites'),
      ]);
      if (locRes.ok) {
        const locJson = (await locRes.json()) as {
          locations: SuiteLocation[];
          mapEmbedUrl?: string;
        };
        setLocations(locJson.locations || []);
        if (locJson.mapEmbedUrl !== undefined) {
          setMapEmbedUrl(locJson.mapEmbedUrl);
        }
      }
      if (suiteRes.ok) {
        const suiteJson = (await suiteRes.json()) as { suites: Suite[] };
        setSuites(suiteJson.suites || []);
      }
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const navigateTo = useCallback((nextView: AppView, scrollTop = true) => {
    setView(nextView);
    setMobileMenuOpen(false);
    if (scrollTop) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const openSuiteDetail = useCallback((suiteId: string) => {
    setSelectedSuiteId(suiteId);
    setView('suite-detail');
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSelectLocationAction = useCallback(
    (locationId: string) => {
      if (locationId === 'milano' || locationId === 'ibiza') {
        const devSuite = suites.find((s) => s.locationId === locationId);
        if (devSuite) {
          openSuiteDetail(devSuite.id);
          return;
        }
      }
      setSuitesLocationFilter(locationId);
      setView('suites');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [suites, openSuiteDetail]
  );

  const handleScrollToDestinations = useCallback(() => {
    setMobileMenuOpen(false);
    if (view !== 'home') {
      setView('home');
      setTimeout(() => {
        document
          .getElementById('destinazioni')
          ?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    } else {
      document
        .getElementById('destinazioni')
        ?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [view]);

  const activeSuite = useMemo(
    () => suites.find((s) => s.id === selectedSuiteId) || null,
    [suites, selectedSuiteId]
  );

  const locationMap = useMemo(() => {
    const rec: Record<string, SuiteLocation> = {};
    for (const loc of locations) rec[loc.id] = loc;
    return rec;
  }, [locations]);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#1C1A17]">
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* 3-Zone Top Bar Contract */}
      <header className="border-b border-[#E6E2DA] bg-[#FAF9F6]">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => navigateTo('home')}
            className="font-serif text-2xl font-semibold tracking-tight text-[#1C1A17] whitespace-nowrap shrink-0 cursor-pointer"
          >
            {BRAND_INFO.nome}
          </button>

          <nav
            aria-label="Navigazione principale"
            className="hidden md:flex items-center gap-8 text-sm font-medium text-[#666158]"
          >
            <button
              type="button"
              onClick={() => navigateTo('home')}
              className={`hover:text-[#1C1A17] transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
                view === 'home'
                  ? 'text-[#1C1A17] border-b border-[#2C3E35]'
                  : 'border-b border-transparent'
              }`}
            >
              Collezione
            </button>
            <button
              type="button"
              onClick={handleScrollToDestinations}
              className="hover:text-[#1C1A17] transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 border-b border-transparent"
            >
              Destinazioni
            </button>
            <button
              type="button"
              onClick={() => {
                setSuitesLocationFilter('all');
                navigateTo('suites');
              }}
              className={`hover:text-[#1C1A17] transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
                view === 'suites' || view === 'suite-detail'
                  ? 'text-[#1C1A17] border-b border-[#2C3E35]'
                  : 'border-b border-transparent'
              }`}
            >
              Le Suite
            </button>
            <button
              type="button"
              onClick={() => navigateTo('host')}
              className={`hover:text-[#1C1A17] transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
                view === 'host'
                  ? 'text-[#1C1A17] border-b border-[#2C3E35]'
                  : 'border-b border-transparent'
              }`}
            >
              Area Host
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                setSuitesLocationFilter('nice');
                navigateTo('suites');
              }}
              className="hidden sm:inline-flex px-5 py-2.5 text-xs font-medium text-[#FAF9F6] bg-[#2C3E35] hover:bg-[#1F2D26] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Prenota Ora
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Apri menu"
              className="md:hidden p-2 text-[#1C1A17] border border-[#E6E2DA] cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E6E2DA] bg-[#FFFFFF] px-6 py-4 space-y-3 text-sm">
            <button
              type="button"
              onClick={() => navigateTo('home')}
              className="block w-full text-left py-1.5 text-[#1C1A17]"
            >
              Collezione
            </button>
            <button
              type="button"
              onClick={handleScrollToDestinations}
              className="block w-full text-left py-1.5 text-[#1C1A17]"
            >
              Destinazioni
            </button>
            <button
              type="button"
              onClick={() => {
                setSuitesLocationFilter('all');
                navigateTo('suites');
              }}
              className="block w-full text-left py-1.5 text-[#1C1A17]"
            >
              Le Suite
            </button>
            <button
              type="button"
              onClick={() => navigateTo('host')}
              className="block w-full text-left py-1.5 text-[#1C1A17]"
            >
              Area Host
            </button>
            <button
              type="button"
              onClick={() => {
                setSuitesLocationFilter('nice');
                navigateTo('suites');
              }}
              className="w-full py-2.5 bg-[#2C3E35] text-[#FAF9F6] text-xs font-medium mt-2"
            >
              Prenota Ora
            </button>
          </div>
        )}
      </header>

      {stripeReturnNotice && (
        <div className="bg-[#E9EFEA] border-b border-[#C6D5CA] text-[#1F2D26] px-6 py-3 text-xs flex items-center justify-between gap-4">
          <span>{stripeReturnNotice}</span>
          <button
            type="button"
            onClick={() => setStripeReturnNotice(null)}
            className="underline cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      )}

      <main className="flex-1">
        {view === 'home' && (
          <>
            {/* 1. Hero Section */}
            <section className="max-w-7xl mx-auto px-6 pt-10 pb-14 lg:pt-14 lg:pb-16">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
                <div className="lg:col-span-5 flex flex-col justify-between py-2">
                  <div>
                    <p className="text-xs font-medium text-[#2C3E35] tracking-wide">
                      {BRAND_INFO.vision}
                    </p>
                    <h1
                      className="font-serif font-medium text-[#1C1A17] mt-4 leading-[1.06]"
                      style={{
                        fontSize: 'clamp(2.4rem, 4vw, 3.7rem)',
                        textWrap: 'balance',
                      }}
                    >
                      {BRAND_INFO.titoloHero}
                    </h1>
                    <p className="text-base text-[#4B4740] mt-6 leading-relaxed max-w-md">
                      {BRAND_INFO.introduzioneHero}
                    </p>
                  </div>

                  <div className="mt-8 flex flex-wrap items-center gap-6">
                    <button
                      type="button"
                      onClick={() => {
                        setSuitesLocationFilter('all');
                        navigateTo('suites');
                      }}
                      className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#2C3E35] text-[#FAF9F6] text-sm font-medium hover:bg-[#1F2D26] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Esplora le Suite
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleScrollToDestinations}
                      className="text-sm font-medium text-[#1C1A17] hover:text-[#2C3E35] underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Vedi Mappa e Città
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-7 border border-[#E6E2DA] bg-[#F3F1EC] overflow-hidden min-h-[320px] lg:min-h-[480px]">
                  <FotoSicura
                    src={FOTO_GENERALI.heroPrincipale}
                    alt={`${BRAND_INFO.nome} — Dimora a Nizza`}
                    fallbackTitle={BRAND_INFO.nome}
                    className="w-full h-full lg:h-full object-cover"
                  />
                </div>
              </div>

              {/* 4-Column Architectural Strip */}
              <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-[#E6E2DA] bg-[#FFFFFF] divide-y sm:divide-y-0 sm:divide-x divide-[#E6E2DA]">
                <div className="p-5">
                  <div className="text-xs text-[#2C3E35] font-semibold">
                    Nizza · Aperta
                  </div>
                  <div className="font-serif text-xl text-[#1C1A17] mt-1">
                    Boulevard Carlone, 35
                  </div>
                  <div className="text-xs text-[#666158] mt-1">
                    2 suite prenotabili ora
                  </div>
                </div>
                <div className="p-5">
                  <div className="text-xs text-[#9A7B4F] font-semibold">
                    Ibiza · In Sviluppo
                  </div>
                  <div className="font-serif text-xl text-[#1C1A17] mt-1">
                    Apertura Febbraio 2027
                  </div>
                  <div className="text-xs text-[#666158] mt-1">
                    Passeig de Vara de Rey · Eivissa
                  </div>
                </div>
                <div className="p-5">
                  <div className="text-xs text-[#9A7B4F] font-semibold">
                    Milano · In Sviluppo
                  </div>
                  <div className="font-serif text-xl text-[#1C1A17] mt-1">
                    Apertura Agosto 2027
                  </div>
                  <div className="text-xs text-[#666158] mt-1">
                    Viale Beatrice d’Este, 7
                  </div>
                </div>
                <div className="p-5">
                  <div className="text-xs text-[#666158] font-medium">
                    Prenotazioni & Canali
                  </div>
                  <div className="font-serif text-xl text-[#1C1A17] mt-1">
                    Stripe · Airbnb · Booking
                  </div>
                  <div className="text-xs text-[#666158] mt-1">
                    Auto-Sync iCal (.ics) intelligente
                  </div>
                </div>
              </div>
            </section>

            {/* 2. L'Anima dei Luoghi */}
            <section className="border-t border-[#E6E2DA] bg-[#F3F1EC]/70 py-16">
              <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-5 aspect-[4/3] border border-[#E6E2DA] bg-[#FFFFFF] overflow-hidden">
                  <FotoSicura
                    src={FOTO_GENERALI.dettaglioOspitalita}
                    alt="Dettaglio ospitalità Modo Stays su pietra naturale"
                    fallbackTitle={BRAND_INFO.nome}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="lg:col-span-7 space-y-8">
                  <div>
                    <p className="text-xs text-[#666158] font-medium">
                      {BRAND_INFO.vision}
                    </p>
                    <h2 className="font-serif text-3xl sm:text-4xl font-medium text-[#1C1A17] mt-2 leading-tight">
                      Leggerezza mediterranea, calore balearico e design milanese.
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-[#DFDAD0]">
                    <div>
                      <h3 className="font-serif text-xl font-medium text-[#1C1A17]">
                        01. Nizza — Riviera
                      </h3>
                      <p className="text-xs sm:text-sm text-[#4B4740] mt-2 leading-relaxed">
                        Su Boulevard Carlone 35, lino naturale e rovere chiaro incontrano la brezza della Promenade des Anglais. Aperta tutto l’anno.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-serif text-xl font-medium text-[#1C1A17]">
                        02. Ibiza — Feb 2027
                      </h3>
                      <p className="text-xs sm:text-sm text-[#4B4740] mt-2 leading-relaxed">
                        Architettura in calce bianca, legno di sabina e quiete mediterranea nel cuore di Eivissa. Apertura a febbraio 2027.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-serif text-xl font-medium text-[#1C1A17]">
                        03. Milano — Ago 2027
                      </h3>
                      <p className="text-xs sm:text-sm text-[#4B4740] mt-2 leading-relaxed">
                        In Viale Beatrice d’Este 7, pietra travertino e noce canaletto affacciati su una corte interna silenziosa. Apertura ad agosto 2027.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. Interactive Locations Map */}
            <section
              id="destinazioni"
              className="max-w-7xl mx-auto px-6 py-16 space-y-8 border-t border-[#E6E2DA]"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <p className="text-xs text-[#666158] font-medium">
                    Geografia Modo Stays
                  </p>
                  <h2 className="font-serif text-3xl sm:text-4xl font-medium text-[#1C1A17] mt-1.5">
                    Le Nostre Destinazioni sulla Mappa
                  </h2>
                </div>
                <p className="text-sm text-[#666158] max-w-md">
                  Seleziona una città o clicca sui pin per vedere l’indirizzo esatto, la data di apertura e gli appartamenti collegati.
                </p>
              </div>

              {loadingData ? (
                <div className="h-[460px] bg-[#F3F1EC] border border-[#E6E2DA] flex items-center justify-center text-sm text-[#666158]">
                  Caricamento destinazioni...
                </div>
              ) : (
                <MappaDestinazioni
                  locations={locations}
                  hasApiKey={Boolean(MAPS_API_KEY)}
                  mapEmbedUrl={mapEmbedUrl}
                  onSelectLocationAction={handleSelectLocationAction}
                />
              )}
            </section>

            {/* 4. Featured Suites Preview */}
            <section className="border-t border-[#E6E2DA] bg-[#FFFFFF] py-16">
              <div className="max-w-7xl mx-auto px-6 space-y-10">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    <p className="text-xs text-[#666158] font-medium">
                      Collezione di Appartamenti & Suite
                    </p>
                    <h2 className="font-serif text-3xl sm:text-4xl font-medium text-[#1C1A17] mt-1.5">
                      Esplora le Suite
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSuitesLocationFilter('all');
                      navigateTo('suites');
                    }}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2C3E35] hover:text-[#1F2D26] underline underline-offset-4 cursor-pointer"
                  >
                    Vedi tutte le suite
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {suites.map((suite) => {
                    const loc = locationMap[suite.locationId];
                    const img = FOTO_ALLOGGI[suite.id]?.[0] || '';
                    const isOpen = suite.status === 'open';
                    const devLabel = suite.openingDateLabel
                      ? `Apertura ${suite.openingDateLabel}`
                      : 'In Sviluppo';

                    return (
                      <article
                        key={suite.id}
                        onClick={() => openSuiteDetail(suite.id)}
                        className="group border border-[#E6E2DA] bg-[#FAF9F6] flex flex-col cursor-pointer hover:border-[#2C3E35] transition-colors"
                      >
                        <div className="aspect-[4/3] overflow-hidden bg-[#F3F1EC]">
                          <FotoSicura
                            src={img}
                            alt={suite.name}
                            fallbackTitle={suite.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          />
                        </div>
                        <div className="p-5 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2 text-xs text-[#666158]">
                              <span>{loc?.city || suite.locationId}</span>
                              <span aria-hidden="true">·</span>
                              <span
                                className={
                                  isOpen
                                    ? 'font-semibold text-[#2C3E35]'
                                    : 'font-semibold text-[#9A7B4F]'
                                }
                              >
                                {isOpen ? 'Aperta' : devLabel}
                              </span>
                            </div>
                            <h3 className="font-serif text-xl font-medium text-[#1C1A17] mt-2">
                              {suite.name}
                            </h3>
                            <p className="text-xs text-[#666158] mt-1 flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              <span>{loc?.address}</span>
                            </p>
                          </div>

                          <div className="mt-5 pt-3.5 border-t border-[#E6E2DA] flex items-center justify-between text-xs">
                            <span className="tabular-nums text-[#3D3A34]">
                              <strong className="font-serif text-lg font-medium text-[#1C1A17]">
                                €{suite.pricePerNight}
                              </strong>{' '}
                              / notte
                            </span>
                            <span className="font-semibold text-[#2C3E35] inline-flex items-center gap-1">
                              {isOpen ? 'Prenota' : 'Scopri'}
                              <ArrowRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </section>
          </>
        )}

        {view === 'suites' && (
          <ElencoSuite
            suites={suites}
            locations={locations}
            initialLocationFilter={suitesLocationFilter}
            onSelectSuite={openSuiteDetail}
          />
        )}

        {view === 'suite-detail' && activeSuite && (
          <DettaglioSuite
            suite={activeSuite}
            location={locationMap[activeSuite.locationId]}
            onBack={() => navigateTo('suites')}
          />
        )}

        {view === 'host' && <AreaHost onCatalogUpdated={loadCatalog} />}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-[#E6E2DA] bg-[#FAF9F6] mt-16">
        <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-12 gap-8 text-xs text-[#666158]">
          <div className="md:col-span-5 space-y-2">
            <div className="font-serif text-2xl font-medium text-[#1C1A17]">
              {BRAND_INFO.nome}
            </div>
            <p className="text-[#2C3E35] font-medium">{BRAND_INFO.vision}</p>
            <p className="leading-relaxed max-w-sm">
              Appartamenti selezionati in Europa. Prenotazioni dirette con disponibilità sincronizzata verso Airbnb e Booking.com tramite feed iCal (<span className="font-mono">.ics</span>).
            </p>
          </div>

          <div className="md:col-span-4 space-y-1.5">
            <div className="font-semibold text-[#1C1A17]">Indirizzi</div>
            <p>Nizza (Aperta) — Boulevard Carlone, 35 · 06000 Nice, Francia</p>
            <p>Ibiza (Febbraio 2027) — Passeig de Vara de Rey · 07800 Eivissa</p>
            <p>Milano (Agosto 2027) — Viale Beatrice d’Este, 7 · 20122 Milano</p>
          </div>

          <div className="md:col-span-3 flex flex-col md:items-end gap-2">
            <div className="font-semibold text-[#1C1A17]">Navigazione</div>
            <button
              type="button"
              onClick={() => navigateTo('suites')}
              className="hover:text-[#1C1A17] cursor-pointer"
            >
              Le Nostre Suite
            </button>
            <button
              type="button"
              onClick={handleScrollToDestinations}
              className="hover:text-[#1C1A17] cursor-pointer"
            >
              Mappa Destinazioni
            </button>
            <button
              type="button"
              onClick={() => navigateTo('host')}
              className="hover:text-[#1C1A17] cursor-pointer"
            >
              Area Host & Feed .ics
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
