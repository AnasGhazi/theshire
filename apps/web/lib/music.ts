/**
 * The Shire theme as one shared audio element, so the loading screen can download it up front
 * (with progress) and the home page can start it instantly.
 */

export const MUSIC_URL = '/audio/shire-theme.mp3';
export const MUSIC_VOLUME = 0.35;

let audio: HTMLAudioElement | null = null;
let loading: Promise<void> | null = null;

export function music(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.loop = true;
    audio.volume = MUSIC_VOLUME;
    audio.preload = 'auto';
    audio.src = MUSIC_URL;
  }
  return audio;
}

/**
 * Downloads the whole track, reporting progress from 0 to 1, then points the audio element at the
 * in-memory copy so playback starts without buffering. Never rejects: on failure, the element
 * simply streams from the URL as usual.
 */
export function preloadMusic(onProgress: (fraction: number) => void = () => {}): Promise<void> {
  loading ??= (async () => {
    try {
      const res = await fetch(MUSIC_URL);
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const total = Number(res.headers.get('content-length')) || 0;
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total) onProgress(Math.min(1, received / total));
      }
      // Switch to the in-memory copy only if playback hasn't started (switching mid-song would
      // restart it).
      const el = music();
      if (el.paused && el.currentTime === 0) {
        el.src = URL.createObjectURL(new Blob(chunks as BlobPart[], { type: 'audio/mpeg' }));
      }
    } catch {
      // Fall back to streaming.
    }
    onProgress(1);
  })();
  return loading;
}

const MUSIC_KEY = 'theshire:music';
const listeners = new Set<() => void>();

/** The learner's music on/off choice, remembered per browser (on by default). */
export const musicSetting = {
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
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
