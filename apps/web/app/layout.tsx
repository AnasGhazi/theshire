import type { Metadata } from 'next';
import { JetBrains_Mono, Nunito, Pixelify_Sans } from 'next/font/google';
import { AuthProvider } from '@/components/AuthProvider';
import { LoadingScreen } from '@/components/LoadingScreen';
import { ProgressProvider } from '@/components/ProgressProvider';
import { ButtonClickSounds } from '@/components/SoundEffects';
import { WhirlTransition } from '@/components/WhirlTransition';
import './globals.css';

const pixelify = Pixelify_Sans({ subsets: ['latin'], variable: '--font-pixelify' });
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });

export const metadata: Metadata = {
  title: { default: 'The Shire: learn to code', template: '%s · The Shire' },
  description: 'Bite-sized Python and JavaScript lessons you can run right in your browser.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${pixelify.variable} ${nunito.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        <ProgressProvider>
          <AuthProvider>{children}</AuthProvider>
        </ProgressProvider>
        <ButtonClickSounds />
        <WhirlTransition />
        <LoadingScreen />
      </body>
    </html>
  );
}
