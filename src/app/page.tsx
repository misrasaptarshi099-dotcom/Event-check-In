import { Button, StatusChip } from '@/components/ui';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top rigid border */}
      <div className="border-b border-border-rigid" />

      {/* Header */}
      <header className="border-b border-border-rigid px-6 md:px-12 flex items-center justify-between h-16">
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono font-bold tracking-[0.25em] text-primary">
            VOUCH
          </span>
          <span className="text-[10px] font-mono text-muted-text">/</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-text">
            Event Check-In OS
          </span>
        </div>
        <div className="flex items-center gap-4">
          <StatusChip status="SYSTEM ONLINE" variant="success" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 md:px-12 py-20">
        <div className="max-w-2xl w-full space-y-12 text-center">
          {/* Hero Title */}
          <div className="space-y-4">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-text">
              Real-Time Check-In Infrastructure
            </p>
            <h1 className="text-5xl md:text-7xl font-serif italic leading-[1.05] tracking-tight">
              Every Scan,<br />
              <span className="text-accent">Exactly Once.</span>
            </h1>
            <p className="text-sm font-mono text-muted-text leading-relaxed max-w-lg mx-auto mt-6">
              Concurrency-safe event check-ins with rotating TOTP QR codes,
              offline-first scanning, and AI-powered insights.
            </p>
          </div>

          {/* CTA Row */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button variant="accent" size="lg" className="w-full sm:w-auto min-w-[200px]">
              Organizer Login
            </Button>
            <Button variant="primary" size="lg" className="w-full sm:w-auto min-w-[200px]">
              Register for Event
            </Button>
          </div>

          {/* Feature Grid */}
          <div className="border border-border-rigid divide-y divide-border-rigid text-left">
            {[
              { label: 'HR-1', title: 'Atomic Check-In', desc: 'Database-level uniqueness. Zero duplicates under any concurrency.' },
              { label: 'HR-2', title: 'Dynamic QR Codes', desc: 'RFC 6238 TOTP rotation every 30s. Screenshots expire instantly.' },
              { label: 'HR-3', title: 'Offline Scanner', desc: 'Full check-in capability without network. Auto-sync on reconnect.' },
              { label: 'HR-4', title: 'AI Event Insights', desc: 'Natural language queries over live stats. Gemini-powered, never hallucinates.' },
            ].map((feature) => (
              <div key={feature.label} className="grid-ledger-row flex items-center gap-6 px-6 py-5 cursor-default">
                <StatusChip status={feature.label} variant="neutral" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-medium tracking-wide">{feature.title}</p>
                  <p className="text-xs font-mono text-muted-text mt-0.5 muted-label">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border-rigid px-6 md:px-12 py-4 flex items-center justify-between">
        <span className="text-[10px] font-mono text-muted-text uppercase tracking-wider">
          VOUCH Infrastructure · v1.0
        </span>
        <span className="text-[10px] font-mono text-muted-text">
          {new Date().getFullYear()}
        </span>
      </footer>
    </div>
  );
}
