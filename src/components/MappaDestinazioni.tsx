import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiIsLoaded,
  useApiLoadingStatus,
  APILoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { ArrowRight, Compass, ExternalLink, MapPin } from 'lucide-react';
import { BRAND_INFO } from '../CONTENUTI_ALLOGGI';
import type { GeoCoordinates, SuiteLocation } from '../types';

interface MappaDestinazioniProps {
  locations: SuiteLocation[];
  hasApiKey: boolean;
  mapEmbedUrl?: string;
  onSelectLocationAction: (locationId: string) => void;
}

const CITY_FOCUS_COORDS: Record<string, { lat: number; lng: number; zoom: number }> = {
  nice: { lat: 43.6948, lng: 7.2414, zoom: 15 },
  ibiza: { lat: 38.9089, lng: 1.4328, zoom: 15 },
  milano: { lat: 45.4526, lng: 9.1932, zoom: 15 },
};

function normalizeMyMapsEmbedUrl(rawUrl: string): {
  embedBase: string;
  viewerUrl: string;
} {
  const clean = (rawUrl || '').trim();
  if (!clean) return { embedBase: '', viewerUrl: '' };
  try {
    const parsed = new URL(clean);
    const mid = parsed.searchParams.get('mid');
    if (mid && parsed.hostname.includes('google.')) {
      return {
        embedBase: `https://www.google.com/maps/d/embed?mid=${encodeURIComponent(mid)}`,
        viewerUrl: `https://www.google.com/maps/d/viewer?mid=${encodeURIComponent(mid)}`,
      };
    }
    return { embedBase: clean, viewerUrl: clean };
  } catch {
    return { embedBase: clean, viewerUrl: clean };
  }
}

interface LocationMarkerProps {
  location: SuiteLocation;
  coordinates: GeoCoordinates;
  isSelected: boolean;
  isInfoOpen: boolean;
  onMarkerClick: (locationId: string) => void;
  onInfoClose: () => void;
  onActionClick: (locationId: string) => void;
}

function LocationMarkerWithInfo({
  location,
  coordinates,
  isSelected,
  isInfoOpen,
  onMarkerClick,
  onInfoClose,
  onActionClick,
}: LocationMarkerProps) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const isOpen = location.status === 'open';

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: coordinates.lat, lng: coordinates.lng }}
        title={`${location.city} — ${location.address}`}
        onClick={() => onMarkerClick(location.id)}
      >
        <Pin
          background={isOpen ? '#2C3E35' : '#9A7B4F'}
          borderColor={isOpen ? '#1A2620' : '#6E5532'}
          glyphColor="#FAF9F6"
          scale={isSelected ? 1.25 : 1.05}
        >
          {location.city.charAt(0)}
        </Pin>
      </AdvancedMarker>

      {isInfoOpen && marker && (
        <InfoWindow
          anchor={marker}
          maxWidth={290}
          onCloseClick={onInfoClose}
        >
          <div className="p-1 text-[#1C1A17] font-sans">
            <div className="flex items-center gap-2 text-xs text-[#666158] mb-1">
              <span>{location.country}</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  isOpen
                    ? 'font-semibold text-[#2C3E35]'
                    : 'font-semibold text-[#9A7B4F]'
                }
              >
                {location.statusLabel}
              </span>
            </div>
            <h4 className="font-serif text-lg font-semibold leading-snug text-[#1C1A17]">
              {location.city}
            </h4>
            <p className="text-xs text-[#4B4740] mt-0.5">
              {location.address} · {location.postalCity}
            </p>
            <p className="text-xs text-[#666158] mt-2 leading-relaxed">
              {location.headline}
            </p>
            <button
              type="button"
              onClick={() => onActionClick(location.id)}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#2C3E35] hover:text-[#1A2620] underline underline-offset-4 cursor-pointer"
            >
              {isOpen ? 'Esplora le suite disponibili' : 'Vedi progetto e lista d’attesa'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function MapCameraController({
  coordsById,
  selectedId,
  overviewTrigger,
}: {
  coordsById: Record<string, GeoCoordinates>;
  selectedId: string | null;
  overviewTrigger: number;
}) {
  const map = useMap();
  const hasFittedInitial = useRef(false);

  const fitAllLocations = useCallback(() => {
    if (!map) return;
    const coordsList = Object.values(coordsById);
    if (coordsList.length === 0) return;

    if (coordsList.length === 1) {
      map.panTo({ lat: coordsList[0].lat, lng: coordsList[0].lng });
      map.setZoom(14);
      return;
    }

    let south = coordsList[0].lat;
    let north = coordsList[0].lat;
    let west = coordsList[0].lng;
    let east = coordsList[0].lng;
    for (const c of coordsList) {
      if (c.lat < south) south = c.lat;
      if (c.lat > north) north = c.lat;
      if (c.lng < west) west = c.lng;
      if (c.lng > east) east = c.lng;
    }
    map.fitBounds({ south, west, north, east }, 64);
  }, [map, coordsById]);

  useEffect(() => {
    if (!map || hasFittedInitial.current) return;
    const count = Object.keys(coordsById).length;
    if (count >= 2) {
      fitAllLocations();
      hasFittedInitial.current = true;
    }
  }, [map, coordsById, fitAllLocations]);

  useEffect(() => {
    if (!map || !selectedId) return;
    const target = coordsById[selectedId];
    if (!target) return;
    map.panTo({ lat: target.lat, lng: target.lng });
    map.setZoom(15);
  }, [map, selectedId, coordsById]);

  useEffect(() => {
    if (overviewTrigger > 0) {
      fitAllLocations();
    }
  }, [overviewTrigger, fitAllLocations]);

  return null;
}

function PlacesGeocodeResolver({
  locations,
  coordsById,
  onResolved,
}: {
  locations: SuiteLocation[];
  coordsById: Record<string, GeoCoordinates>;
  onResolved: (locationId: string, coords: GeoCoordinates) => void;
}) {
  const placesLib = useMapsLibrary('places');
  const attemptedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!placesLib) return;

    locations.forEach(async (loc) => {
      if (coordsById[loc.id] || attemptedRef.current[loc.id]) return;
      attemptedRef.current[loc.id] = true;

      try {
        const { places } = await placesLib.Place.searchByText({
          textQuery: loc.geocodeQuery,
          fields: ['location', 'formattedAddress', 'id'],
          maxResultCount: 1,
        });

        const first = places?.[0];
        if (first?.location) {
          onResolved(loc.id, {
            lat: first.location.lat(),
            lng: first.location.lng(),
            placeId: first.id,
            formattedAddress: first.formattedAddress ?? undefined,
          });
        }
      } catch (err) {
        console.error(`Unable to resolve place for ${loc.city}:`, err);
      }
    });
  }, [placesLib, locations, coordsById, onResolved]);

  return null;
}

