/**
 * ============================================================================
 * MODO STAYS — FILE UNICO CONTENUTI, DESCRIZIONI E FOTO
 * ============================================================================
 *
 * Questo è il file principale dove puoi modificare liberamente i testi,
 * le descrizioni delle città, le date di apertura e le foto del sito.
 *
 * DOVE SI TROVANO LE FOTO?
 * Tutte le immagini JPEG sono salvate nella cartella:
 *    public/foto-alloggi/
 *
 * Per sostituire una foto con una tua definitiva:
 * 1. Apri la cartella "public/foto-alloggi/"
 * 2. Inserisci la tua immagine .jpg con lo stesso nome (oppure aggiungi nuovi
 *    file .jpg e scrivi il loro percorso qui sotto nella lista "FOTO_ALLOGGI").
 * ============================================================================
 */

import type { Suite, SuiteLocation } from './types';

export const BRAND_INFO = {
  nome: 'Modo Stays',
  vision: 'Thoughtfully designed apartments. Prime locations. Effortless experiences.',
  titoloHero: 'Dimore progettate con cura, tra luce mediterranea e design urbano.',
  introduzioneHero:
    'Modo Stays seleziona e cura appartamenti indipendenti nei quartieri più autentici d’Europa. Siamo aperti a Nizza su Boulevard Carlone, e stiamo preparando le nuove dimore di Ibiza (Febbraio 2027) e Milano (Agosto 2027).',
  cartellaFotoSpiegazione: 'public/foto-alloggi/',
};

/**
 * FOTO GENERALI DEL SITO (Cartella: public/foto-alloggi/)
 */
export const FOTO_GENERALI = {
  heroPrincipale: '/foto-alloggi/hero-principale.jpg',
  dettaglioOspitalita: '/foto-alloggi/dettaglio-ospitalita.jpg',
};

/**
 * GALLERIA FOTO PER OGNI SUITE (Cartella: public/foto-alloggi/)
 * Puoi aggiungere quante foto .jpg vuoi nell'elenco di ciascun alloggio.
 */
export const FOTO_ALLOGGI: Record<string, string[]> = {
  'carlone-lumiere': [
    '/foto-alloggi/nizza-carlone-1.jpg',
    '/foto-alloggi/hero-principale.jpg',
    '/foto-alloggi/dettaglio-ospitalita.jpg',
  ],
  'promenade-terrazza': [
    '/foto-alloggi/nizza-terrazza-1.jpg',
    '/foto-alloggi/hero-principale.jpg',
    '/foto-alloggi/dettaglio-ospitalita.jpg',
  ],
  'ibiza-casa-calma': [
    '/foto-alloggi/ibiza-calma-1.jpg',
    '/foto-alloggi/dettaglio-ospitalita.jpg',
  ],
  'beatrice-design-concept': [
    '/foto-alloggi/milano-beatrice-1.jpg',
    '/foto-alloggi/dettaglio-ospitalita.jpg',
  ],
};

/**
 * DESTINAZIONI INIZIALI (Città, indirizzi esatti sulla mappa e descrizioni)
 */
export const DESTINAZIONI_INIZIALI: SuiteLocation[] = [
  {
    id: 'nice',
    city: 'Nizza',
    country: 'Francia',
    regionLabel: 'Costa Azzurra · Francia',
    address: 'Boulevard Carlone, 35',
    postalCity: '06000 Nice, France',
    geocodeQuery: '35 Boulevard Carlone, 06000 Nice, France',
    status: 'open',
    statusLabel: 'Aperta · Prenotabile',
    headline: 'La luce chiara della Riviera, a pochi passi dalla Promenade.',
    story:
      'A Nizza il tempo segue la curva luminosa della Baie des Anges. In Boulevard Carlone 35, dietro persiane chiare e soffitti alti in stile Belle Époque, le nostre suite nascono per chi cerca silenzio, lino naturale e aria di mare al risveglio.',
    neighborhoodHighlights: [
      '3 minuti a piedi dalla Promenade des Anglais e dal mare',
      'Quartiere residenziale Carlone / Magnan, servito da tram L2 verso aeroporto e centro',
      'Mercati locali, boulangerie artigianali e caffè sulla costa',
    ],
    coordinates: null,
  },
  {
    id: 'ibiza',
    city: 'Ibiza',
    country: 'Spagna',
    regionLabel: 'Isole Baleari · Spagna',
    address: 'Passeig de Vara de Rey',
    postalCity: '07800 Eivissa, Spagna',
    geocodeQuery: 'Passeig de Vara de Rey, 07800 Eivissa, Spain',
    status: 'development',
    statusLabel: 'In Sviluppo · Apertura Febbraio 2027',
    openingEstimate: 'Febbraio 2027',
    headline: 'Calce bianca, legno di sabina e ritmo lento delle Baleari.',
    story:
      'La nostra dimora di Ibiza aprirà a febbraio 2027: un appartamento luminoso tra architetture in calce naturale, travi in legno chiaro e pietra locale, pensato per vivere l’isola con quiete tutto l’anno.',
    neighborhoodHighlights: [
      'Nel cuore elegante di Eivissa, tra palazzi storici e boutique indipendenti',
      'A pochi minuti a piedi dal porto e da Dalt Vila',
      'Apertura prevista per Febbraio 2027 · Lista d’attesa attiva',
    ],
    coordinates: null,
  },
  {
    id: 'milano',
    city: 'Milano',
    country: 'Italia',
    regionLabel: 'Porta Romana · Italia',
    address: "Viale Beatrice d'Este, 7",
    postalCity: '20122 Milano, Italia',
    geocodeQuery: "Viale Beatrice d'Este 7, 20122 Milano, Italy",
    status: 'development',
    statusLabel: 'In Sviluppo · Apertura Agosto 2027',
    openingEstimate: 'Agosto 2027',
    headline: 'Architettura milanese, cortili silenziosi e materia tattile.',
    story:
      "Su Viale Beatrice d'Este 7 apriremo ad agosto 2027 la nostra dimora italiana: un tributo sobrio al design milanese del Novecento. Pietra travertino, noce canaletto lavorato a mano e luce filtrata dai cortili interni tra Porta Romana e i Navigli.",
    neighborhoodHighlights: [
      'Lungo gli storici bastioni alberati tra Porta Romana e Crocetta',
      'A 10 minuti a piedi da Fondazione Prada, Università Bocconi e Quartiere Quadronno',
      'Apertura prevista per Agosto 2027 · Lista d’attesa attiva',
    ],
    coordinates: null,
  },
];

