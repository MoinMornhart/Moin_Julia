import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Manrope } from 'next/font/google';
import { VersionFooter } from '@/components/VersionFooter';
import { appCommit, appVersion, isDemoMode } from '@/lib/env';
import './globals.css';

const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', display: 'swap' });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Moin_Julia', template: '%s · Moin_Julia' },
  description: 'Dashboard für den Moin_Julia Discord-Bot',
};

export const viewport: Viewport = {
  themeColor: '#080c1a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${bricolage.variable} ${manrope.variable}`}>
      <body className="min-h-dvh">
        <div className="aurora" aria-hidden />
        {isDemoMode() && (
          <div className="bg-sun-400 px-4 py-1.5 text-center text-xs font-bold text-ink-950">
            DEMO-MODUS – Login ohne Discord, nur für Tests und Screenshots
          </div>
        )}
        {children}
        <VersionFooter version={appVersion()} commit={appCommit()} />
      </body>
    </html>
  );
}
