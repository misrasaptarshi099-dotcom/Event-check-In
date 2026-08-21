export type UserRole = 'organizer' | 'attendee';

export type RegistrationStatus = 'active' | 'cancelled';

export type CheckinSource = 'online' | 'offline_sync';

export type SyncResult = 'success' | 'duplicate_conflict' | 'invalid_token' | 'error';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface UserAccount {
  id: string; // Firebase Auth UID
  email: string; // Normalized lowercase email
  displayName: string;
  photoURL?: string;
  role: UserRole; // 'organizer' | 'attendee'
  accountStatus: 'active' | 'suspended';
  createdAt: string;
  lastLoginAt: string;
  updatedAt: string;
}

export interface EventItem {
  id: string;
  organizerId: string;
  name: string;
  description?: string;
  eventDate: string; // ISO start date/time string
  eventEndDate?: string; // ISO end date/time string
  timezone?: string; // IANA timezone (e.g. 'America/New_York'), defaults to 'UTC'
  venue?: string; // Location or venue name
  bannerUrl?: string; // Banner image URL or base64 data string
  ticketPrice?: number; // Price per ticket in currency units (e.g. 0 for free, 50, 150)
  currency?: string; // Currency code, defaults to 'USD'
  capacity: number;
  spotsRemaining: number;
  status?: 'active' | 'cancelled';
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  createdAt: string;
}

export interface Registration {
  id: string;
  eventId: string;
  attendeeId: string;
  attendeeName: string;
  attendeeEmail: string;
  passCode?: string; // Short, human-friendly, opaque ticket code (e.g. 'VCH-7K9M-2P4X')
  qrToken: string;
  totpSecret: string; // Base32 RFC 6238 secret (delivered once to attendee)
  status: RegistrationStatus;
  cancelledAt?: string;
  cancelledBy?: string;
  guestCount: number; // Number of seats reserved (1–5, includes the registrant)
  ticketPrice?: number;
  checkedIn?: boolean;
  checkedInAt?: string;
  createdAt: string;
}

export interface Checkin {
  id: string;
  registrationId: string;
  eventId: string;
  attendeeName: string;
  attendeeEmail: string;
  checkedInAt: string; // Authoritative server timestamp
  clientScannedAt?: string; // Local scanner timestamp
  stationId: string;
  source: CheckinSource;
  clientScanId: string; // Idempotency key from scanning device
  createdAt: string;
}

export interface CheckinSyncLog {
  id: string;
  registrationId?: string;
  eventId: string;
  stationId: string;
  clientScanId: string;
  clientScannedAt: string;
  syncedAt: string;
  source: CheckinSource;
  result: SyncResult;
  conflictingCheckinId?: string;
  createdAt: string;
}

export interface CheckinTimeBucket {
  bucket: string; // e.g. "18:00", "18:15"
  count: number;
}

export interface StatsBundle {
  eventId: string;
  eventName: string;
  eventDate?: string;
  eventEndDate?: string;
  isEventFinished: boolean;
  capacity: number;
  spotsRemaining: number;
  registeredCount: number;
  checkedInCount: number;
  noShowCount: number;
  noShowPct: number | null; // null if event is ongoing or in future
  checkinsBy15Min: CheckinTimeBucket[];
  peakCheckinBucket: string;
  peakCheckinCount: number;
  computedAt: string;
}

export interface TransactionEntry {
  id: string;
  registrationId: string;
  attendeeName: string;
  attendeeEmail: string;
  amount: number;
  currency: string;
  status: 'completed' | 'refunded';
  createdAt: string;
}

export interface FinanceBundle {
  eventId: string;
  eventName: string;
  ticketPrice: number;
  currency: string;
  grossRevenue: number;
  netRevenue: number;
  refundedAmount: number;
  paidTicketsCount: number;
  unpaidTicketsCount: number;
  averageOrderValue: number;
  projectedRevenue: number; // Potential gross revenue at 100% capacity
  occupancyFinancialRate: number; // Percentage of projected revenue realized (0-100)
  recentTransactions: TransactionEntry[];
  computedAt: string;
}

export interface QrPayload {
  r: string; // registration_id
  e: string; // event_id
  t: string; // totp code (6 digits)
  ts: number; // timestamp in seconds
}

export type ScanStatusType = 'CONFIRMED' | 'PROVISIONAL' | 'DUPLICATE' | 'INVALID' | 'CONFLICT';

export interface ScanOutcome {
  status: ScanStatusType;
  message: string;
  registrationId?: string;
  attendeeName?: string;
  checkedInAt?: string;
  stationId?: string;
  isOffline?: boolean;
}

export interface OfflineQueuedScan {
  clientScanId: string;
  eventId: string;
  registrationId: string;
  qrToken: string;
  otp: string;
  stationId: string;
  clientScannedAt: string;
  attendeeName?: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed';
  syncResult?: SyncResult;
}

export interface CachedRosterEntry {
  registrationId: string;
  qrToken: string;
  totpSecret: string;
  attendeeName: string;
  attendeeEmail: string;
  status: RegistrationStatus;
}
