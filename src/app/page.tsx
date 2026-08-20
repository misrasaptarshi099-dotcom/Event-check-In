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