function GoogleJsMapFallback({
  locations,
  hasApiKey,
  selectedId,
  openInfoId,
  overviewTrigger,
  onSelectLocation,
  onCloseInfo,
  onActionClick,
}: {
  locations: SuiteLocation[];
  hasApiKey: boolean;
  selectedId: string | null;
  openInfoId: string | null;
  overviewTrigger: number;
  onSelectLocation: (id: string) => void;
  onCloseInfo: () => void;
  onActionClick: (id: string) => void;
}) {
  const [coordsById, setCoordsById] = useState<Record<string, GeoCoordinates>>(() => {
    const initial: Record<string, GeoCoordinates> = {};
    for (const loc of locations) {
      if (loc.coordinates) {
        initial[loc.id] = loc.coordinates;
      }
    }
    return initial;
  });

  useEffect(() => {
    setCoordsById((prev) => {
      const next = { ...prev };
      for (const loc of locations) {
        if (loc.coordinates && !next[loc.id]) {
          next[loc.id] = loc.coordinates;
        }
      }
      return next;
    });
  }, [locations]);

  const handleResolved = useCallback((id: string, coords: GeoCoordinates) => {
    setCoordsById((prev) => ({ ...prev, [id]: coords }));
  }, []);

  const isLoaded = useApiIsLoaded();
  const apiStatus = useApiLoadingStatus();
  const mapFailed =
    !hasApiKey ||
    apiStatus === APILoadingStatus.FAILED ||
    apiStatus === APILoadingStatus.AUTH_FAILURE;

  if (mapFailed) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center">
        <MapPin className="w-8 h-8 text-[#666158] mb-3" />
        <h4 className="font-serif text-xl text-[#1C1A17]">
          Mappa interattiva non configurata
        </h4>
        <p className="text-sm text-[#666158] max-w-md mt-2 leading-relaxed">
          Inserisci il link Google My Maps in Area Host → Alloggi & Prezzi oppure nel file src/CONTENUTI_ALLOGGI.ts.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      {!isLoaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#F3F1EC] text-sm text-[#666158]">
          Caricamento mappa interattiva...
        </div>
      )}
      <GoogleMap
        mapId="DEMO_MAP_ID"
        defaultCenter={{ lat: 42.5, lng: 5.5 }}
        defaultZoom={5}
        gestureHandling="cooperative"
        disableDefaultUI={false}
        streetViewControl={false}
        mapTypeControl={false}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%' }}
      >
        <PlacesGeocodeResolver
          locations={locations}
          coordsById={coordsById}
          onResolved={handleResolved}
        />
        <MapCameraController
          coordsById={coordsById}
          selectedId={selectedId}
          overviewTrigger={overviewTrigger}
        />

        {locations.map((loc) => {
          const coords = coordsById[loc.id];
          if (!coords) return null;
          return (
            <LocationMarkerWithInfo
              key={loc.id}
              location={loc}
              coordinates={coords}
              isSelected={selectedId === loc.id}
              isInfoOpen={openInfoId === loc.id}
              onMarkerClick={onSelectLocation}
              onInfoClose={onCloseInfo}
              onActionClick={onActionClick}
            />
          );
        })}
      </GoogleMap>
    </div>
  );
}

