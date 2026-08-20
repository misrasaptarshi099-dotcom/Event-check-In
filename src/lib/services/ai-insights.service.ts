import { GoogleGenerativeAI } from '@google/generative-ai';
import { computeEventStats } from './stats.service';
import type { StatsBundle } from '@/types';

const GEMINI_TIMEOUT_MS = 8_000;
const MAX_OUTPUT_TOKENS = 500;

/**
 * AI Event Insights Service (HR-4)
 *
 * Calls Google Gemini API with precomputed event statistics as context.
 * Returns a natural language response to the organizer's question.
 *
 * Budget Guardrails:
 * - Uses cost-efficient gemini-3.5-flash-lite model
 * - Strict maxOutputTokens: 500
 * - 8-second hard timeout with fallback to raw stats
 * - Rate limited upstream in the API route handler
 */
export async function getAiInsight(
  eventId: string,
  question: string
): Promise<{ answer: string; stats: StatsBundle; source: 'ai' | 'fallback' }> {
  // 1. Compute fresh stats
  const stats = await computeEventStats(eventId);

  // 2. Attempt Gemini AI response
  try {
    const answer = await queryGeminiWithTimeout(stats, question);
    return { answer, stats, source: 'ai' };
  } catch (error) {
    // 3. Fallback to raw statistics summary
    console.warn('[AI-INSIGHTS] Gemini failed or timed out, falling back to raw stats:', error);
    const fallbackAnswer = generateFallbackAnswer(stats, question);
    return { answer: fallbackAnswer, stats, source: 'fallback' };
  }
}

/**
 * Queries Gemini with a strict timeout.
 */
async function queryGeminiWithTimeout(stats: StatsBundle, question: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.3,
    },
  });

  const systemPrompt = `You are VOUCH AI, an event analytics assistant for event organizers.
You ONLY answer questions about the event data provided below. 
If you cannot answer from the data, say "I can only answer questions about event check-in data."
Be concise, precise, and use exact numbers from the data. Never guess or hallucinate.`;

  const statsContext = `
EVENT DATA (JSON):
${JSON.stringify(stats, null, 2)}

ORGANIZER QUESTION: ${question}`;

  // Race between Gemini call and timeout
  const result = await Promise.race([
    model.generateContent([systemPrompt, statsContext]),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini API timeout (8s)')), GEMINI_TIMEOUT_MS)
    ),
  ]);

  const response = result.response;
  const text = response.text();

  if (!text || text.trim().length === 0) {
    throw new Error('Empty response from Gemini.');
  }

  return text.trim();
}

/**
 * Generates a raw statistical summary as fallback when Gemini is unavailable.
 */
function generateFallbackAnswer(stats: StatsBundle, question: string): string {
  const q = question.toLowerCase();

  if (q.includes('spot') || q.includes('remaining') || q.includes('available')) {
    return `There are ${stats.spotsRemaining} spots remaining out of ${stats.capacity} total capacity.`;
  }

  if (q.includes('checked in') || q.includes('checkin') || q.includes('check-in')) {
    return `${stats.checkedInCount} attendees have checked in out of ${stats.registeredCount} registered (${stats.registeredCount > 0 ? Math.round((stats.checkedInCount / stats.registeredCount) * 100) : 0}% check-in rate).`;
  }

  if (q.includes('no-show') || q.includes('no show') || q.includes('absent')) {
    return `${stats.noShowCount} attendees have not checked in (${stats.noShowPct}% no-show rate).`;
  }

  if (q.includes('peak') || q.includes('busiest') || q.includes('rush')) {
    return `Peak check-in activity was at ${stats.peakCheckinBucket} with ${stats.peakCheckinCount} check-ins.`;
  }

  // General summary
  return `Event "${stats.eventName}": ${stats.checkedInCount}/${stats.registeredCount} checked in, ${stats.spotsRemaining} spots remaining, ${stats.noShowPct}% no-show rate. Peak: ${stats.peakCheckinBucket} (${stats.peakCheckinCount} check-ins). [AI unavailable — showing raw statistics]`;
}
