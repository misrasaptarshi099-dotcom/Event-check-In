# VOUCH: High-Concurrency Event Operations and Dynamic Admission Verification System

VOUCH is an enterprise-grade event management, ticketing, and gate verification platform designed to eliminate ticket fraud, screenshot sharing, double-admissions, and network failure vulnerabilities during live event operations.

Built with Next.js 15, React 19, TypeScript, Cloud Firestore, and the WebCrypto API, VOUCH provides end-to-end security guarantees: dynamic rotating TOTP credentials (RFC 6238), atomic transaction isolation for zero-overselling and zero-duplicate admissions, client-side encrypted rosters for zero-drop offline scanning, and a fully normalized Third Normal Form (3NF) account architecture.

## Table of Contents

1. System Architecture and Core Engineering Principles
2. Cryptographic Security and Admission Verification
3. High-Concurrency Transaction Isolation
4. Zero-Drop Offline Scanning Engine
5. Third Normal Form (3NF) Database Design
6. Real-Time Operations and Financial Telemetry
7. Technology Stack
8. REST API Specification
9. Environment Configuration and Setup
10. Verification and Automated Test Suites

## 1. System Architecture and Core Engineering Principles

Traditional event check-in systems rely on static QR codes that can be easily screenshotted, duplicated, and shared across attendees, leading to gate fraud and capacity disputes. Furthermore, unstable mobile networks at crowded venues frequently cause scanning stalls or database desynchronization.

VOUCH addresses these challenges through five foundational pillars:

1. Dynamic Identity Tokens: Static barcodes are replaced with client-generated, rotating TOTP tokens that refresh every 30 seconds.
2. Guaranteed Atomic Operations: All capacity modifications and check-in verifications execute inside atomic database transactions, preventing race conditions.
3. Deterministic Offline Mode: Gate devices download AES-GCM encrypted rosters locally, enabling sub-millisecond offline validation with automatic write-ahead log replay upon reconnection.
4. Relational Data Integrity (3NF): A normalized schema separates user accounts, events, registrations, and check-in audit logs to eliminate data anomalies.
5. Multi-Layer RBAC: Strict separation of privileges between platform organizers, gate staff, and attendees enforced via Firebase Auth Custom Claims and server-side token validation.

## 2. Cryptographic Security and Admission Verification

### Dynamic TOTP Rotation (RFC 6238)
When an attendee registers for an event, the server securely provisions an RFC 6238 base32 secret unique to that registration record.

The attendee's client generates a dynamic 6-digit Time-based One-Time Password (TOTP) that rotates every 30 seconds using HMAC-SHA1. The QR payload rendered on the attendee pass consists of:

```json
{
  "r": "registration_id",
  "e": "event_id",
  "t": "123456",
  "ts": 1724284800
}
```

When scanned by the organizer's gate camera:
1. The server extracts the stored secret for `registration_id`.
2. The server verifies the OTP token within an allowed time drift window (+/- 1 interval of 30 seconds).
3. If an attendee attempts to present a static screenshot, the token expires within seconds, rendering fraudulent duplication impossible.

### Client-Side Roster Encryption (AES-GCM-256)
When an organizer prepares a gate scanner for offline operation, the server dispatches a roster manifest encrypted with an ephemeral AES-GCM-256 key derived via WebCrypto PBKDF2. This ensures that attendee secrets and personally identifiable information (PII) are never stored in plaintext within client IndexedDB storage.

## 3. High-Concurrency Transaction Isolation

### Elimination of Race Conditions
In high-throughput registration and gate admission scenarios, simultaneous concurrent requests can lead to over-registration or duplicate admissions. VOUCH prevents these issues using Cloud Firestore atomic transactions.

### Registration Capacity Decrement
```
Client Request -> Firestore Transaction Begin
  1. Read Event Document (Capacity, Spots Remaining, Status)
  2. Verify Status == 'published'
  3. Verify Spots Remaining >= Requested Tickets
  4. Deduct Spots: spotsRemaining = spotsRemaining - requestedTickets
  5. Commit Event Document Write
  6. Insert Registration Record
Firestore Transaction Commit
```
If two attendees request the final remaining seat simultaneously, the transaction isolation guarantees that one request succeeds and the competing request fails with an HTTP 409 Conflict.

### Single-Admission Gate Enforcement
```
Scanner Request -> Firestore Transaction Begin
  1. Read Registration Record by ID
  2. Verify registration.status == 'active'
  3. Verify registration.checkedIn != true
  4. Verify current time falls within event admission window
  5. Set registration.checkedIn = true, checkedInAt = ServerTimestamp
  6. Insert Checkin Audit Log Entry
Firestore Transaction Commit
```
If two gate attendants scan the same pass at two different entry turnstiles within milliseconds, only the first transaction commits; the second receives a duplicate rejection payload with the timestamp of the prior admission.

