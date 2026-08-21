import { GoogleGenAI } from '@google/genai';
import { adminDb } from '@/lib/firebase/admin';
import { computeEventStats } from './stats.service';
import { computeEventFinance } from './finance.service';
import { formatCurrency } from '@/lib/utils/format';
import { sanitizeAiPrompt } from '@/lib/security/sanitize';
import type { StatsBundle, FinanceBundle, EventItem, Registration } from '@/types';

const GEMINI_TIMEOUT_MS = 15_000;
const MAX_OUTPUT_TOKENS = 1200;

export interface AiInsightResponse {
  answer: string;
  stats: StatsBundle;
  finance: FinanceBundle;
  source: 'ai' | 'fallback';
}

interface PredictiveTelemetry {
  eventName: string;
  currency: string;
  ticketPrice: number;
  capacity: number;
  totalBookedSeats: number;
  spotsRemaining: number;
  occupancyRatePct: number;
  eventStatus: 'UPCOMING' | 'LIVE_NOW' | 'CONCLUDED';
  nowIso: string;
  eventStartIso: string;
  eventEndIso: string | null;
  hoursUntilStart: number;
  hoursUntilEnd: number | null;
  registrationDurationHours: number;
  hourlyBookingPace: number;
  bookingsLast24Hours: number;
  bookingsLast6Hours: number;
  projectedIncrementalBookings: number;
  projectedFinalSeats: number;
  projectedFinalRevenue: number;
  conservativeRevenue: number;
  optimisticRevenue: number;
  fullCapacityRevenueCeiling: number;
  checkedInSeats: number;
  checkInRatePct: number;
  noShowCount: number;
  noShowPct: number | null;
  peakRushHour: string;
  peakCheckinCount: number;
}

/**
 * Gathers and computes rich chronological booking trends and predictive telemetry.
 */
