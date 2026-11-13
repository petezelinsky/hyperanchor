import { readSounds } from "../prefs";

/**
 * The app's one small sound, made on the spot (no audio file): soft drops whose pitch glides, when the focus timer is
 * up. Quiet, brief, and silent when Settings says so. (Speaking tasks makes no sound of its own; what the browser or
 * the device plays when the microphone opens isn't ours to change.)
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

/** The focus timer is up: three unhurried drops, each a little lower. */
export function soundTimer() {
  drop({ from: 880, to: 784, gain: 0.09, glide: 0.06, tail: 0.9 });
  drop({ from: 784, to: 659, at: 0.34, gain: 0.08, glide: 0.06, tail: 0.9 });
  drop({ from: 659, to: 523, at: 0.68, gain: 0.075, glide: 0.06, tail: 1.3 });
}
