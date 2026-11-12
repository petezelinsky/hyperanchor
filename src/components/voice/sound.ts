import { readSounds } from "../prefs";

/**
 * The app's own small sounds, made on the spot (no audio files): single soft drops whose pitch glides, rather than a
 * two-note chime. One that rises when listening starts, one that falls and settles when what was said has come back as
 * tasks, a short one when they are added. Quiet, brief, and silent when Settings says so.
 *
 * (What the browser or the device plays by itself when the microphone opens — a dictation tone, a headset switching to
 * its call mode — isn't ours to change.)
 */

let ctx: AudioContext | null = null;

/** Called from a click or a key press, so the browser lets the sounds that follow play. */
export function primeSound() {
  if (!readSounds()) return;
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
  } catch {
    // No sound on this device: everything still works.
  }
}

type Drop = { from: number; to: number; at?: number; gain?: number; glide?: number; tail?: number };

/** One drop: a sine whose pitch glides from `from` to `to`, with a quick rise and a soft tail. */
function drop({ from, to, at = 0, gain = 0.08, glide = 0.09, tail = 0.34 }: Drop) {
  const audio = ctx;
  if (!audio || audio.state === "closed" || !readSounds()) return;
  const play = () => {
    try {
      const t = audio.currentTime + 0.02 + at;
      const osc = audio.createOscillator();
      const amp = audio.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(from, t);
      osc.frequency.exponentialRampToValueAtTime(to, t + glide);
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.exponentialRampToValueAtTime(gain, t + 0.014);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + tail);
      osc.connect(amp).connect(audio.destination);
      osc.start(t);
      osc.stop(t + tail + 0.05);
    } catch {
      // As above.
    }
  };
  // Right after it's asked for, the sound may still be waking up: the drop plays as soon as it has.
  if (audio.state === "running") play();
  else void audio.resume().then(play, () => {});
}

/** Listening starts: a drop that rises, with a breath of air an octave above it. */
export function soundListening() {
  drop({ from: 392, to: 784, gain: 0.075, glide: 0.11, tail: 0.38 });
  drop({ from: 784, to: 1568, gain: 0.014, glide: 0.11, tail: 0.24 });
}

/** What was said has come back as tasks: a drop that falls and settles. */
export function soundReady() {
  drop({ from: 988, to: 659, gain: 0.065, glide: 0.08, tail: 0.42 });
  drop({ from: 1976, to: 1318, gain: 0.012, glide: 0.08, tail: 0.26 });
}

/** The tasks are in the list: one short, low drop. */
export function soundAdded() {
  drop({ from: 523, to: 440, gain: 0.06, glide: 0.05, tail: 0.22 });
}

/** The focus timer is up: three unhurried drops, each a little lower. */
export function soundTimer() {
  drop({ from: 880, to: 784, gain: 0.09, glide: 0.06, tail: 0.9 });
  drop({ from: 784, to: 659, at: 0.34, gain: 0.08, glide: 0.06, tail: 0.9 });
  drop({ from: 659, to: 523, at: 0.68, gain: 0.075, glide: 0.06, tail: 1.3 });
}
