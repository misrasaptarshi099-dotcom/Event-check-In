import { NextResponse } from 'next/server';
import { getRegistrationsByEvent } from '@/lib/services/registrations.service';
import { getCheckinsByEvent } from '@/lib/services/checkins.service';
import { getEventById } from '@/lib/services/events.service';
import { verifyAuthToken, requireRole, requireOwnership } from '@/lib/security/rbac';
import { checkRateLimit, getRateLimitKey, EXPORT_LIMIT } from '@/lib/security/rateLimit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params;
    const authHeader = request.headers.get('Authorization');
    const user = await verifyAuthToken(authHeader);
    requireRole(user, 'organizer');

    const event = await getEventById(eventId);
    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }

    requireOwnership(user, event.organizerId);

    const rateLimitRes = checkRateLimit(getRateLimitKey(request, user.uid), EXPORT_LIMIT);
    if (rateLimitRes) return rateLimitRes;

    const [registrations, checkins] = await Promise.all([
      getRegistrationsByEvent(eventId),
      getCheckinsByEvent(eventId),
    ]);

    const checkinMap = new Map<string, any>();
    for (const c of checkins) {
      checkinMap.set(c.registrationId, c);
    }

    const now = Date.now();
    const isEventConcluded = event.eventEndDate
      ? new Date(event.eventEndDate).getTime() <= now
      : new Date(event.eventDate).getTime() <= now;

    // Build CSV content
    const headers = [
      'Registration ID',
      'Attendee Name',
      'Attendee Email',
      'Seats Booked',
      'Unit Ticket Price',
      'Total Paid',
      'Status',
      'Lifecycle Status',
      'Checked In',
      'Check-in Timestamp',
      'Station ID',
      'Registered At',
    ];

    const escapeCell = (val: string | null | undefined): string => {
      if (!val) return '""';
      const str = String(val);
      const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
      return `"${safe.replace(/"/g, '""')}"`;
    };

    const rows = registrations.map((r) => {
      const checkin = checkinMap.get(r.id);
      const seats = r.guestCount || 1;
      const unitPrice = r.ticketPrice ?? event.ticketPrice ?? 0;
      const totalPaid = unitPrice * seats;

      let lifecycleStatus = 'CONFIRMED';
      if (r.status === 'cancelled') {
        lifecycleStatus = 'CANCELLED';
      } else if (checkin) {
        lifecycleStatus = isEventConcluded ? 'ATTENDED' : 'CHECKED IN';
      } else if (isEventConcluded) {
        lifecycleStatus = 'NO SHOW';
      }

      return [
        escapeCell(r.id),
        escapeCell(r.attendeeName),
        escapeCell(r.attendeeEmail),
        seats,
        unitPrice,
        totalPaid,
        escapeCell(r.status),
        escapeCell(lifecycleStatus),
        checkin ? 'YES' : 'NO',
        escapeCell(checkin?.checkedInAt),
        escapeCell(checkin?.stationId),
        escapeCell(r.createdAt),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${event.name.replace(/[^a-z0-9]/gi, '_')}_export.csv"`,
      },
    });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json({ error: error.message || 'Export failed.' }, { status });
  }
}
