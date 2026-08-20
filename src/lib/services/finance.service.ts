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

  // Fetch active registrations
  const registrationsSnap = await adminDb
    .collection('registrations')
    .where('eventId', '==', eventId)
    .orderBy('createdAt', 'desc')
    .get();

  const registrations = registrationsSnap.docs.map((doc) => doc.data() as Registration);

  const activeRegistrations = registrations.filter((r) => r.status === 'active');
  const cancelledRegistrations = registrations.filter((r) => r.status === 'cancelled');

  const paidTicketsCount = activeRegistrations.length;
  const unpaidTicketsCount = cancelledRegistrations.length;

  const grossRevenue = paidTicketsCount * ticketPrice;
  const refundedAmount = unpaidTicketsCount * ticketPrice;
  const netRevenue = grossRevenue; // Net after cancellations

  const projectedRevenue = (event.capacity || 0) * ticketPrice;
  const occupancyFinancialRate =
    projectedRevenue > 0 ? Math.round((grossRevenue / projectedRevenue) * 100) : (paidTicketsCount > 0 ? 100 : 0);

  const averageOrderValue = paidTicketsCount > 0 ? ticketPrice : 0;

  // Build transaction ledger
  const recentTransactions: TransactionEntry[] = registrations.map((r) => ({
    id: `tx_${r.id}`,
    registrationId: r.id,
    attendeeName: r.attendeeName,
    attendeeEmail: r.attendeeEmail,
    amount: r.ticketPrice ?? ticketPrice,
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
