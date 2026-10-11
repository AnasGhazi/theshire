import type { Metadata } from 'next';
import { Nunito, Silkscreen } from 'next/font/google';
import './globals.css';

const silkscreen = Silkscreen({ subsets: ['latin'], weight: '400', variable: '--font-silkscreen' });
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito' });

export const metadata: Metadata = {
  title: 'The Shire',
  description: 'Learn to code with runnable lessons.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${silkscreen.variable} ${nunito.variable}`}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
