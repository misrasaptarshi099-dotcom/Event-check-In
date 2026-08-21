/**
 * Timezone and datetime utilities for event scheduling.
 * Translates between local wall-clock datetime strings in arbitrary IANA timezones
 * and exact UTC ISO timestamps.
 */

/**
 * Converts a datetime-local string (e.g. "2026-08-25T18:00") and an IANA timezone (e.g. "Asia/Kolkata")
 * into the exact corresponding UTC ISO-8601 string ("2026-08-25T12:30:00.000Z").
 */
export function convertLocalToUtcIso(dateTimeLocalStr: string, timeZone: string): string {
  if (!dateTimeLocalStr) return '';

  // Extract YYYY, MM, DD, HH, mm, ss from "YYYY-MM-DDTHH:mm" or "YYYY-MM-DDTHH:mm:ss"
  const match = dateTimeLocalStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    // Fallback if not standard datetime-local format
    return new Date(dateTimeLocalStr).toISOString();
  }

  const [, yStr, mStr, dStr, hStr, minStr, sStr] = match;
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const day = parseInt(dStr, 10);
  const hour = parseInt(hStr, 10);
  const minute = parseInt(minStr, 10);
  const second = sStr ? parseInt(sStr, 10) : 0;

  // Initial naive UTC timestamp representing those clock digits
  const targetUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);

  const getOffsetDiff = (timestampMs: number): number => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(new Date(timestampMs));
    const partMap: Record<string, string> = {};
    for (const p of parts) {
      partMap[p.type] = p.value;
    }

    let fHour = parseInt(partMap.hour || '0', 10);
    // In hour12: false, midnight can sometimes be rendered as 24
    if (fHour === 24) fHour = 0;

    const formattedMs = Date.UTC(
      parseInt(partMap.year, 10),
      parseInt(partMap.month, 10) - 1,
      parseInt(partMap.day, 10),
      fHour,
      parseInt(partMap.minute || '0', 10),
      parseInt(partMap.second || '0', 10)
    );

    return formattedMs - timestampMs;
  };

  try {
    const diff1 = getOffsetDiff(targetUtcMs);
    let resolvedUtcMs = targetUtcMs - diff1;

    // Refine once for Daylight Saving Time boundaries
    const diff2 = getOffsetDiff(resolvedUtcMs);
    if (diff2 !== diff1) {
      resolvedUtcMs = targetUtcMs - diff2;
    }

    return new Date(resolvedUtcMs).toISOString();
  } catch (err) {
    console.warn(`Timezone conversion failed for tz=${timeZone}:`, err);
    return new Date(dateTimeLocalStr).toISOString();
  }
}

/**
 * Converts a UTC ISO timestamp into "YYYY-MM-DDTHH:mm" for datetime-local input
 * rendered in the specified target timezone.
 */
export function formatUtcToLocalInput(utcIsoStr: string, timeZone: string): string {
  if (!utcIsoStr) return '';

  try {
    const date = new Date(utcIsoStr);
    if (isNaN(date.getTime())) return '';

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const partMap: Record<string, string> = {};
    for (const p of parts) {
      partMap[p.type] = p.value;
    }

    let hour = partMap.hour || '00';
    if (hour === '24') hour = '00';

    return `${partMap.year}-${partMap.month}-${partMap.day}T${hour}:${partMap.minute}`;
  } catch {
    return utcIsoStr.slice(0, 16);
  }
}
