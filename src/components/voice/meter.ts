/**
 * The microphone's loudness and how it spreads over the voice's range, read many times a second, so the sphere can move
 * to every sound (and the recording knows when the person has stopped talking). The numbers are worked out here and
 * thrown away.
 *
 * With the recording (speech heard on the server) it listens to the recording's own microphone, in every browser. With
 * the browser's speech recognition, only Chrome and Edge on computers: elsewhere the recognition needs the microphone to
 * itself (a second listener makes it go deaf), and the sphere moves to the words as they are recognized instead.
 */

export const METER_BANDS = 16;

let shared: AudioContext | null = null;
/** Called from the press that opens listening: Safari lets audio run only when it is started by a press. */
export function primeAudio() {
  try {
    shared ??= new AudioContext();
    void shared.resume();
  } catch {
    // No audio here: the sphere moves by itself, and listening still works.
  }
}

export const canMeter = () => {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return false;
  const ua = navigator.userAgent;
  // Chrome and Edge on computers, where the meter and the recognition are known to share the microphone. (Safari's
  // dictation stops when something else starts to listen. iPads call themselves Macs; a Mac has no touch points.)
  return /(Chrome|Chromium|Edg)\//.test(ua) && !/Android|iPhone|iPad|iPod/i.test(ua) && !(/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
};

export class Meter {
  /** 0…1: how loud it is right now, against the room's own hum and the loudest it has been. */
  level = 0;
  /** 0…1 each: the same, from the low end of a voice to the high. */
  readonly bands = new Float32Array(METER_BANDS);
  /** When the microphone was last read (performance.now()). */
  at = 0;
  /** Whether any sound has reached the meter yet: false while the browser keeps its audio asleep. */
  live = false;
  private ctx: AudioContext | null = null;
  /** The context is this meter's own (not the shared one), so it closes it when done. */
  private ownCtx = false;
  private source: MediaStreamAudioSourceNode | null = null;
  /** The microphone, when this meter asked for it (and so stops it). */
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private wave = new Float32Array(0);
  private spectrum = new Uint8Array(0);
  private edges: number[] = [];
  private floor = 0.004;
  private peak = 0.06;
  private bandPeak = 0.35;
  private stopped = false;

  /** Asks for the microphone (the permission the speech recognition has already been given). False: no meter. */
  async start(): Promise<boolean> {
    try {
      // The plain signal, with none of the processing a call would want: nothing else on the device changes for it.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      if (this.stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return false;
      }
      this.stream = stream;
      this.connect(stream);
      return true;
    } catch {
      this.stop();
      return false;
    }
  }

  /** Listens to a microphone someone else holds (the recording's): nothing is asked for, and it is left running. */
  attach(stream: MediaStream): boolean {
    try {
      this.connect(stream);
      return true;
    } catch {
      this.stop();
      return false;
    }
  }

  private connect(stream: MediaStream) {
    // The context opened by the press when there is one (Safari keeps any other asleep).
    const ctx = shared && shared.state !== "closed" ? shared : new AudioContext();
    this.ownCtx = ctx !== shared;
    this.ctx = ctx;
    void ctx.resume();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.5;
    analyser.minDecibels = -88;
    analyser.maxDecibels = -18;
    // Into the analyser only: nothing is played back.
    this.source = ctx.createMediaStreamSource(stream);
    this.source.connect(analyser);
    this.analyser = analyser;
    this.wave = new Float32Array(analyser.fftSize);
    this.spectrum = new Uint8Array(analyser.frequencyBinCount);
    // A voice lives between about 90 Hz and 5 kHz: sixteen bands, each a little wider than the last.
    const perBin = ctx.sampleRate / analyser.fftSize;
    this.edges = Array.from({ length: METER_BANDS + 1 }, (_, k) => Math.max(1, Math.round((90 * Math.pow(5000 / 90, k / METER_BANDS)) / perBin)));
  }

  /** Reads the microphone now: updates `level` and `bands`. False while there is nothing to read. */
  read(): boolean {
    const a = this.analyser;
    if (!a) return false;
    this.at = performance.now();
    a.getFloatTimeDomainData(this.wave);
    let sum = 0;
    for (let i = 0; i < this.wave.length; i++) sum += this.wave[i] * this.wave[i];
    const rms = Math.sqrt(sum / this.wave.length);
    if (rms > 0.0004) this.live = true;
    // The room's hum is learned (slowly when it grows, quickly when it falls) and taken away; the loudest moment so far
    // sets the top, and fades, so a quiet voice fills the range as well as a loud one.
    this.floor += (rms - this.floor) * (rms < this.floor ? 0.3 : 0.003);
    this.peak = Math.max(this.peak * 0.9993, rms, 0.03);
    const quiet = this.floor * 1.7 + 0.0015;
    const v = Math.max(0, Math.min(1, (rms - quiet) / Math.max(0.02, this.peak - quiet)));
    this.level = Math.pow(v, 0.62);

    a.getByteFrequencyData(this.spectrum);
    let top = 0;
    for (let k = 0; k < METER_BANDS; k++) {
      const from = this.edges[k];
      const to = Math.max(from + 1, this.edges[k + 1]);
      let s = 0;
      for (let i = from; i < to; i++) s += this.spectrum[i] ?? 0;
      const raw = s / (to - from) / 255;
      this.bands[k] = raw;
      if (raw > top) top = raw;
    }
    this.bandPeak = Math.max(this.bandPeak * 0.999, top, 0.2);
    // Silence is silence: the bands follow the level down, so the hiss of an open microphone moves nothing.
    const gate = Math.min(1, this.level / 0.06);
    for (let k = 0; k < METER_BANDS; k++) this.bands[k] = Math.min(1, (this.bands[k] / this.bandPeak) * gate);
    return true;
  }

  stop() {
    this.stopped = true;
    this.analyser = null;
    try {
      this.source?.disconnect();
    } catch {}
    this.source = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.ownCtx) void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.level = 0;
    this.bands.fill(0);
  }
}