/**
 * ALLOGGI E DESCRIZIONI INIZIALI
 * Nota: puoi modificare questi testi direttamente qui nel codice oppure
 * cambiarli in diretta dal sito dentro "Area Host -> Alloggi & Prezzi".
 */
export const ALLOGGI_INIZIALI: Suite[] = [
  {
    id: 'carlone-lumiere',
    slug: 'suite-carlone-lumiere',
    locationId: 'nice',
    name: 'Suite Carlone Lumière',
    subtitle: 'Suite padronale con balcone alla francese e luce del mattino',
    status: 'open',
    pricePerNight: 240,
    cleaningFee: 65,
    cityTaxPerNight: 4,
    maxGuests: 2,
    sizeSqm: 58,
    bedrooms: 1,
    bathrooms: 1,
    floor: '3° piano con ascensore',
    description:
      'Ampia suite luminosa situata al terzo piano di un palazzo storico su Boulevard Carlone. Pensata per coppie e viaggiatori solitari che desiderano un rifugio sereno sulla Costa Azzurra, unisce parquet in rovere spazzolato, tende in lino grezzo e un soggiorno arioso aperto su due balconi alla francese.',
    designNotes:
      'Palette in gesso caldo, pietra calcarea e dettagli in ottone naturale per riflettere la luce mediterranea senza mai appesantire lo spazio.',
    amenities: [
      'Letto King con biancheria in lino lavato biologico',
      'Cucina attrezzata con macchina espresso e bollitore',
      'Bagno rivestito in travertino con doccia walk-in',
      'Wi-Fi Fibra ad alta velocità e scrivania dedicata',
      'Aria condizionata silenziosa e insonorizzazione',
      'Self check-in digitale 24/7 con codice personale',
    ],
    houseRules: [
      'Check-in dalle 15:00 · Check-out entro le 11:00',
      'Ambiente non fumatori',
      'Rispetto della quiete condominiale dopo le 22:00',
    ],
    airbnbIcsUrl: '',
    bookingIcsUrl: '',
    lastAirbnbSync: null,
    lastBookingSync: null,
    lastAutoSyncAt: null,
    lastSyncSummary: 'Pronta per il collegamento ai feed iCal di Airbnb e Booking.com',
  },
  {
    id: 'promenade-terrazza',
    slug: 'atelier-promenade-terrazza',
    locationId: 'nice',
    name: 'Atelier Promenade & Terrazza',
    subtitle: 'Dimora d’angolo con terrazza abitabile in travertino',
    status: 'open',
    pricePerNight: 310,
    cleaningFee: 80,
    cityTaxPerNight: 4,
    maxGuests: 4,
    sizeSqm: 78,
    bedrooms: 1,
    bathrooms: 1,
    floor: '5° piano panoramico',
    description:
      'Al quinto piano di Boulevard Carlone 35, l’Atelier apre il proprio salone su una terrazza privata immersa nella brezza marina. Ideale per soggiorni più lunghi o per chi viaggia con un piccolo nucleo familiare, offre una zona living separata con divano letto sartoriale e zona pranzo esterna.',
    designNotes:
      'Soffitti con travi chiare a vista, pavimentazione continua in pietra naturale e arredi su misura che accompagnano il ritmo lento tra interno ed esterno.',
    amenities: [
      'Terrazza privata attrezzata con sedute in rattan e tavolo da pranzo',
      'Camera matrimoniale separata + salone con divano letto queen',
      'Cucina completa con piano a induzione e lavastoviglie',
      'Smart TV a scomparsa e impianto audio Hi-Fi',
      'Lavatrice-asciugatrice integrata e set cortesia botanico',
      'Self check-in smart e concierge digitale dedicato',
    ],
    houseRules: [
      'Check-in dalle 15:00 · Check-out entro le 11:00',
      'Non sono ammessi eventi o feste in terrazza',
      'Ambiente non fumatori negli spazi interni',
    ],
    airbnbIcsUrl: '',
    bookingIcsUrl: '',
    lastAirbnbSync: null,
    lastBookingSync: null,
    lastAutoSyncAt: null,
    lastSyncSummary: 'Pronta per il collegamento ai feed iCal di Airbnb e Booking.com',
  },
  {
    id: 'ibiza-casa-calma',
    slug: 'casa-calma-ibiza',
    locationId: 'ibiza',
    name: 'Casa Calma — Ibiza Suite',
    subtitle: 'Apertura Febbraio 2027 · Architettura mediterranea essenziale',
    status: 'development',
    openingDateLabel: 'Febbraio 2027',
    pricePerNight: 330,
    cleaningFee: 85,
    cityTaxPerNight: 4,
    maxGuests: 2,
    sizeSqm: 62,
    bedrooms: 1,
    bathrooms: 1,
    floor: '2° piano con loggia solare',
    description:
      'Con apertura prevista a febbraio 2027, Casa Calma porta a Ibiza la filosofia essenziale di Modo Stays: pareti in calce naturale, soffitti con travi in legno di sabina, pietra travertino e tessuti in lino grezzo affacciati sulla luce delle Baleari.',
    designNotes:
      'Volumi essenziali e materiali organici dell’isola lavorati da artigiani locali per garantire freschezza naturale e quiete in ogni stagione.',
    amenities: [
      'Loggia esterna privata con seduta in pietra e lino',
      'Letto King in legno massello naturale',
      'Cucina su misura con piano in pietra calcarea',
      'Wi-Fi Fibra ad alta velocità per soggiorni workation',
      'Impianto clima silenzioso a basso consumo',
    ],
    houseRules: [
      'Apertura prevista: Febbraio 2027',
      'Lista d’attesa prioritaria aperta ora',
      'Check-in digitale autonomo 24/7',
    ],
    airbnbIcsUrl: '',
    bookingIcsUrl: '',
    lastAirbnbSync: null,
    lastBookingSync: null,
    lastAutoSyncAt: null,
    lastSyncSummary: 'In preparazione per apertura Febbraio 2027',
  },
  {
    id: 'beatrice-design-concept',
    slug: 'residenza-beatrice-milano',
    locationId: 'milano',
    name: 'Residenza Beatrice — Milano Suite',
    subtitle: "Apertura Agosto 2027 · Viale Beatrice d'Este 7",
    status: 'development',
    openingDateLabel: 'Agosto 2027',
    pricePerNight: 290,
    cleaningFee: 75,
    cityTaxPerNight: 6,
    maxGuests: 2,
    sizeSqm: 65,
    bedrooms: 1,
    bathrooms: 1,
    floor: 'Piano rialzato su corte interna',
    description:
      "Con apertura prevista ad agosto 2027, la Residenza Beatrice porterà a Milano la cura silenziosa di Modo Stays. Affacciata su un cortile verde riservato in Viale Beatrice d'Este 7, è pensata per chi visita Milano per il design, l’architettura e i soggiorni di lavoro.",
    designNotes:
      'Boiserie curva in noce nazionale, camino scultoreo su basamento in travertino romano, serramenti in ferro-finestra affacciati sul giardino interno.',
    amenities: [
      'Suite con affaccio silenzioso su corte verde privata',
      'Arredi d’autore e illuminazione architetturale dimmerabile',
      'Zona studio con fibra dedicata per smart working',
      'Cucina compatta a scomparsa in pietra e legno',
      'Accesso immediato a Metro Porta Romana / Crocetta (M3)',
    ],
    houseRules: [
      'Apertura prevista: Agosto 2027',
      'Lista d’attesa prioritaria aperta ora',
      'Prenotazioni dirette in attivazione all’apertura',
    ],
    airbnbIcsUrl: '',
    bookingIcsUrl: '',
    lastAirbnbSync: null,
    lastBookingSync: null,
    lastAutoSyncAt: null,
    lastSyncSummary: 'In preparazione per apertura Agosto 2027',
  },
];
