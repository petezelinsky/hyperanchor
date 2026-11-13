import { Meter } from "./meter";

/**
 * Listening, with the hearing done on the server: the microphone is recorded here, and once the person is done the
 * recording goes to /api/voice/transcribe, where a speech model writes it down — far better than a browser's own
 * recognition, in any language, mixed ones too. The same microphone moves the sphere (the meter) and tells when the
 * person has stopped talking, so listening ends by itself after a pause, as it did before.
 */

export const canRecord = () =>
  typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

/** The longest one recording runs (the server takes five minutes at a time). */
const RECORD_MAX_MS = 4.5 * 60_000;
/** A pause this long after something was said ends the listening by itself. */
const SILENCE_AFTER_WORDS = 5000;
/** Nothing said at all for this long: there's no point in listening on. */
const SILENCE_AT_START = 12_000;
/** The meter's level (0…1) that counts as a voice, and the lower one it has to fall under to count as a pause. */
const VOICE_ON = 0.16;
const VOICE_OFF = 0.08;
const SPEAKING_HOLD = 600;

/** What browsers record, best first: Opus in WebM (Chrome, Firefox, Edge), AAC in MP4 (Safari). */
const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

/** Why listening ended: the person stopped it, a long pause, the time ran out, or something in the way. */
export type RecordStop = "stopped" | "silence" | "limit" | "denied" | "no-microphone" | "error";
/** A finished recording: the audio and how long it is. */
export type Recorded = { blob: Blob; seconds: number };

type Handlers = {
  /** A voice is heard (true) or there's a pause (false): what the sphere moves to. */
  onSpeaking: (speaking: boolean) => void;
  /** Listening is over: the recording, or null when there's nothing worth sending (no microphone, nothing said). */
  onStop: (reason: RecordStop, audio: Recorded | null) => void;
};

export class Recorder {
  readonly meter = new Meter();
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private started = 0;
  private voiceAt = 0;
  private spoke = false;
  private speaking = false;
  private watching: ReturnType<typeof setInterval> | undefined;
  private reason: RecordStop | null = null;
  private over = false;

  constructor(private readonly on: Handlers) {}

  async start() {
    let stream: MediaStream;
    try {
      // The voice cleaned up the way a call would want it: steadier for the speech model, too.
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      return this.end(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "OverconstrainedError" ? "no-microphone" : "error", null);
    }
    if (this.over) return stream.getTracks().forEach((t) => t.stop());
    this.stream = stream;
    let rec: MediaRecorder;
    try {
      const type = TYPES.find((t) => MediaRecorder.isTypeSupported?.(t));
      rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 48_000 });
    } catch {
      return this.end("error", null);
    }
    this.recorder = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data);
    };
    rec.onstop = () => this.finish();
    rec.onerror = () => {
      this.reason ??= "error";
      this.finish();
    };
    this.meter.attach(stream);
    rec.start(1000);
    this.started = this.voiceAt = performance.now();
    this.watching = setInterval(() => this.watch(), 100);
  }

  /** The person is done: what was recorded goes to `onStop`. */
  stop(reason: RecordStop = "stopped") {
    if (this.over || this.reason) return;
    this.reason = reason;
    clearInterval(this.watching);
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    else this.finish();
  }

  /** Stops at once and reports nothing (the screen is closing, or listening starts over). */
  cancel() {
    this.over = true;
    clearInterval(this.watching);
    const rec = this.recorder;
    this.recorder = null;
    if (rec) {
      rec.ondataavailable = rec.onstop = rec.onerror = null;
      if (rec.state !== "inactive")
        try {
          rec.stop();
        } catch {}
    }
    this.release();
  }

  /** Seconds since listening started. */
  get elapsed() {
    return this.started ? (performance.now() - this.started) / 1000 : 0;
  }

  /** The voice and the pauses, from the meter: a pause after words, or no words at all, ends the listening. */
  private watch() {
    const now = performance.now();
    if (now - this.started > RECORD_MAX_MS) return this.stop("limit");
    const m = this.meter;
    // The sphere reads the meter every frame; when it doesn't (a hidden tab), this does.
    if (now - m.at > 90) m.read();
    // While the browser keeps its audio asleep there's no telling a pause from a voice: listening waits for Done.
    if (!m.live) return;
    const voice = m.level > (this.speaking ? VOICE_OFF : VOICE_ON);
    if (voice) {
      this.voiceAt = now;
      this.spoke = true;
    }
    const speaking = voice || now - this.voiceAt < SPEAKING_HOLD;
    if (speaking !== this.speaking) {
      this.speaking = speaking;
      this.on.onSpeaking(speaking);
    }
    if (this.spoke ? now - this.voiceAt > SILENCE_AFTER_WORDS : now - this.started > SILENCE_AT_START) this.stop("silence");
  }

  private finish() {
    if (this.over) return;
    const reason = this.reason ?? "stopped";
    const type = this.recorder?.mimeType || this.chunks[0]?.type || "audio/webm";
    const seconds = this.elapsed;
    const heardNothing = this.meter.live && !this.spoke;
    const blob = new Blob(this.chunks, { type });
    // Only silence, by the meter's account, when listening ended by itself: nothing worth sending.
    const audio = blob.size && seconds >= 0.6 && !(heardNothing && reason !== "stopped") ? { blob, seconds } : null;
    this.end(reason, audio);
  }

  private end(reason: RecordStop, audio: Recorded | null) {
    if (this.over) return;
    this.over = true;
    clearInterval(this.watching);
    this.release();
    if (this.speaking) this.on.onSpeaking(false);
    this.on.onStop(reason, audio);
  }

  private release() {
    this.meter.stop();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
