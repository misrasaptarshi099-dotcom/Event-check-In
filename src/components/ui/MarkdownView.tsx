'use client';

import React from 'react';
import { clsx } from 'clsx';

interface MarkdownViewProps {
  content: string;
  className?: string;
}

/**
 * Parses inline formatting: **bold**, *italic*, and `code`
 */
function parseInline(text: string): React.ReactNode[] {
  // Regex splitting by bold (**...**), code (`...`), or italic (*...*)
  const tokens = text.split(/(\*\*[^*]+?\*\*|`[^`]+?`|\*[^*]+?\*)/g);

  return tokens.map((token, idx) => {
    if (!token) return null;

    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      return (
        <strong key={idx} className="font-bold text-primary">
          {token.slice(2, -2)}
        </strong>
      );
    }

    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 bg-surface-high border border-border-rigid text-[11px] font-mono text-accent font-semibold"
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
      return (
        <em key={idx} className="font-serif italic text-primary">
          {token.slice(1, -1)}
        </em>
      );
    }

    return <React.Fragment key={idx}>{token}</React.Fragment>;
  });
}

/**
 * Safe, zero-dependency Markdown renderer for AI insights and reports.
 * Formats headers, bullet lists, ordered lists, callout quotes, bold, and code.
 */
export function MarkdownView({ content, className }: MarkdownViewProps) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let currentList: { type: 'ul' | 'ol'; items: React.ReactNode[] } | null = null;

  const flushList = () => {
    if (!currentList) return;
    const key = `list-${elements.length}`;
    if (currentList.type === 'ul') {
      elements.push(
        <ul key={key} className="space-y-1.5 my-2.5 pl-1">
          {currentList.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-primary leading-relaxed">
              <span className="text-primary font-bold select-none text-[13px] leading-tight">•</span>
              <span className="flex-1">{item}</span>
            </li>
          ))}
        </ul>
      );
    } else {
      elements.push(
        <ol key={key} className="space-y-2 my-2.5 pl-1">
          {currentList.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-primary leading-relaxed">
              <span className="font-mono text-[10px] font-bold border border-border-rigid bg-surface-high px-1.5 py-0.5 mt-0.5 select-none text-primary">
                {i + 1}
              </span>
              <span className="flex-1">{item}</span>
            </li>
          ))}
        </ol>
      );
    }
    currentList = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    // 1. Headings (###, ##, #)
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h4
          key={`h3-${i}`}
          className="text-xs sm:text-sm font-serif italic font-bold text-primary mt-4 mb-2 flex items-center gap-1.5 border-b border-border-rigid/40 pb-1 uppercase tracking-wider"
        >
          <span className="text-accent text-xs">◆</span>
          {parseInline(trimmed.replace(/^###\s+/, ''))}
        </h4>
      );
      continue;
    }

    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h3
          key={`h2-${i}`}
          className="text-sm sm:text-base font-serif italic font-bold text-primary mt-5 mb-2.5 border-b border-border-rigid pb-1 tracking-tight"
        >
          {parseInline(trimmed.replace(/^##\s+/, ''))}
        </h3>
      );
      continue;
    }

    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h2
          key={`h1-${i}`}
          className="text-base sm:text-lg font-serif italic font-bold text-primary mt-5 mb-3 border-b-2 border-border-rigid pb-1"
        >
          {parseInline(trimmed.replace(/^#\s+/, ''))}
        </h2>
      );
      continue;
    }

    // 2. Blockquotes / Callout Rationale (> ...)
    if (trimmed.startsWith('> ') || trimmed === '>') {
      flushList();
      const quoteText = trimmed.replace(/^>\s*/, '');
      elements.push(
        <div
          key={`quote-${i}`}
          className="my-3 border-l-2 border-accent bg-surface-high p-3 text-xs text-primary leading-relaxed font-mono"
        >
          {parseInline(quoteText)}
        </div>
      );
      continue;
    }

    // 3. Unordered Lists (* item, - item)
    const ulMatch = trimmed.match(/^[\*\-]\s+(.+)$/);
    if (ulMatch) {
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(parseInline(ulMatch[1]));
      continue;
    }

    // 4. Ordered Lists (1. item, 2. item)
    const olMatch = trimmed.match(/^\d+[\.\)]\s+(.+)$/);
    if (olMatch) {
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(parseInline(olMatch[1]));
      continue;
    }

    // 5. Standard Paragraph
    flushList();
    elements.push(
      <p key={`p-${i}`} className="text-xs sm:text-sm text-primary leading-relaxed my-1.5">
        {parseInline(trimmed)}
      </p>
    );
  }

  flushList();

  return <div className={clsx('space-y-1 font-sans text-primary', className)}>{elements}</div>;
}