## 4. Zero-Drop Offline Scanning Engine

To guarantee continuous gate operations in dead zones or crowded venue environments:

1. Local Roster Caching: The organizer scanner caches the verified attendee roster in browser IndexedDB.
2. Local Validation: When offline, the scanner evaluates the TOTP code against the local encrypted secret and checks local IndexedDB state.
3. Write-Ahead Log (WAL): Admitted offline scans are assigned a unique, client-generated idempotency key (`clientScanId`), timestamped, and stored in a pending IndexedDB queue.
4. Auto-Reconciliation: When network connectivity is restored, the scanner streams pending scans to `/api/checkins/sync`. The server processes each entry within a transaction, recording the authoritative server sync time while logging the physical scan timestamp.
5. Conflict Resolution: If an offline pass was already scanned online by another station, the sync log flags a `duplicate_conflict` without corrupting the authoritative audit record.

## 5. Database Design

The data architecture adheres to Third Normal Form (3NF) principles, eliminating partial and transitive functional dependencies.

```
+-------------------------------------------------------------+
| USERS (Entity: Primary User Account)                        |
+-------------------------------------------------------------+
| id (PK)           : string (Firebase Auth UID)              |
| email (UK)        : string (Normalized lowercase email)     |
| displayName       : string                                  |
| photoURL          : string (Optional)                       |
| role              : 'organizer' | 'attendee'                |
| accountStatus     : 'active' | 'suspended'                  |
| createdAt         : timestamp                               |
| lastLoginAt       : timestamp                               |
| updatedAt         : timestamp                               |
+-------------------------------------------------------------+
                              |
                              | 1:N
                              v
+-------------------------------------------------------------+
| EVENTS (Entity: Managed Event Instance)                     |
+-------------------------------------------------------------+
| id (PK)           : string (UUID)                           |
| organizerId (FK)  : string (References USERS.id)            |
| name              : string                                  |
| description       : string                                  |
| eventDate         : timestamp (ISO Start Date)              |
| eventEndDate      : timestamp (ISO End Date)                |
| timezone          : string (IANA Timezone)                  |
| venue             : string                                  |
| bannerUrl         : string (Cloud Storage Reference)        |
| ticketPrice       : decimal                                 |
| currency          : string                                  |
| capacity          : integer                                 |
| spotsRemaining    : integer                                 |
| status            : 'published' | 'cancelled'               |
| cancellationReason: string (Optional apology note)          |
| createdAt         : timestamp                               |
+-------------------------------------------------------------+
                              |
                              | 1:N
                              v
+-------------------------------------------------------------+
| REGISTRATIONS (Entity: Ticket & Pass Record)                |
+-------------------------------------------------------------+
| id (PK)           : string (UUID)                           |
| eventId (FK)      : string (References EVENTS.id)           |
| attendeeId (FK)   : string (References USERS.id)            |
| attendeeEmail     : string (Normalized email)               |
| passCode (UK)     : string (e.g. VCH-7X9K-M2P4)             |
| guestCount        : integer                                 |
| totpSecret        : string (Base32 Encrypted Secret)        |
| status            : 'active' | 'cancelled'                  |
| checkedIn         : boolean                                 |
| checkedInAt       : timestamp (Optional)                    |
| createdAt         : timestamp                               |
+-------------------------------------------------------------+
                              |
                              | 1:N
                              v
+-------------------------------------------------------------+
| CHECKIN_LOGS (Entity: Admission Audit Trail)                |
+-------------------------------------------------------------+
| id (PK)           : string (UUID)                           |
| registrationId(FK): string (References REGISTRATIONS.id)    |
| eventId (FK)      : string (References EVENTS.id)           |
| scannedByUserId(FK: string (References USERS.id)            |
| stationId         : string (e.g. Gate 1, Turnstile A)       |
| clientScanId (UK) : string (Idempotency Key)                |
| clientScannedAt   : timestamp (Local device timestamp)      |
| syncedAt          : timestamp (Server receipt timestamp)    |
| result            : 'success' | 'duplicate_conflict'        |
| createdAt         : timestamp                               |
+-------------------------------------------------------------+
```

## 6. Real-Time Operations and Financial Telemetry

The organizer dashboard provides live telemetry for operational decision-making:

