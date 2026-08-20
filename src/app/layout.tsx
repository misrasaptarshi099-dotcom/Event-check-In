import type { Metadata } from 'next';
import { Geist_Mono } from 'next/font/google';
import './globals.css';

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'VOUCH — Real-Time Event Check-In',
  description:
    'VOUCH: Concurrency-safe event check-in system with TOTP dynamic rotating QR codes, offline scanning, and AI-powered insights.',
  keywords: ['vouch', 'event', 'check-in', 'qr code', 'totp', 'real-time', 'dashboard'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={geistMono.variable}>
      <head>
        {/* PP Editorial New – editorial serif */}
        <link
          rel="preconnect"
          href="https://db.onlinewebfonts.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen bg-surface text-primary font-mono antialiased">
        {children}
      </body>
    </html>
  );
}