async function gatherPredictiveTelemetry(
  eventId: string,
  stats: StatsBundle,
  finance: FinanceBundle
): Promise<PredictiveTelemetry> {
  const eventDoc = await adminDb.collection('events').doc(eventId).get();
  const event = eventDoc.data() as EventItem;

  const registrationsSnap = await adminDb
    .collection('registrations')
    .where('eventId', '==', eventId)
    .get();

  const registrations = registrationsSnap.docs
    .map((d) => d.data() as Registration)
    .filter((r) => r.status !== 'cancelled');

  const now = Date.now();
  const eventStartTime = new Date(event.eventDate).getTime();
  const eventEndTime = event.eventEndDate ? new Date(event.eventEndDate).getTime() : null;

  const hoursUntilStart = (eventStartTime - now) / (1000 * 60 * 60);
  const hoursUntilEnd = eventEndTime ? (eventEndTime - now) / (1000 * 60 * 60) : null;

  let eventStatus: 'UPCOMING' | 'LIVE_NOW' | 'CONCLUDED' = 'UPCOMING';
  if (now >= eventStartTime) {
    if (eventEndTime && now >= eventEndTime) {
      eventStatus = 'CONCLUDED';
    } else {
      eventStatus = 'LIVE_NOW';
    }
  }

  // Calculate booking pace over time
  const timestamps = registrations
    .map((r) => new Date(r.createdAt || 0).getTime())
    .filter((t) => !isNaN(t) && t > 0)
    .sort((a, b) => a - b);

  const firstBookingTime = timestamps.length > 0 ? timestamps[0] : (event.createdAt ? new Date(event.createdAt).getTime() : now);
  const registrationDurationHours = Math.max(0.5, (now - firstBookingTime) / (1000 * 60 * 60));

  const ms24hAgo = now - 24 * 60 * 60 * 1000;
  const ms6hAgo = now - 6 * 60 * 60 * 1000;

  let bookingsLast24Hours = 0;
  let bookingsLast6Hours = 0;

  for (const r of registrations) {
    const t = new Date(r.createdAt || 0).getTime();
    const seats = r.guestCount || 1;
    if (t >= ms24hAgo) bookingsLast24Hours += seats;
    if (t >= ms6hAgo) bookingsLast6Hours += seats;
  }

  const totalBookedSeats = stats.registeredCount;
  const hourlyBookingPace = +(totalBookedSeats / registrationDurationHours).toFixed(2);

  // Predictive model: run rate over remaining hours before start
  const remainingWindowHours = Math.max(0, hoursUntilStart);
  const projectedIncrementalBookings = Math.min(
    stats.spotsRemaining,
    Math.round(hourlyBookingPace * remainingWindowHours)
  );

  const projectedFinalSeats = Math.min(stats.capacity, totalBookedSeats + projectedIncrementalBookings);
  const projectedFinalRevenue = projectedFinalSeats * finance.ticketPrice;
  const conservativeRevenue = (totalBookedSeats + Math.floor(projectedIncrementalBookings * 0.5)) * finance.ticketPrice;
  const optimisticRevenue = Math.min(stats.capacity * finance.ticketPrice, (totalBookedSeats + Math.ceil(projectedIncrementalBookings * 1.5)) * finance.ticketPrice);

  return {
    eventName: stats.eventName,
    currency: finance.currency,
    ticketPrice: finance.ticketPrice,
    capacity: stats.capacity,
    totalBookedSeats,
    spotsRemaining: stats.spotsRemaining,
    occupancyRatePct: finance.occupancyFinancialRate,
    eventStatus,
    nowIso: new Date(now).toISOString(),
    eventStartIso: event.eventDate,
    eventEndIso: event.eventEndDate || null,
    hoursUntilStart: +hoursUntilStart.toFixed(1),
    hoursUntilEnd: hoursUntilEnd !== null ? +hoursUntilEnd.toFixed(1) : null,
    registrationDurationHours: +registrationDurationHours.toFixed(1),
    hourlyBookingPace,
    bookingsLast24Hours,
    bookingsLast6Hours,
    projectedIncrementalBookings,
    projectedFinalSeats,
    projectedFinalRevenue,
    conservativeRevenue,
    optimisticRevenue,
    fullCapacityRevenueCeiling: finance.projectedRevenue,
    checkedInSeats: stats.checkedInCount,
    checkInRatePct: stats.registeredCount > 0 ? Math.round((stats.checkedInCount / stats.registeredCount) * 100) : 0,
    noShowCount: stats.noShowCount,
    noShowPct: stats.noShowPct,
    peakRushHour: stats.peakCheckinBucket,
    peakCheckinCount: stats.peakCheckinCount,
  };
}

/**
 * AI Event Insights Service (Proactive Predictive Revenue & Operations Intelligence)
 */
export async function getAiInsight(
  eventId: string,
  question: string
): Promise<AiInsightResponse> {
  const sanitizedQuestion = sanitizeAiPrompt(question, 800);
  if (!sanitizedQuestion) {
    throw new Error('Question cannot be empty.');
  }

  const [stats, finance] = await Promise.all([
    computeEventStats(eventId),
    computeEventFinance(eventId),
  ]);

  const telemetry = await gatherPredictiveTelemetry(eventId, stats, finance);

  try {
    const answer = await queryGemini(telemetry, stats, finance, sanitizedQuestion);
    return { answer, stats, finance, source: 'ai' };
  } catch (error) {
    console.warn('[AI-INSIGHTS] Gemini failed or timed out, falling back to statistical model:', error);
    const fallbackAnswer = generateFallbackAnswer(telemetry, stats, finance, sanitizedQuestion);
    return { answer: fallbackAnswer, stats, finance, source: 'fallback' };
  }
}

/**
 * Queries Gemini with rich predictive telemetry and senior revenue strategist prompt.
 */
