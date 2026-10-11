'use client';

import { Music, Music2 } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { music, musicSetting } from '@/lib/music';
import { soundSettings } from '@/lib/sound';

/**
 * Plays the Shire theme while the home page is open. The loading screen's "Enter" press gives the
 * browser the user gesture it needs; if the page was reached another way and autoplay is still
 * blocked, playback starts on the first click or key press. The global sound toggle silences it.
 */
export function HomeMusic() {
  const enabled = useSyncExternalStore(musicSetting.subscribe, musicSetting.get, () => true);
  const muted = useSyncExternalStore(soundSettings.subscribe, soundSettings.isMuted, () => false);
  const [playing, setPlaying] = useState(false);
  const shouldPlay = enabled && !muted;

  useEffect(() => {
    const el = music();
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
    };
  }, []);

  useEffect(() => {
    const el = music();
    if (!shouldPlay) {
      el.pause();
      return;
    }
    const start = () => void el.play().catch(() => {});
    const events = ['pointerdown', 'keydown'] as const;
    el.play().catch(() => {
      events.forEach((ev) => window.addEventListener(ev, start, { once: true }));
    });
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, start));
      el.pause(); // leaving the home page; the track resumes from here next time
    };
  }, [shouldPlay]);

  const Icon = playing ? Music2 : Music;
  return (
    <button
      type="button"
      onClick={() => musicSetting.set(!enabled)}
      aria-pressed={enabled}
      className="btn btn-ghost btn-sm"
      title={muted ? 'Sound is off in the top bar' : undefined}
    >
      <Icon className={`size-4 ${playing ? 'animate-pulse text-lime' : ''}`} aria-hidden />
      {enabled
        ? playing
          ? 'Music on'
          : muted
            ? 'Music (sound off)'
            : 'Music: click anywhere'
        : 'Music off'}
    </button>
  );
}
