export type LocationStatus = 'open' | 'development';

export type BookingChannel = 'direct' | 'airbnb' | 'booking' | 'manual';

export type PaymentStatus = 'paid' | 'pending' | 'external' | 'blocked';

export interface GeoCoordinates {
  lat: number;
  lng: number;
  placeId?: string;
  formattedAddress?: string;
}

export interface SuiteLocation {
  id: string;
  city: string;
  country: string;
  regionLabel: string;
  address: string;
  postalCity: string;
  geocodeQuery: string;
  status: LocationStatus;
  statusLabel: string;
  openingEstimate?: string;
  headline: string;
  story: string;
  neighborhoodHighlights: string[];
  coordinates?: GeoCoordinates | null;
}

export interface Suite {
  id: string;
  slug: string;
  locationId: string;
  name: string;
  subtitle: string;
  status: LocationStatus;
  openingDateLabel?: string;
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
  amenities: string[];
  houseRules: string[];
  airbnbIcsUrl: string;
  bookingIcsUrl: string;
  lastAirbnbSync?: string | null;
  lastBookingSync?: string | null;
  lastAutoSyncAt?: string | null;
  lastSyncSummary?: string | null;
}

export interface BookingRecord {
  id: string;
  suiteId: string;
  channel: BookingChannel;
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  guestsCount: number;
  totalAmountEur: number;
  paymentStatus: PaymentStatus;
  stripeSessionId?: string;
  externalUid?: string;
  notes?: string;
  createdAt: string;
}

export interface WaitlistEntry {
  id: string;
  locationId: string;
  suiteId?: string;
  name: string;
  email: string;
  preferredPeriod?: string;
  createdAt: string;
}

export interface AvailabilityBlock {
  checkIn: string;
  checkOut: string;
  bookingId: string;
}

export interface BookingConflict {
  suiteId: string;
  bookingA: BookingRecord;
  bookingB: BookingRecord;
  overlapStart: string;
  overlapEnd: string;
}

export interface SystemIntegrationStatus {
  stripeConfigured: boolean;
  stripeMode: 'live_or_test_api' | 'sandbox_preview';
  appBaseUrl: string;
  autoSyncIntervalMinutes: number;
  mapEmbedUrl?: string;
}