async function queryGemini(
  telemetry: PredictiveTelemetry,
  stats: StatsBundle,
  finance: FinanceBundle,
  question: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: GEMINI_TIMEOUT_MS },
  });

  const systemPrompt = `You are VOUCH AI, an elite Event Operations Data Scientist, Revenue Forecaster, and Strategic Growth Consultant.
You work directly with event organizers to provide actionable intelligence, mathematical revenue forecasting, booking velocity trends, and operational optimizations.

CORE DIRECTIVES:
1. REVENUE FORECASTING & BALLPARK ESTIMATES:
   - When asked to predict revenue, forecast future ticket sales, or estimate ballpark numbers:
     * Leverage the provided booking pace (${telemetry.hourlyBookingPace} seats/hour), time remaining before start (${telemetry.hoursUntilStart > 0 ? telemetry.hoursUntilStart + ' hours left' : 'Event already started/active'}), and capacity ceiling.
     * Present clear forecast scenarios: Conservative Case, Expected Baseline, and Bull/Sellout Case.
     * Explain the mathematical rationale concisely (e.g. "At your current velocity of X tickets/hr over the remaining Y hours, you are on track to generate an additional Z...").
2. CONTEXTUAL & PROACTIVE INTELLIGENCE:
   - Factor in the event's current state (${telemetry.eventStatus}), recent sales momentum (last 24h: ${telemetry.bookingsLast24Hours} seats, last 6h: ${telemetry.bookingsLast6Hours} seats), and gate check-in conversion.
   - Provide concrete, strategic recommendations (e.g., promotional pushes, closing registration early, gate staffing for peak rush hour ${telemetry.peakRushHour}, dynamic pricing).
3. PROFESSIONAL & NATURAL EXECUTIVE TONE:
   - Use bold numbers and proper currency symbols (${telemetry.currency}).
   - Structure responses with clean bullet points and succinct executive takeaways.
   - NEVER use generic rejection disclaimers like "I can only answer questions about...". Always extrapolate intelligently from the real telemetry provided.`;

  const context = `
COMPREHENSIVE EVENT TELEMETRY & RUN-RATE PREDICTIONS:
${JSON.stringify(telemetry, null, 2)}

DETAILED STATS BUNDLE:
${JSON.stringify(stats, null, 2)}

DETAILED FINANCE BUNDLE:
${JSON.stringify(finance, null, 2)}

ORGANIZER INQUIRY:
${question}`;

  const isGemini3 = modelName.startsWith('gemini-3');
  const generationConfig = {
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    ...(isGemini3 ? {} : { temperature: 0.4 }),
  };

  const response = await ai.models.generateContent({
    model: modelName,
    contents: [
      { role: 'user', parts: [{ text: systemPrompt + '\n\n' + context }] },
    ],
    config: generationConfig,
  });

  const text = response.text;

  if (!text || text.trim().length === 0) {
    throw new Error('Empty response from Gemini.');
  }

  return text.trim();
}

/**
 * Generates an advanced statistical forecast when Gemini API is offline.
 */