1. Admission Velocity: Live 15-minute check-in histogram charting gate throughput and identifying peak ingress congestion.
2. Financial Realization: Automated computation of Gross Revenue, Net Revenue, Refund Deductions, Average Order Value (AOV), and Capacity Monetization Rate.
3. Live Roster Auditing: Instant attendee search by name, email, admission status, and pass code with manual admission override capabilities for customer service staff.
4. Synchronized Cancellation Pipeline: Atomic event cancellation workflow with automatic seat deallocation, batch ticket refund status updates, and reason broadcasting.

## 7. Technology Stack

### Frontend
- Next.js 15 (App Router with React Server Components and Client Components)
- React 19 (Hooks, Concurrent Rendering, Context API)
- TypeScript 5.7 (Strict Type Safety across Models and API contracts)
- TailwindCSS 3.4 (Custom Design Tokens, Fluid Typography, Zero-Layout-Shift styling)
- HTML5-QRCode (Hardware Camera Access and High-Speed Video Stream Decoding)
- Lucide React & Canvas Confetti (UX Telemetry and Interactive Visual Feedback)

### Backend and Infrastructure
- Next.js Edge and Node.js Route Handlers
- Firebase Admin SDK 13 (Server-Side Token Verification, Custom Claims, Cloud Firestore Transactions)
- Google Cloud Storage (Client-side compressed event poster asset storage)
- WebCrypto API & Otplib (Cryptographic Key Derivation, AES-GCM-256, RFC 6238 TOTP)
- IndexedDB (`idb` v8) (Client-Side Write-Ahead Storage for Offline Gate Scans)

## 8. REST API Specification

### Authentication and User Management
- `GET /api/auth/me`: Authenticates Bearer ID token, ensures user record exists in 3NF `users` table, and returns authoritative user profile and RBAC role.
- `POST /api/auth/check-role`: Validates current authorization role and verifies organizer permissions.

### Event Operations
- `GET /api/events`: Retrieves public event catalog with live seat availability.
- `POST /api/events`: Creates and publishes a new event (Organizer role required).
- `GET /api/events/[id]`: Retrieves event details and organizer metrics.
- `PATCH /api/events/[id]`: Updates event metadata, pricing, or capacity.
- `POST /api/events/[id]/cancel`: Atomically cancels an event, triggers refund pipelines, and records cancellation reason.
- `DELETE /api/events/[id]`: Purges an event record and unlinks associated assets.

### Registration and Pass Issuance
- `POST /api/registrations`: Executes atomic capacity check and creates a registration with TOTP secret generation.
- `GET /api/registrations/[id]`: Returns registration details, pass verification payload, and event metadata (Secured against IDOR).
- `POST /api/registrations/[id]/cancel`: Allows attendees to release seats up to 30 minutes before event start.
- `GET /api/attendee/registrations`: Retrieves all active and historical passes for the authenticated user.

### Gate Check-In and Verification
- `POST /api/checkins/scan`: Live online gate check-in endpoint validating dynamic TOTP token within an atomic Firestore transaction.
- `POST /api/checkins/sync`: Batch reconciliation endpoint for offline write-ahead log entries with idempotency verification.
- `GET /api/organizer/events/[id]/roster`: Dispatches offline encrypted roster package for scanner initialization.

## 9. Environment Configuration and Setup

### Prerequisites
- Node.js 18.x or 20.x LTS
- npm or pnpm
- Firebase Project with Firestore, Firebase Authentication (Google Provider), and Firebase Storage enabled.

### Environment Variables (.env.local)
```env
# Client-Side Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Server-Side Firebase Admin Configuration
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----"

# Authoritative Organizer Configuration
ORGANIZER_EMAILS=misrasaptarshi099@gmail.com
```

### Installation Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/misrasaptarshi099-dotcom/Event-check-In.git
   cd Event-check-In
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Initialize and normalize the database:
   ```bash
   npm run db:clean
   ```

4. Launch local development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

## 10. Verification and Automated Test Suites

VOUCH includes dedicated load-testing and verification scripts to validate system integrity under peak concurrency conditions.

### 1. Static Typecheck
Validates zero type errors across the entire codebase:
```bash
npm run typecheck
```

### 2. Registration Capacity Race Test
Simulates 20 concurrent registration requests attempting to book the final 2 remaining seats of an event, verifying that exactly 2 succeed and 18 receive atomic capacity rejections:
```bash
npm run test:capacity-race
```

### 3. Check-In Double-Scan Race Test
Simulates multiple simultaneous scans of the same pass across separate turnstiles, asserting that exactly one check-in commits and competing requests are flagged as duplicate admissions:
```bash
npm run test:checkin-race
```

### 4. RBAC Permission Test
Verifies that unauthenticated or attendee-level tokens are rejected with HTTP 403 Forbidden when accessing organizer endpoints:
```bash
npm run test:rbac
```

### 5. Run Complete Test Suite
```bash
npm run test:all
```
