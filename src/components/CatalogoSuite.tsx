import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, Check, MapPin } from 'lucide-react';
import { FOTO_ALLOGGI } from '../CONTENUTI_ALLOGGI';
import type { Suite, SuiteLocation } from '../types';
import { CalendarioPrenotazione } from './CalendarioPrenotazione';

interface FotoSicuraProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function FotoSicura({
  src,
  alt,
  className = '',
  fallbackTitle,
}: FotoSicuraProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#F3F1EC] via-[#EAE6DD] to-[#E2DDD2] text-[#666158] p-6 text-center ${className}`}
      >
        <Building2 className="w-7 h-7 stroke-[1.25] mb-2 text-[#8A8275]" />
        <span className="font-serif text-base text-[#1C1A17]">
          {fallbackTitle || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setHasError(true)}
      className={className}
    />
  );
}

interface ElencoSuiteProps {
  suites: Suite[];
  locations: SuiteLocation[];
  initialLocationFilter?: string;
  onSelectSuite: (suiteId: string) => void;
}

export function ElencoSuite({
  suites,
  locations,
  initialLocationFilter = 'all',
  onSelectSuite,
}: ElencoSuiteProps) {
  const [locationFilter, setLocationFilter] = useState<string>(initialLocationFilter);

  useEffect(() => {
    setLocationFilter(initialLocationFilter);
  }, [initialLocationFilter]);

  const locationMap: Record<string, SuiteLocation> = {};
  for (const l of locations) {
    locationMap[l.id] = l;
  }

  const filteredSuites = suites.filter((s) =>
    locationFilter === 'all' ? true : s.locationId === locationFilter
  );

  return (
    <section className="max-w-7xl mx-auto px-6 py-14 space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-[#E6E2DA]">
        <div className="max-w-2xl">
          <div className="text-xs text-[#666158] mb-2">
            Modo Stays · Francia, Spagna e Italia
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl font-medium text-[#1C1A17] leading-[1.1]">
            Le Nostre Suite
          </h1>
          <p className="text-sm sm:text-base text-[#666158] mt-3 leading-relaxed">
            Appartamenti progettati con cura in posizioni privilegiate. Seleziona una dimora per esplorare le fotografie, i dettagli architettonici e il calendario in tempo reale.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F3F1EC] border border-[#E6E2DA] self-start">
          <button
            type="button"
            onClick={() => setLocationFilter('all')}
            className={`px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              locationFilter === 'all'
                ? 'bg-[#FFFFFF] text-[#1C1A17]'
                : 'text-[#666158] hover:text-[#1C1A17]'
            }`}
          >
            Tutte ({suites.length})
          </button>
          <button
            type="button"
            onClick={() => setLocationFilter('nice')}
            className={`px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              locationFilter === 'nice'
                ? 'bg-[#FFFFFF] text-[#1C1A17]'
                : 'text-[#666158] hover:text-[#1C1A17]'
            }`}
          >
            Nizza · Aperta
          </button>
          <button
            type="button"
            onClick={() => setLocationFilter('ibiza')}
            className={`px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              locationFilter === 'ibiza'
                ? 'bg-[#FFFFFF] text-[#1C1A17]'
                : 'text-[#666158] hover:text-[#1C1A17]'
            }`}
          >
            Ibiza · Feb 2027
          </button>
          <button
            type="button"
            onClick={() => setLocationFilter('milano')}
            className={`px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              locationFilter === 'milano'
                ? 'bg-[#FFFFFF] text-[#1C1A17]'
                : 'text-[#666158] hover:text-[#1C1A17]'
            }`}
          >
            Milano · Ago 2027
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredSuites.map((suite) => {
          const loc = locationMap[suite.locationId];
          const primaryImage = FOTO_ALLOGGI[suite.id]?.[0] || '';
          const isOpen = suite.status === 'open';
          const devLabel = suite.openingDateLabel
            ? `Apertura ${suite.openingDateLabel}`
            : 'In Sviluppo';

          return (
            <article
              key={suite.id}
              onClick={() => onSelectSuite(suite.id)}
              className="group border border-[#E6E2DA] bg-[#FFFFFF] flex flex-col cursor-pointer hover:border-[#2C3E35] transition-colors"
            >
              <div className="aspect-[4/3] overflow-hidden bg-[#F3F1EC]">
                <FotoSicura
                  src={primaryImage}
                  alt={`${suite.name} — ${loc?.city || ''}`}
                  fallbackTitle={suite.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs text-[#666158]">
                    <span>{loc ? `${loc.city}, ${loc.country}` : suite.locationId}</span>
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

                  <h2 className="font-serif text-2xl font-medium text-[#1C1A17] mt-2">
                    {suite.name}
                  </h2>

                  <p className="text-xs text-[#666158] mt-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>{loc?.address}</span>
                  </p>

                  <p className="text-sm text-[#4B4740] mt-3 leading-relaxed">
                    {suite.subtitle}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[#E6E2DA] flex items-center justify-between gap-4">
                  <div className="text-xs text-[#666158] tabular-nums">
                    <span className="font-serif text-xl font-medium text-[#1C1A17]">
                      €{suite.pricePerNight}
                    </span>{' '}
                    / notte · {suite.sizeSqm} m² · {suite.maxGuests} ospiti
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#2C3E35] group-hover:translate-x-0.5 transition-transform whitespace-nowrap shrink-0">
                    {isOpen ? 'Dettagli' : 'Anteprima'}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

interface DettaglioSuiteProps {
  suite: Suite;
  location?: SuiteLocation;
  onBack: () => void;
}

export function DettaglioSuite({
  suite,
  location,
  onBack,
}: DettaglioSuiteProps) {
  const images = FOTO_ALLOGGI[suite.id] || [];
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const isOpen = suite.status === 'open';
  const openingLabel =
    suite.openingDateLabel || location?.openingEstimate || 'Prossimamente';

  return (
    <section className="max-w-7xl mx-auto px-6 py-10 space-y-10">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-medium text-[#666158] hover:text-[#1C1A17] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Torna a tutte le suite
        </button>
      </div>

      <div className="pb-6 border-b border-[#E6E2DA]">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#666158] mb-2">
          <span>{location?.regionLabel || suite.locationId}</span>
          <span aria-hidden="true">·</span>
          <span
            className={
              isOpen ? 'font-semibold text-[#2C3E35]' : 'font-semibold text-[#9A7B4F]'
            }
          >
            {isOpen ? 'Aperta · Prenotabile ora' : `In Sviluppo · Apertura ${openingLabel}`}
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            {suite.sizeSqm} m² · Fino a {suite.maxGuests} ospiti · {suite.floor}
          </span>
        </div>

        <h1 className="font-serif text-4xl sm:text-5xl font-medium text-[#1C1A17] leading-[1.1]">
          {suite.name}
        </h1>
        <p className="text-sm text-[#4B4740] mt-2 flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-[#2C3E35] shrink-0" />
          <span>
            {location?.address} — {location?.postalCity}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-9 aspect-[16/10] bg-[#F3F1EC] border border-[#E6E2DA] overflow-hidden">
          <FotoSicura
            src={images[activeImageIdx] || images[0] || ''}
            alt={`${suite.name} — Vista ${activeImageIdx + 1}`}
            fallbackTitle={suite.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="lg:col-span-3 grid grid-cols-3 lg:grid-cols-1 gap-4">
          {images.map((imgUrl, idx) => (
            <button
              key={imgUrl}
              type="button"
              onClick={() => setActiveImageIdx(idx)}
              className={`aspect-[4/3] overflow-hidden border transition-opacity cursor-pointer ${
                activeImageIdx === idx
                  ? 'border-[#2C3E35] opacity-100'
                  : 'border-[#E6E2DA] opacity-70 hover:opacity-100'
              }`}
            >
              <FotoSicura
                src={imgUrl}
                alt={`${suite.name} miniatura ${idx + 1}`}
                fallbackTitle={suite.name}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start pt-4">
        <div className="lg:col-span-7 space-y-10">
          <div>
            <h2 className="font-serif text-3xl font-medium text-[#1C1A17]">
              L’Esperienza della Dimora
            </h2>
            <p className="text-base text-[#3D3A34] mt-3 leading-relaxed">
              {suite.description}
            </p>
            <p className="text-sm text-[#666158] mt-4 leading-relaxed">
              {suite.designNotes}
            </p>
          </div>

          <div className="pt-8 border-t border-[#E6E2DA]">
            <h3 className="font-serif text-2xl font-medium text-[#1C1A17]">
              Dotazioni & Comfort
            </h3>
            <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-[#3D3A34]">
              {suite.amenities.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#2C3E35] shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {location && (
            <div className="pt-8 border-t border-[#E6E2DA]">
              <h3 className="font-serif text-2xl font-medium text-[#1C1A17]">
                Il Quartiere · {location.city}
              </h3>
              <p className="text-sm text-[#4B4740] mt-2 leading-relaxed">
                {location.story}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-[#666158]">
                {location.neighborhoodHighlights.map((h) => (
                  <li key={h} className="flex items-start gap-2">
                    <span className="text-[#2C3E35]" aria-hidden="true">
                      —
                    </span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-8 border-t border-[#E6E2DA] grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div>
              <h3 className="font-serif text-xl font-medium text-[#1C1A17]">
                Regole della Casa
              </h3>
              <ul className="mt-3 space-y-2 text-xs text-[#666158]">
                {suite.houseRules.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-serif text-xl font-medium text-[#1C1A17]">
                Canali di Prenotazione
              </h3>
              <p className="mt-3 text-xs text-[#666158] leading-relaxed">
                Prenotabile direttamente su Modo Stays con carta tramite Stripe oppure su Airbnb e Booking.com con calendario sincronizzato automaticamente via iCal (<span className="font-mono">.ics</span>).
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 lg:sticky lg:top-8">
          <CalendarioPrenotazione suite={suite} location={location} />
        </div>
      </div>
    </section>
  );
}
