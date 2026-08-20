import { GoogleGenAI } from '@google/genai';
import { computeEventStats } from './stats.service';
import { computeEventFinance } from './finance.service';
import type { StatsBundle, FinanceBundle } from '@/types';

const GEMINI_TIMEOUT_MS = 8_000;
const MAX_OUTPUT_TOKENS = 500;

export interface AiInsightResponse {
  answer: string;
  stats: StatsBundle;
  finance: FinanceBundle;
  source: 'ai' | 'fallback';
}

/**
 * AI Event Insights Service (HR-4 + Financial Intelligence)
 *
 * Calls Google Gemini API with precomputed attendance & financial statistics as context.
 * Returns a natural language response to the organizer's operational and financial queries.
 *
 * Budget Guardrails:
 * - Uses cost-efficient gemini-3.5-flash-lite model
 * - Strict maxOutputTokens: 500
 * - 8-second hard timeout via SDK httpOptions
 * - Rate limited upstream in the API route handler
 * - Fallback to raw computed stats/finance on any failure
 */
export async function getAiInsight(
  eventId: string,
  question: string
): Promise<AiInsightResponse> {
  // 1. Compute fresh stats and finance data
  const [stats, finance] = await Promise.all([
    computeEventStats(eventId),
    computeEventFinance(eventId),
  ]);

  // 2. Attempt Gemini AI response
  try {
    const answer = await queryGemini(stats, finance, question);
    return { answer, stats, finance, source: 'ai' };
  } catch (error) {
    // 3. Fallback to raw summary
    console.warn('[AI-INSIGHTS] Gemini failed or timed out, falling back to raw stats:', error);
    const fallbackAnswer = generateFallbackAnswer(stats, finance, question);
    return { answer: fallbackAnswer, stats, finance, source: 'fallback' };
  }
}

/**
 * Queries Gemini using the @google/genai SDK with built-in timeout.
 */
async function queryGemini(
  stats: StatsBundle,
  finance: FinanceBundle,
  question: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: GEMINI_TIMEOUT_MS },
  });

  const systemPrompt = `You are VOUCH AI, an event operations and financial intelligence assistant for event organizers.
You answer questions about the event attendance, check-in velocity, and financial revenue data provided below.
If you cannot answer from the provided data, say "I can only answer questions about this event's attendance and financial data."
Be concise, precise, and use exact numbers and currency symbols from the data. Never guess or hallucinate.`;

  const context = `
EVENT ATTENDANCE & CHECK-IN DATA:
${JSON.stringify(stats, null, 2)}

EVENT FINANCIAL & REVENUE DATA:
${JSON.stringify(finance, null, 2)}

ORGANIZER QUESTION: ${question}`;

  const isGemini3 = modelName.startsWith('gemini-3');
  const generationConfig = {
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    ...(isGemini3 ? {} : { temperature: 0.3 }),
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
 * Generates a raw statistical summary as fallback when Gemini is unavailable.
 */
function generateFallbackAnswer(
  stats: StatsBundle,
  finance: FinanceBundle,
  question: string
): string {
  const q = question.toLowerCase();

  // Financial queries
  if (q.includes('revenue') || q.includes('gross') || q.includes('money') || q.includes('sales') || q.includes('earned')) {
    return `Gross revenue is $${finance.grossRevenue.toLocaleString()} (${finance.paidTicketsCount} tickets sold at $${finance.ticketPrice} each). Projected 100% capacity revenue is $${finance.projectedRevenue.toLocaleString()}.`;
  }

  if (q.includes('price') || q.includes('ticket price') || q.includes('cost')) {
    return `Ticket price is $${finance.ticketPrice} ${finance.currency}. Average order value is $${finance.averageOrderValue}.`;
  }

  // Attendance queries
  if (q.includes('spot') || q.includes('remaining') || q.includes('available')) {
    return `There are ${stats.spotsRemaining} spots remaining out of ${stats.capacity} total capacity.`;
  }

  if (q.includes('checked in') || q.includes('checkin') || q.includes('check-in')) {
    return `${stats.checkedInCount} attendees have checked in out of ${stats.registeredCount} registered (${stats.registeredCount > 0 ? Math.round((stats.checkedInCount / stats.registeredCount) * 100) : 0}% check-in rate).`;
  }

  if (q.includes('no-show') || q.includes('no show') || q.includes('absent')) {
    const lostRev = stats.noShowCount * finance.ticketPrice;
    return `${stats.noShowCount} attendees have not checked in (${stats.noShowPct}% no-show rate), representing $${lostRev.toLocaleString()} in no-show ticket value.`;
  }

  if (q.includes('peak') || q.includes('busiest') || q.includes('rush')) {
    return `Peak check-in activity was at ${stats.peakCheckinBucket} with ${stats.peakCheckinCount} check-ins.`;
  }

  // General summary
  return `Event "${stats.eventName}": ${stats.checkedInCount}/${stats.registeredCount} checked in, $${finance.grossRevenue.toLocaleString()} revenue earned, ${stats.spotsRemaining} spots remaining. Peak: ${stats.peakCheckinBucket} (${stats.peakCheckinCount} check-ins). [AI fallback mode]`;
}
