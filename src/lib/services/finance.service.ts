import { adminDb } from '@/lib/firebase/admin';
import type { FinanceBundle, TransactionEntry, EventItem, Registration } from '@/types';

/**
 * Computes live financial and revenue analytics for a given event.
 *
 * Reads event pricing structure and registered attendees to calculate:
 * - Gross and net revenue
 * - Realized vs. projected capacity ceiling
 * - Average order value (AOV)
 * - Complete itemized transaction ledger
 */
export async function computeEventFinance(eventId: string): Promise<FinanceBundle> {
  const eventDoc = await adminDb.collection('events').doc(eventId).get();
  if (!eventDoc.exists) {
    throw new Error(`Event ${eventId} not found.`);
  }
  const event = eventDoc.data() as EventItem;
  const ticketPrice = Number(event.ticketPrice || 0);
  const currency = event.currency || 'USD';

  // Fetch event registrations constrained to latest 250 records for ledger
  let registrationsSnap;
  try {
    registrationsSnap = await adminDb
      .collection('registrations')
      .where('eventId', '==', eventId)
      .orderBy('createdAt', 'desc')
      .limit(250)
      .get();
  } catch {
    registrationsSnap = await adminDb
      .collection('registrations')
      .where('eventId', '==', eventId)
      .get();
  }

  const registrations = registrationsSnap.docs
    .map((doc) => doc.data() as Registration)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const activeRegistrations = registrations.filter((r) => r.status === 'active');
  const cancelledRegistrations = registrations.filter((r) => r.status === 'cancelled');

  // Sum total booked seats/tickets across active and cancelled registrations
  const paidTicketsCount = activeRegistrations.reduce((sum, r) => sum + (r.guestCount || 1), 0);
  const unpaidTicketsCount = cancelledRegistrations.reduce((sum, r) => sum + (r.guestCount || 1), 0);

  const grossRevenue = activeRegistrations.reduce((sum, r) => {
    const price = r.ticketPrice !== undefined ? r.ticketPrice : ticketPrice;
    return sum + (price * (r.guestCount || 1));
  }, 0);

  const refundedAmount = cancelledRegistrations.reduce((sum, r) => {
    const price = r.ticketPrice !== undefined ? r.ticketPrice : ticketPrice;
    return sum + (price * (r.guestCount || 1));
  }, 0);

  const netRevenue = grossRevenue; // Net after cancellations

  const projectedRevenue = (event.capacity || 0) * ticketPrice;
  const occupancyFinancialRate =
    projectedRevenue > 0 ? Math.round((grossRevenue / projectedRevenue) * 100) : (paidTicketsCount > 0 ? 100 : 0);

  const averageOrderValue = activeRegistrations.length > 0 ? Math.round(grossRevenue / activeRegistrations.length) : 0;

  // Build transaction ledger with guestCount-scaled amounts
  const recentTransactions: TransactionEntry[] = registrations.map((r) => ({
    id: `tx_${r.id}`,
    registrationId: r.id,
    attendeeName: (r.guestCount || 1) > 1
      ? `${r.attendeeName} (+${r.guestCount - 1} ${r.guestCount === 2 ? 'Guest' : 'Guests'})`
      : r.attendeeName,
    attendeeEmail: r.attendeeEmail,
    amount: (r.ticketPrice !== undefined ? r.ticketPrice : ticketPrice) * (r.guestCount || 1),
    currency,
    status: r.status === 'active' ? 'completed' : 'refunded',
    createdAt: r.createdAt,
  }));

  return {
    eventId,
    eventName: event.name,
    ticketPrice,
    currency,
    grossRevenue,
    netRevenue,
    refundedAmount,
    paidTicketsCount,
    unpaidTicketsCount,
    averageOrderValue,
    projectedRevenue,
    occupancyFinancialRate,
    recentTransactions,
    computedAt: new Date().toISOString(),
  };
}
