'use client';

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { Button } from '../ui/Button';
import { StatusChip } from '../ui/StatusChip';
import type { AiInsightResponse } from '@/lib/services/ai-insights.service';

export interface AiInsightsTerminalProps {
  eventId: string;
  className?: string;
}

const PRESET_PROMPTS = [
  'What is our total gross revenue and ticket count?',
  'What was our peak check-in rush hour?',
  'How many attendees are no-shows and what is the no-show rate?',
  'How many remaining spots do we have left?',
  'Give me a complete operational & financial executive summary.',
];

export function AiInsightsTerminal({ eventId, className }: AiInsightsTerminalProps) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<
    { question: string; answer: string; source: 'ai' | 'fallback'; timestamp: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  const handleAsk = async (queryToAsk?: string) => {
    const q = (queryToAsk || question).trim();
    if (!q || loading) return;

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('vouch_auth_token') || 'mock-organizer-token';
      const res = await fetch(`/api/events/${eventId}/ai-insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: q }),
      });

      const data = (await res.json()) as AiInsightResponse & { error?: string };

      if (!res.ok) {
        if (res.status === 429) {
          setError('Rate limit reached (max 5 AI requests/min). Please wait a moment.');
        } else {
          setError(data.error || 'Failed to query AI insights.');
        }
        return;
      }

      setHistory((prev) => [
        {
          question: q,
          answer: data.answer,
          source: data.source,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        },
        ...prev,
      ]);

      setQuestion('');
    } catch (err: any) {
      setError(err.message || 'Network error querying AI.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={clsx('border border-border-rigid bg-surface font-mono p-6 space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-rigid pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-serif italic text-primary font-medium tracking-tight">
              Gemini Operations & Financial Intelligence
            </h4>
            <StatusChip status="GEMINI 3.5 FLASH LITE" variant="neutral" />
          </div>
          <p className="text-[10px] text-muted-text uppercase tracking-widest mt-0.5">
            Zero-hallucination natural language queries over live event ledger data
          </p>
        </div>
        <div className="text-[10px] text-muted-text">
          Max 5 req/min · 500 token budget
        </div>
      </div>

      {/* Preset Prompt Chips */}
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-widest text-muted-text">
          Suggested Queries:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={loading}
              onClick={() => {
                setQuestion(prompt);
                handleAsk(prompt);
              }}
              className="text-[11px] px-2.5 py-1 border border-border-rigid bg-surface-high text-primary hover:bg-primary hover:text-surface transition-colors rounded-none text-left disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Query Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk();
        }}
        className="flex flex-col sm:flex-row gap-2"
      >
        <input
          type="text"
          placeholder="Ask anything about event attendance, peak rush hours, or ticket revenue..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={loading}
          className="flex-1 h-12 bg-surface-low border border-border-rigid px-4 text-xs font-mono text-primary placeholder:text-muted-text focus:outline-none focus:border-b-2 focus:border-primary rounded-none disabled:opacity-50"
        />
        <Button
          type="submit"
          variant="accent"
          size="md"
          loading={loading}
          disabled={loading || !question.trim()}
          className="min-w-[120px]"
        >
          Query AI
        </Button>
      </form>

      {error && (
        <div className="border border-accent bg-accent/10 p-3 text-xs text-accent">
          [!] {error}
        </div>
      )}

      {/* Response History */}
      <div className="space-y-4">
        {history.length === 0 ? (
          <div className="border border-dashed border-border-rigid p-8 text-center text-muted-text font-serif italic text-sm">
            Ask a question above or click a suggested query to inspect event intelligence in real time.
          </div>
        ) : (
          history.map((item, idx) => (
            <div
              key={idx}
              className="border border-border-rigid p-4 bg-surface-low space-y-2 animate-in fade-in"
            >
              <div className="flex items-center justify-between border-b border-border-rigid/40 pb-2">
                <span className="text-xs font-semibold text-primary">Q: {item.question}</span>
                <div className="flex items-center gap-2">
                  <StatusChip
                    status={item.source === 'ai' ? 'GEMINI' : 'RAW STATS'}
                    variant={item.source === 'ai' ? 'success' : 'neutral'}
                  />
                  <span className="text-[10px] text-muted-text">{item.timestamp}</span>
                </div>
              </div>
              <p className="text-sm font-serif italic text-primary leading-relaxed">
                {item.answer}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
