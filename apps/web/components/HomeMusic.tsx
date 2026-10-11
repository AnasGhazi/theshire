'use client';

import { Music, Music2 } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { soundSettings } from '@/lib/sound';

const MUSIC_KEY = 'theshire:music';
const VOLUME = 0.35;
/** Where the track was when the learner left the home page, so it resumes rather than restarts. */
let resumeAt = 0;

const musicListeners = new Set<() => void>();

/** The learner's music on/off choice, remembered per browser (on by default). */
const musicSetting = {
  get(): boolean {
    try {
      return localStorage.getItem(MUSIC_KEY) !== 'off';
    } catch {
      return true;
    }
  },
  set(on: boolean) {
    try {
      localStorage.setItem(MUSIC_KEY, on ? 'on' : 'off');
    } catch {
      // Not persisted; fine.
    }
    musicListeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    musicListeners.add(listener);
    return () => musicListeners.delete(listener);
  },
};

/**
 * Loops the Shire theme on the home page. Browsers block audio until the visitor interacts with
 * the page, so if autoplay is refused, playback starts on the first click or key press. The
 * global sound toggle silences it too.
 */
export function HomeMusic() {
  const audio = useRef<HTMLAudioElement>(null);
  const enabled = useSyncExternalStore(musicSetting.subscribe, musicSetting.get, () => true);
  const [playing, setPlaying] = useState(false);
  const muted = useSyncExternalStore(soundSettings.subscribe, soundSettings.isMuted, () => false);
  const shouldPlay = enabled && !muted;

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    el.volume = VOLUME;
    if (!shouldPlay) {
      el.pause();
      return;
    }
    if (resumeAt > 0 && el.currentTime === 0) el.currentTime = resumeAt;

    const start = () => void el.play().catch(() => {});
    const events = ['pointerdown', 'keydown'] as const;
    el.play().catch(() => {
      // Autoplay was blocked: wait for the first interaction anywhere on the page.
      events.forEach((ev) => window.addEventListener(ev, start, { once: true }));
    });
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, start));
      resumeAt = el.currentTime;
      el.pause();
    };
  }, [shouldPlay]);

  const toggle = () => musicSetting.set(!enabled);

  const Icon = playing ? Music2 : Music;
  return (
    <>
      <audio
        ref={audio}
        src="/audio/shire-theme.mp3"
        loop
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <button
        type="button"
        onClick={toggle}
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
    </>
  );
}
