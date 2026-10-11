'use client';

import { Music, Music2 } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { music, musicSetting, preloadMusic } from '@/lib/music';
import { soundSettings } from '@/lib/sound';

/**
 * Plays the Shire theme while the home page is open (on by default). Where the browser allows
 * autoplay it starts right away; otherwise on the first click, tap, or key press anywhere. The
 * global sound toggle silences it.
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
    let active = true;
    // Any of these count as a user gesture that unlocks audio.
    const events = ['pointerdown', 'keydown', 'touchend'] as const;
    const unlock = () => {
      events.forEach((ev) => window.removeEventListener(ev, unlock, true));
      if (active) void el.play().catch(() => {});
    };
    // Wait for the track to be fully downloaded (instant after the loading screen), then try to
    // play. If the browser blocks autoplay, start on the first interaction anywhere.
    void preloadMusic().then(() => {
      if (!active) return;
      el.play().catch(() => events.forEach((ev) => window.addEventListener(ev, unlock, true)));
    });
    return () => {
      active = false;
      events.forEach((ev) => window.removeEventListener(ev, unlock, true));
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
            : 'Music: tap anywhere'
        : 'Music off'}
    </button>
  );
}
