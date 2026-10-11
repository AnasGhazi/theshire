/**
 * Retro sound effects, synthesized with the Web Audio API (no audio files). Muting is remembered
 * per browser.
 */

const MUTE_KEY = 'theshire:muted';
const listeners = new Set<() => void>();
let ctx: AudioContext | null = null;
let muted: boolean | null = null;

function readMuted(): boolean {
  if (muted === null) {
    try {
      muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      muted = false;
    }
  }
  return muted;
}

export const soundSettings = {
  isMuted: readMuted,
  setMuted(value: boolean) {
    muted = value;
    try {
      localStorage.setItem(MUTE_KEY, value ? '1' : '0');
    } catch {
      // Storage may be unavailable; the setting then lasts for this page only.
    }
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || readMuted()) return null;
  const Ctor =
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

interface Tone {
  freq: number;
  /** Seconds after now. */
  at?: number;
  duration: number;
  type?: OscillatorType;
  volume?: number;
  /** Glide to this frequency over the tone's duration. */
  slideTo?: number;
}

function play(tones: Tone[]) {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  for (const { freq, at = 0, duration, type = 'square', volume = 0.05, slideTo } of tones) {
    const start = now + at;
    const end = start + duration;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, end);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

export const sfx = {
  /** A short blip for any pixel button. */
  click: () => play([{ freq: 520, slideTo: 780, duration: 0.05, volume: 0.035 }]),
  /** A program finished cleanly. */
  runDone: () =>
    play([
      { freq: 880, duration: 0.06, type: 'triangle', volume: 0.06 },
      { freq: 1318.5, at: 0.06, duration: 0.09, type: 'triangle', volume: 0.06 },
    ]),
  /** A program crashed, timed out, or a submission failed. */
  error: () =>
    play([
      { freq: 220, duration: 0.12, volume: 0.045 },
      { freq: 155.6, at: 0.12, duration: 0.22, slideTo: 110, volume: 0.045 },
    ]),
  /** Every test passed. */
  success: () =>
    play([
      { freq: C5, duration: 0.09 },
      { freq: E5, at: 0.09, duration: 0.09 },
      { freq: G5, at: 0.18, duration: 0.09 },
      { freq: C6, at: 0.27, duration: 0.32, volume: 0.06 },
      { freq: G5, at: 0.27, duration: 0.32, type: 'triangle', volume: 0.04 },
    ]),
  /** The lesson is now complete: a longer fanfare. */
  lessonComplete: () =>
    play([
      { freq: G5 / 2, duration: 0.08 },
      { freq: C5, at: 0.08, duration: 0.08 },
      { freq: E5, at: 0.16, duration: 0.08 },
      { freq: G5, at: 0.24, duration: 0.08 },
      { freq: E5, at: 0.32, duration: 0.08 },
      { freq: G5, at: 0.4, duration: 0.08 },
      { freq: C6, at: 0.48, duration: 0.45, volume: 0.06 },
      { freq: E5, at: 0.48, duration: 0.45, type: 'triangle', volume: 0.04 },
    ]),
  /** Bilbo: a cheerful chirp. */
  bilbo: () =>
    play([
      { freq: 988, duration: 0.05, volume: 0.04 },
      { freq: 1319, at: 0.06, duration: 0.07, volume: 0.04 },
    ]),
  /** Gandalf: a low hum that rises into a sparkle. */
  gandalf: () =>
    play([
      { freq: 147, slideTo: 294, duration: 0.25, type: 'triangle', volume: 0.08 },
      { freq: 1568, at: 0.2, duration: 0.05, type: 'triangle', volume: 0.03 },
      { freq: 2093, at: 0.26, duration: 0.08, type: 'triangle', volume: 0.03 },
    ]),
};