export function MappaDestinazioni({
  locations,
  hasApiKey,
  mapEmbedUrl,
  onSelectLocationAction,
}: MappaDestinazioniProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);
  const [overviewTrigger, setOverviewTrigger] = useState(0);

  const effectiveRawUrl =
    mapEmbedUrl !== undefined ? mapEmbedUrl : BRAND_INFO.mappaMyMapsUrl;
  const { embedBase, viewerUrl } = useMemo(
    () => normalizeMyMapsEmbedUrl(effectiveRawUrl),
    [effectiveRawUrl]
  );

  const iframeSrc = useMemo(() => {
    if (!embedBase) return '';
    if (selectedId && CITY_FOCUS_COORDS[selectedId]) {
      const { lat, lng, zoom } = CITY_FOCUS_COORDS[selectedId];
      const sep = embedBase.includes('?') ? '&' : '?';
      return `${embedBase}${sep}ll=${lat}%2C${lng}&z=${zoom}`;
    }
    return embedBase;
  }, [embedBase, selectedId]);

  const handleSelectLocation = useCallback((locationId: string) => {
    setSelectedId(locationId);
    setOpenInfoId(locationId);
  }, []);

  const handleResetOverview = useCallback(() => {
    setSelectedId(null);
    setOpenInfoId(null);
    setOverviewTrigger((n) => n + 1);
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
      <div className="lg:col-span-5 flex flex-col justify-between gap-4">
        <div className="space-y-4">
          {locations.map((loc) => {
            const isOpen = loc.status === 'open';
            const isSelected = selectedId === loc.id;

            return (
              <div
                key={loc.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectLocation(loc.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectLocation(loc.id);
                  }
                }}
                className={`w-full text-left p-5 border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2C3E35] ${
                  isSelected
                    ? 'bg-[#FFFFFF] border-[#2C3E35]'
                    : 'bg-[#F3F1EC] border-[#E6E2DA] hover:border-[#B8B1A3]'
                }`}
              >
                <div className="flex items-center justify-between gap-3 text-xs text-[#666158] mb-1.5">
                  <div className="flex items-center gap-2">
                    <span>{loc.regionLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        isOpen
                          ? 'font-semibold text-[#2C3E35]'
                          : 'font-semibold text-[#9A7B4F]'
                      }
                    >
                      {loc.statusLabel}
                    </span>
                  </div>
                  <MapPin className="w-4 h-4 shrink-0 text-[#666158]" />
                </div>

                <h3 className="font-serif text-2xl font-medium text-[#1C1A17]">
                  {loc.city}
                </h3>
                <p className="text-xs font-medium text-[#3D3A34] mt-1">
                  {loc.address} — {loc.postalCity}
                </p>
                <p className="text-xs text-[#666158] mt-2.5 leading-relaxed">
                  {loc.story}
                </p>

                <div className="mt-3.5 pt-3 border-t border-[#E6E2DA] flex items-center justify-between gap-4">
                  <span className="text-[11px] text-[#666158]">
                    {isSelected ? 'Centrata sulla mappa' : 'Clicca per centrare sulla mappa'}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectLocationAction(loc.id);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2C3E35] hover:text-[#1A2620] underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isOpen ? `Vedi Suite a ${loc.city}` : `Anteprima ${loc.city}`}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleResetOverview}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium border border-[#D8D3C8] text-[#1C1A17] bg-[#FFFFFF] hover:bg-[#F3F1EC] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Compass className="w-4 h-4 text-[#666158]" />
          Vista d’Insieme Europa
        </button>
      </div>

      <div className="lg:col-span-7 border border-[#E6E2DA] bg-[#F3F1EC] relative h-[480px] lg:h-[620px] min-h-[440px] flex flex-col">
        {iframeSrc ? (
          <>
            <div className="flex-1 w-full relative">
              <iframe
                key={iframeSrc}
                src={iframeSrc}
                title="Mappa Destinazioni Modo Stays"
                className="w-full h-full border-0"
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <div className="px-4 py-2.5 bg-[#FFFFFF] border-t border-[#E6E2DA] flex flex-wrap items-center justify-between gap-2 text-xs text-[#666158]">
              <span>
                {selectedId
                  ? `Focus su ${locations.find((l) => l.id === selectedId)?.city || ''}`
                  : 'Mappa interattiva Google My Maps — Modo Stays'}
              </span>
              {viewerUrl && (
                <a
                  href={viewerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-[#2C3E35] hover:text-[#1A2620] underline underline-offset-4"
                >
                  Apri su Google Maps
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </>
        ) : (
          <GoogleJsMapFallback
            locations={locations}
            hasApiKey={hasApiKey}
            selectedId={selectedId}
            openInfoId={openInfoId}
            overviewTrigger={overviewTrigger}
            onSelectLocation={handleSelectLocation}
            onCloseInfo={() => setOpenInfoId(null)}
            onActionClick={onSelectLocationAction}
          />
        )}
      </div>
    </div>
  );
}