function generateFallbackAnswer(
  telemetry: PredictiveTelemetry,
  stats: StatsBundle,
  finance: FinanceBundle,
  question: string
): string {
  const q = question.toLowerCase();
  const curr = telemetry.currency;

  // Predictive / forecasting query
  if (
    q.includes('predict') ||
    q.includes('forecast') ||
    q.includes('ballpark') ||
    q.includes('how much can we make') ||
    q.includes('trend') ||
    q.includes('pace') ||
    q.includes('future') ||
    q.includes('time left')
  ) {
    if (telemetry.hoursUntilStart > 0) {
      return `📊 **Predictive Revenue & Velocity Forecast for ${telemetry.eventName}**:
- **Current Run-Rate:** Selling ~${telemetry.hourlyBookingPace} seats/hr (${telemetry.bookingsLast24Hours} seats booked in last 24h).
- **Time to Gate Open:** ${telemetry.hoursUntilStart} hours remaining.
- **Expected Baseline Forecast:** Projected **${telemetry.projectedFinalSeats} / ${telemetry.capacity} seats sold**, generating **${formatCurrency(telemetry.projectedFinalRevenue, curr)}** (an additional **${formatCurrency(telemetry.projectedFinalRevenue - finance.grossRevenue, curr)}**).
- **Conservative Forecast (50% pace):** **${formatCurrency(telemetry.conservativeRevenue, curr)}**.
- **Sellout Potential (100% capacity):** **${formatCurrency(telemetry.fullCapacityRevenueCeiling, curr)}** with ${telemetry.spotsRemaining} spots remaining.
*Recommendation:* Maintain promotional momentum over the next ${Math.round(telemetry.hoursUntilStart)} hours to capture the remaining ${formatCurrency(telemetry.fullCapacityRevenueCeiling - finance.grossRevenue, curr)} in untapped capacity.*`;
    } else {
      return `📊 **Event Status: ${telemetry.eventStatus}**:
- **Gross Revenue Realized:** **${formatCurrency(finance.grossRevenue, curr)}** (${finance.paidTicketsCount} tickets sold @ ${formatCurrency(finance.ticketPrice, curr)}).
- **Attendance Rate:** **${telemetry.checkedInSeats} / ${telemetry.totalBookedSeats} admitted** (${telemetry.checkInRatePct}% conversion).
- **No-Show Rate:** ${telemetry.noShowCount} unadmitted (${telemetry.noShowPct}%).
- **Full Capacity Ceiling Was:** ${formatCurrency(telemetry.fullCapacityRevenueCeiling, curr)}.`;
    }
  }

  // Financial queries
  if (q.includes('revenue') || q.includes('gross') || q.includes('money') || q.includes('sales') || q.includes('earned')) {
    return `💰 **Gross Revenue:** **${formatCurrency(finance.grossRevenue, curr)}** (${finance.paidTicketsCount} tickets sold @ ${formatCurrency(finance.ticketPrice, curr)}). Full capacity ceiling is **${formatCurrency(finance.projectedRevenue, curr)}** with **${telemetry.spotsRemaining} spots remaining**.`;
  }

  if (q.includes('price') || q.includes('cost')) {
    return `🏷️ **Ticket Unit Price:** **${formatCurrency(finance.ticketPrice, curr)}**. Average Order Value is **${formatCurrency(finance.averageOrderValue, curr)}**.`;
  }

  // Attendance queries
  if (q.includes('checked in') || q.includes('checkin') || q.includes('check-in') || q.includes('rush') || q.includes('peak')) {
    return `⚡ **Gate Operations:** **${stats.checkedInCount} / ${stats.registeredCount} checked in** (${telemetry.checkInRatePct}% conversion). Peak arrival was at **${stats.peakCheckinBucket}** with **${stats.peakCheckinCount} check-ins**.`;
  }

  if (q.includes('no-show') || q.includes('no show') || q.includes('absent')) {
    const lostRev = stats.noShowCount * finance.ticketPrice;
    return `⚠️ **No-Show Analysis:** **${stats.noShowCount} attendees** have not arrived (**${stats.noShowPct}% no-show rate**), representing **${formatCurrency(lostRev, curr)}** in no-show ticket value.`;
  }

  return `📊 **${stats.eventName} Executive Brief:**
- **Gross Revenue:** ${formatCurrency(finance.grossRevenue, curr)} (${telemetry.occupancyRatePct}% of ceiling)
- **Bookings:** ${stats.registeredCount} / ${stats.capacity} seats (${stats.spotsRemaining} remaining)
- **Velocity:** ~${telemetry.hourlyBookingPace} seats/hr (${telemetry.bookingsLast24Hours} in last 24h)
- **Gate Status:** ${stats.checkedInCount} admitted (Peak: ${stats.peakCheckinBucket} @ ${stats.peakCheckinCount} scans)`;
}

