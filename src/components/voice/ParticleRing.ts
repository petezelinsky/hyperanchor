/**
 * The voice's sphere: a thick, full ring of dots on a canvas. It moves to sound. Given the microphone's readings
 * (`listen`), every sound shows: the ring swells with the loudness, and each part of it leans out with its own slice
 * of the voice's range, so speech runs round it as waves. No two dots do the same thing: each has its own direction
 * (out, in, along the ring, or a long flight), its own pace of waking up and settling, and its own small orbit. Without
 * a microphone to read (phones), it acts out syllables while words are being recognized. Nothing is drawn inside it.
 *
 * Drawn in an 800 × 800 space scaled to the canvas, in the canvas's own CSS `color` (black on light, white on dark).
 */

const TAU = Math.PI * 2;
const BINS = 360;
const BANDS = 16;

export type RingMode = "speech" | "steady" | "silent";

type Options = {
  count: number;
  radius: number;
  spread: number;
  dotSize: number;
  seed: number;
  color: string;
  mode: RingMode;
  intensity: number;
  speed: number;
  /** Reduced motion: the ring keeps breathing, the dots stay close. */
  reduced: boolean;
  /** Grows in over the first moments. */
  intro: boolean;
};

type Dot = {
  ang: number;
  off: number;
  size: number;
  op: number;
  dx: number;
  dy: number;
  reach: number;
  react: number;
  att: number;
  dec: number;
  orb: number;
  os: number;
  flow: number;
  pa: number;
  pb: number;
  pc: number;
  sb: number;
  sc: number;
  e: number;
  /** How loud this dot's part of the ring is right now. */
  a: number;
};

/** What the microphone hears at this moment: how loud (0…1), and the same over 16 bands from low to high. */
export type Heard = { level: number; bands: ArrayLike<number> };

type Band = { k: number; center: number; rate: number; gain: number; seed: number; level: number };

export class ParticleRing {
  readonly o: Options;
  /** In "speech" mode: 1 while words are coming, 0 in a pause. null lets the ring act out phrases by itself. */
  gate: 0 | 1 | null = null;
  /** In "speech" mode: asked every frame for what the microphone hears. While it answers, the ring moves to that. */
  listen: (() => Heard | null) | null = null;
  private t = 0;
  private G = 0;
  private E = 0;
  private gateNow = 0;
  private level: number;
  private shown: number;
  private readonly act = new Float32Array(BINS);
  private dots: Dot[] = [];
  private bands: Band[] = [];
  private scale = 1;
  private running = false;
  private raf = 0;
  private last = 0;

