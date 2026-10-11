import Link from 'next/link';
import { DoorIcon } from '@/components/PixelArt';
import { TopBar } from '@/components/TopBar';

export default function NotFound() {
  return (
    <>
      <TopBar />
      <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
        <DoorIcon className="h-24 w-28 opacity-60" />
        <h1 className="mt-8 font-pixel text-3xl">404: Not in the Shire</h1>
        <p className="mt-4 text-lg text-muted">
          This path doesn’t lead anywhere. Let’s get you back on the road.
        </p>
        <Link href="/" className="btn btn-yellow mt-8">
          Back to courses
        </Link>
      </main>
    </>
  );
}
