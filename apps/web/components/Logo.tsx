import Link from 'next/link';
import { DoorIcon } from './PixelArt';

export function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="The Shire home">
      <DoorIcon className="h-8 w-10" />
      <span className="font-pixel text-2xl leading-none tracking-tight text-white max-sm:hidden">
        The Shire
      </span>
    </Link>
  );
}