  constructor(
    readonly canvas: HTMLCanvasElement,
    options: Partial<Options> = {},
  ) {
    this.o = { count: 5200, radius: 226, spread: 44, dotSize: 2.5, seed: 7, color: "#000000", mode: "silent", intensity: 1, speed: 1, reduced: false, intro: true, ...options };
    this.level = this.o.intensity;
    this.shown = this.o.intro ? 0 : 1;
    this.build();
    this.resize();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = () => {
      if (!this.running) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.advance(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** One still frame, `t` seconds into its life: the sphere drawn small, as an icon (see Orb). */
  still(t = 0) {
    if (t > 0) this.advance(t);
    this.draw();
  }

  /** The canvas changed size on screen (or the screen's density changed). */
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const css = this.canvas.clientWidth || 280;
    const px = Math.round(css * dpr);
    if (this.canvas.width !== px) this.canvas.width = px;
    if (this.canvas.height !== px) this.canvas.height = px;
    this.scale = (css / 800) * dpr;
    if (!this.running) this.draw();
  }

  private build() {
    const { count, spread, seed, radius } = this.o;
    let s = seed * 9973 + 1;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    const gauss = () => {
      let u = 0;
      let v = 0;
      while (!u) u = rnd();
      while (!v) v = rnd();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
    };
    this.dots = [];
    for (let i = 0; i < count; i++) {
      // A dense heart, a soft body around it and a wide haze: the band reads thick and full.
      const layer = rnd();
      const sigma = layer < 0.4 ? spread * 0.36 : layer < 0.78 ? spread * 0.8 : spread * 1.5;
      let off = Math.max(-2.3, Math.min(2.3, gauss())) * sigma;
      if (off < -radius * 0.46) off = -radius * 0.46 * rnd(); // nothing wanders into the middle
      const near = Math.max(0, 1 - Math.abs(off) / (spread * 2.4));
      const big = rnd() < 0.13;
      // What kind of dot it is when the voice comes: 0 breathes out or in, 1 slides along the ring, 2 flies far.
      const k = rnd();
      const kind = k < 0.5 ? 0 : k < 0.82 ? 1 : 2;
      const dir = kind === 0 ? (rnd() < 0.6 ? 0 : Math.PI) + gauss() * 0.45 : kind === 1 ? (rnd() < 0.5 ? 1 : -1) * Math.PI * 0.5 + gauss() * 0.5 : gauss() * 0.8;
      const q = rnd();
      this.dots.push({
        ang: ((i + rnd()) / count) * TAU,
        off,
        size: big ? 1.9 + rnd() * 0.9 : 0.85 + rnd() * 0.95,
        op: Math.min(1, (big ? 0.62 : 0.36) + near * 0.42 + rnd() * 0.14),
        dx: Math.cos(dir),
        dy: Math.sin(dir),
        reach: kind === 0 ? 12 + rnd() * 24 : kind === 1 ? 10 + rnd() * 20 : 42 + rnd() * 46,
        react: q < 0.1 ? 0.12 : 0.4 + rnd() * 0.85,
        att: 2.6 + rnd() * rnd() * 14, // some wake at once, some take their time
        dec: 1.1 + rnd() * 5.2, // some settle fast, some linger
        orb: 1.5 + rnd() * 7.5,
        os: (0.8 + rnd() * 2.2) * (rnd() < 0.5 ? -1 : 1),
        flow: (0.4 + rnd() * 0.6) * (rnd() < 0.24 ? -1 : 1),
        pa: rnd() * TAU,
        pb: rnd() * TAU,
        pc: rnd() * TAU,
        sb: 0.25 + rnd() * 0.45,
        sc: 0.35 + rnd() * 0.75,
        e: 0,
        a: 0,
      });
    }
    const order = Array.from({ length: BANDS }, (_, k) => k);
    for (let k = BANDS - 1; k > 0; k--) {
      const j = Math.floor(rnd() * (k + 1));
      [order[k], order[j]] = [order[j], order[k]];
    }
    this.bands = order.map((k, slot) => ({ k, center: (slot / BANDS) * TAU + (rnd() - 0.5) * 0.25, rate: 0.5 + (k / (BANDS - 1)) * 2.2, gain: 1.12 - (k / (BANDS - 1)) * 0.4, seed: rnd() * 1000, level: 0 }));
  }

  private hash(n: number) {
    const v = Math.sin(n * 91.7 + 17.3) * 43758.5453;
    return v - Math.floor(v);
  }

  private noise(x: number) {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    const h = (n: number) => {
      const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return v - Math.floor(v);
    };
    return h(i) * (1 - u) + h(i + 1) * u;
  }

  /** Syllables: a quick rise and a slower fall, about four a second, some louder than others. */
  private speech(t: number, step: number) {
    const x = t * 4.3;
    const n = Math.floor(x);
    const f = x - n;
    const amp = this.hash(n) < 0.14 ? 0.25 : 0.5 + 0.5 * this.hash(n + 0.5);
    const shape = f < 0.22 ? 0.5 - 0.5 * Math.cos((f / 0.22) * Math.PI) : Math.exp(-(f - 0.22) * 2.8);
    if (this.gate === null) {
      const e = Math.sin(t * 0.55) + 0.6 * Math.sin(t * 0.23 + 1.3) + 0.35 * Math.sin(t * 1.1 + 0.5);
      const g = Math.max(0, Math.min(1, (e + 0.6) / 0.5));
      return g * g * (3 - 2 * g) * amp * shape;
    }
    this.gateNow += (this.gate - this.gateNow) * (1 - Math.exp(-step * 7));
    return this.gateNow * amp * shape;
  }

  private advance(dt: number) {
    const o = this.o;
    const step = dt * o.speed;
    this.t += step;
    const t = this.t;
    const ease = (k: number) => 1 - Math.exp(-step * k);
    this.level += ((o.reduced ? Math.min(o.intensity, 0.35) : o.intensity) - this.level) * ease(4);
    if (this.shown < 1) this.shown = Math.min(1, this.shown + dt / 0.8);
    // Real sound when there is some to read; otherwise syllables acted out while words are recognized.
    const heard = o.mode === "speech" ? (this.listen?.() ?? null) : null;
    const x = o.mode === "speech" ? (heard ? heard.level : this.speech(t, step)) : o.mode === "steady" ? 0.3 + 0.08 * Math.sin(t * 0.8) : 0;
    this.G += (x - this.G) * ease(x > this.G ? (heard ? 36 : 13) : heard ? 7.5 : 4.6);
    this.E += (this.G - this.E) * ease(this.G > this.E ? (heard ? 9 : 3) : heard ? 2.2 : 1.1);
    // The bands: an equalizer wrapped around the ring. With the microphone, each sector follows its own slice of the
    // voice; without it, each has its own slow life.
    for (const b of this.bands) {
      let target: number;
      if (heard) target = Math.min(1.3, (0.22 * heard.level + 1.1 * (heard.bands[b.k] ?? 0)) * b.gain);
      else {
        const w = Math.max(0, Math.min(1, (this.noise(t * (0.3 + b.rate * 0.22) + b.seed) - 0.18) / 0.62));
        target = this.G * b.gain * (0.22 + 0.78 * w);
      }
      b.level += (target - b.level) * ease(target > b.level ? (heard ? 32 : 12) : heard ? 8.5 : 4.4);
    }
    const W = 0.3;
    for (let i = 0; i < BINS; i++) {
      const a = (i / BINS) * TAU;
      let v = 0;
      for (const b of this.bands) {
        let d = Math.abs(a - b.center) % TAU;
        if (d > Math.PI) d = TAU - d;
        if (d < 3 * W) v += b.level * Math.exp(-(d * d) / (2 * W * W));
      }
      this.act[i] = Math.min(1.3, v) * this.level;
    }
    // Every dot follows its sector at its own pace.
    const slide = o.reduced ? 0 : 1;
    for (const p of this.dots) {
      let na = p.ang % TAU;
      if (na < 0) na += TAU;
      const part = this.act[Math.floor((na / TAU) * BINS) % BINS];
      p.a += (part - p.a) * (1 - Math.exp(-step * (part > p.a ? 26 : 9)));
      const A = part * p.react;
      // With real sound every dot answers sooner (and lets go a little sooner), so each word shows.
      p.e += (A - p.e) * (1 - Math.exp(-step * (A > p.e ? p.att * (heard ? 2.6 : 1.3) : p.dec * (heard ? 1.5 : 1))));
      p.pa += step * p.os * (0.3 + 1.1 * p.e);
      p.pb += step * p.sb;
      p.pc += step * p.sc * (1 + 0.5 * p.e);
      p.ang += step * p.flow * (0.018 + 0.1 * p.e) * slide;
    }
  }

  private draw() {
    const o = this.o;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const k3 = 1 - Math.pow(1 - this.shown, 3);
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.clearRect(0, 0, 800, 800);
    ctx.fillStyle = o.color;
    // The whole ring swells a little with the loudness; each part of it leans out with its own sound.
    const R = o.radius * (0.93 + 0.07 * k3) * (1 + 0.045 * this.E * this.level);
    const ds = o.dotSize;
    for (const p of this.dots) {
      const e = p.e;
      const along = e * p.reach * (0.78 + 0.22 * Math.sin(p.pc));
      const r = R + p.off + p.a * (7 + 15 * p.react) + Math.sin(p.pb) * 1.6 + p.dx * along + Math.cos(p.pa) * p.orb * e;
      const tn = Math.cos(p.pb * 0.8 + p.pc) * 1.6 + p.dy * along + Math.sin(p.pa) * p.orb * e;
      const ca = Math.cos(p.ang);
      const sa = Math.sin(p.ang);
      ctx.globalAlpha = Math.min(1, p.op * (0.84 + 0.16 * Math.sin(p.pc)) * (0.82 + 0.5 * e)) * k3;
      ctx.beginPath();
      ctx.arc(400 + ca * r - sa * tn, 400 + sa * r + ca * tn, (p.size * ds * (1 + 0.2 * e)) / 2, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
