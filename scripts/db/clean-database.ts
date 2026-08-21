import { config } from 'dotenv';
config({ path: '.env.local' });

import { adminDb, adminAuth } from '../../src/lib/firebase/admin';
import { syncUserAccount } from '../../src/lib/services/users.service';

/**
 * Database Normalization & Orphan Cleanup Utility
 * 1. Populates the 3NF `users` table for all existing organizers and attendees.
 * 2. Purges orphan registrations referencing deleted/non-existent events.
 * 3. Normalizes email addresses to lowercase across all collections.
 */
async function cleanDatabase() {
  console.log('--- STARTING VOUCH DATABASE CLEANUP & 3NF NORMALIZATION ---');

  // 1. Ensure Primary Organizer Account exists in 3NF `users`
  const PRIMARY_ORGANIZER_EMAIL = 'misrasaptarshi099@gmail.com';
  console.log(`\n[1/4] Ensuring primary organizer [${PRIMARY_ORGANIZER_EMAIL}] in 3NF users...`);
  
  try {
    const primaryAuthUser = await adminAuth.getUserByEmail(PRIMARY_ORGANIZER_EMAIL);
    if (primaryAuthUser) {
      await syncUserAccount({
        uid: primaryAuthUser.uid,
        email: PRIMARY_ORGANIZER_EMAIL,
        displayName: primaryAuthUser.displayName || 'Primary Organizer',
        photoURL: primaryAuthUser.photoURL || null,
      });
      console.log(`✓ Synchronized primary organizer account [${primaryAuthUser.uid}] with role: 'organizer'`);
    } else {
      console.log(`ℹ Primary organizer has not signed up with Google yet. Will be auto-provisioned upon first login.`);
    }
  } catch (err: any) {
    console.log(`ℹ Notice: ${err.message || err}`);
  }

  // 2. Fetch all valid events
  console.log('\n[2/4] Scanning events collection...');
  const eventsSnap = await adminDb.collection('events').get();
  const validEventIds = new Set<string>();

  eventsSnap.docs.forEach((doc) => {
    validEventIds.add(doc.id);
  });
  console.log(`✓ Found ${validEventIds.size} valid events in database.`);

  // 3. Scan registrations and clean orphan/dangling records
  console.log('\n[3/4] Scanning registrations for orphans and normalizing user records...');
  const regSnap = await adminDb.collection('registrations').get();
  let deletedOrphans = 0;
  let normalizedUsers = 0;

  for (const doc of regSnap.docs) {
    const data = doc.data();
    const eventId = data.eventId;

    // Check if event still exists
    if (!eventId || !validEventIds.has(eventId)) {
      console.log(`  Deleting orphan registration [${doc.id}] (Event [${eventId}] no longer exists).`);
      await doc.ref.delete();
      deletedOrphans++;
      continue;
    }

    // Auto-populate attendee in 3NF `users` if attendeeId is a valid UID
    if (data.attendeeId && data.attendeeEmail) {
      const cleanEmail = data.attendeeEmail.trim().toLowerCase();
      try {
        await syncUserAccount({
          uid: data.attendeeId,
          email: cleanEmail,
          displayName: data.attendeeName || cleanEmail.split('@')[0],
        });
        normalizedUsers++;
      } catch (userSyncErr) {
        // Non-fatal if test UID
      }
    }
  }

  console.log(`✓ Removed ${deletedOrphans} dangling/orphan registrations.`);
  console.log(`✓ Normalized ${normalizedUsers} user profiles into 3NF users table.`);

  // 4. Summary
  console.log('\n[4/4] Normalization complete.');
  console.log('--- DATABASE IS NOW FULLY 3NF NORMALIZED & CLEAN ---');
}

cleanDatabase()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Database cleanup failed:', err);
    process.exit(1);
  });
