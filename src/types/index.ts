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

export interface EventItem {
  id: string;
  organizerId: string;
  name: string;
  description?: string;
  eventDate: string; // ISO date string
  capacity: number;
  spotsRemaining: number;
  createdAt: string;
}

export interface Registration {
  id: string;
  eventId: string;
  attendeeId: string;
  attendeeName: string;
  attendeeEmail: string;
  qrToken: string;
  totpSecret: string; // Base32 RFC 6238 secret (delivered once to attendee)
  status: RegistrationStatus;
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
  capacity: number;
  spotsRemaining: number;
  registeredCount: number;
  checkedInCount: number;
  noShowCount: number;
  noShowPct: number;
  checkinsBy15Min: CheckinTimeBucket[];
  peakCheckinBucket: string;
  peakCheckinCount: number;
  computedAt: string;
}

export interface QrPayload {
  regId: string;
  token: string;
  otp: string;
  ts: number;
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
