'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';
import { sfx, soundSettings } from '@/lib/sound';

/** Plays a blip whenever any pixel button (`.btn`) is pressed, by mouse, touch, or keyboard. */
export function ButtonClickSounds() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const button = (e.target as Element | null)?.closest('.btn');
      if (button && !(button as HTMLButtonElement).disabled) sfx.click();
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);
  return null;
}

export function SoundToggle() {
  const muted = useSyncExternalStore(soundSettings.subscribe, soundSettings.isMuted, () => false);
  const Icon = muted ? VolumeX : Volume2;
  return (
    <button
      type="button"
      onClick={() => {
        soundSettings.setMuted(!muted);
        if (muted) sfx.click(); // a confirming blip when sound comes back on
      }}
      aria-pressed={!muted}
      aria-label={muted ? 'Turn sound effects on' : 'Turn sound effects off'}
      title={muted ? 'Sound off' : 'Sound on'}
      className="rounded-md p-1.5 text-muted transition-colors hover:bg-band hover:text-ink"
    >
      <Icon className="size-6" />
    </button>
  );
}
