"use client";

import { getFontEmbedCSS, toCanvas } from "html-to-image";

/**
 * The liquid lens (Zelinsky liquid lens): a press drops a single ring of liquid glass onto the page, and it rolls out
 * from the exact point that was pressed, over everything on screen. It bends what is under it like a lens, softens it at
 * the crest and splits only the shapes it bends into a thin red and cyan fringe; empty background stays clean. A quick
 * press gives a light ring; holding presses a dent under the finger and lets a deeper ring go on release. About a
 * second for the ring itself.
 *
 * A shader can't bend live DOM, so it plays on a picture of the page taken ahead of time (`prepare`, on hover and once
 * the page has settled), over the page, and is gone when the ring has passed. No WebGL2, reduced motion, or a picture
 * that no longer matches the page (scrolled, resized, changed): nothing plays, and nothing breaks.
 */

const VERT = `#version 300 es
void main(){vec2 p=vec2(gl_VertexID<<1&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uSize;
uniform float uDpr;
uniform vec2 uOrigin;
uniform float uT;
uniform float uPress;
uniform float uAmp;
uniform float uWidth;
uniform float uSpeed;
uniform float uChroma;
out vec4 outColor;

vec3 tap(vec2 p) { return texture(uTex, clamp(p / uSize, vec2(0.0), vec2(1.0))).rgb; }
float wave(float u) { float k = u / max(uWidth, 1.0); return exp(-k * k * 2.0); }

void main() {
  vec2 p = vec2(gl_FragCoord.x, uSize.y * uDpr - gl_FragCoord.y) / uDpr;
  vec2 rel = p - uOrigin;
  float d = length(rel);
  vec2 dir = rel / max(d, 1e-3);
  float u = d - uT * uSpeed;
  float life = exp(-uT * 1.4) * smoothstep(0.0, 0.05, uT) * smoothstep(0.0, 40.0, d + 20.0);
  float h = wave(u) * life;
  float slope = (wave(u + 1.0) - wave(u - 1.0)) * 0.5 * uWidth * life;
  float dent = uPress * (0.012 + 0.05 * exp(-d * d / 4900.0));
  vec2 q = uOrigin + rel * (1.0 + dent) - dir * h * uAmp * 0.12;
  vec2 disp = dir * slope * uAmp;
  vec3 col;
  col.r = tap(q - disp * (1.0 + uChroma)).r;
  col.gb = tap(q - disp * (1.0 - uChroma)).gb;
  float blur = max(h, 0.0) * 2.0;
  if (blur > 0.1) {
    vec2 sp = q - disp;
    vec3 acc = col * 2.0;
    acc += tap(sp + vec2(blur, 0.0)) + tap(sp - vec2(blur, 0.0));
    acc += tap(sp + vec2(0.0, blur)) + tap(sp - vec2(0.0, blur));
    col = acc / 6.0;
  }
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

/** The levers, at the skill's defaults: a subtle ring. */
const STRENGTH = 12;
const RING = 64;
const SPEED = 520;
const CHROMA = 0.6;
const BOOST = 1.5;
const CHARGE = 0.8;

type Picture = { canvas: HTMLCanvasElement; key: string; x: number; y: number; w: number; h: number };

export class LiquidLens {
  private picture: Picture | null = null;
  private taking: Promise<void> | null = null;
  private fonts: string | null = null;
  private view: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private raf = 0;
  private origin: [number, number] = [0, 0];
  private holding = false;
  private held0 = 0;
  private start = 0;
  private charge = 0;
  private stopScroll: (() => void) | null = null;
  private fading: Animation | null = null;
  private waiting: (() => void)[] = [];

  /**
   * `area`: the part of the page the ring rolls over (what scrolls: the work area); `content`: what is in it (drawn
   * into the picture); `version`: changes whenever what's on it does, so an old picture is never played.
   */
  constructor(
    private readonly area: () => HTMLElement | null,
    private readonly content: () => HTMLElement | null,
    private readonly version: () => string = () => "",
  ) {}

  /** A ring is on screen (held or rolling). */
  playing() {
    return this.holding || this.raf !== 0;
  }

  /** Resolves once the ring has passed and the picture has faded back into the page (at once when nothing plays). */
  ended(): Promise<void> {
    return this.playing() ? new Promise((resolve) => this.waiting.push(resolve)) : Promise.resolve();
  }

  static supported() {
    return typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !!document.createElement("canvas").getContext("webgl2");
  }

  /** Where the area is on screen right now, and what would make a picture of it out of date. */
  private now() {
    const area = this.area();
    const content = this.content();
    if (!area || !content) return null;
    const a = area.getBoundingClientRect();
    // Only what can be seen: the area, cut to the window (on phones the page itself scrolls).
    const x = Math.max(0, a.left);
    const y = Math.max(0, a.top);
    const w = Math.min(window.innerWidth, a.right) - x;
    const h = Math.min(window.innerHeight, a.bottom) - y;
    if (w < 8 || h < 8) return null;
    const c = content.getBoundingClientRect();
    const dark = document.documentElement.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const key = [Math.round(x), Math.round(y), Math.round(w), Math.round(h), Math.round(c.top), Math.round(c.left), Math.round(c.height), dark, this.version()].join(" ");
    return { content, x, y, w, h, top: c.top - y, left: c.left - x, key };
  }

  /** Takes the picture now (on hover, once the page has settled): never at the press itself, which would stall it. */
  prepare(): Promise<void> {
    if (this.taking) return this.taking;
    const at = this.now();
    if (!at || this.picture?.key === at.key) return Promise.resolve();
    this.taking = (async () => {
      try {
        await document.fonts?.ready;
        this.fonts ??= await getFontEmbedCSS(at.content);
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const bg = getComputedStyle(at.content).backgroundColor;
        const canvas = await toCanvas(at.content, {
          pixelRatio: ratio,
          width: at.w,
          height: at.h,
          backgroundColor: bg && bg !== "rgba(0, 0, 0, 0)" ? bg : getComputedStyle(document.body).backgroundColor,
          fontEmbedCSS: this.fonts,
          // The picture is the window onto the page: the content moved up by however far it is scrolled.
          style: { transform: `translate(${at.left}px, ${at.top}px)`, transformOrigin: "0 0", margin: "0" },
        });
        // The page may have moved while the picture was taken: such a picture is thrown away.
        const after = this.now();
        if (after && after.key === at.key) this.picture = { canvas, key: at.key, x: at.x, y: at.y, w: at.w, h: at.h };
      } catch {
        this.picture = null;
      } finally {
        this.taking = null;
      }
    })();
    return this.taking;
  }

  /** A press at (clientX, clientY): the dent while it's held. False when there's no fresh picture to play it on. */
  press(clientX: number, clientY: number): boolean {
    const at = this.now();
    const pic = this.picture;
    if (!at || !pic || pic.key !== at.key || !this.ensureView(pic)) return false;
    this.origin = [clientX - pic.x, clientY - pic.y];
    this.holding = true;
    this.held0 = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.frame);
    // Scrolling under a frozen picture would show the wrong page: the ring stops at once.
    const area = this.area();
    const quit = () => this.finish();
    area?.addEventListener("scroll", quit, { once: true, passive: true });
    window.addEventListener("scroll", quit, { once: true, passive: true });
    this.stopScroll = () => {
      area?.removeEventListener("scroll", quit);
      window.removeEventListener("scroll", quit);
    };
    return true;
  }

  /** The press ends: the ring rolls out from where it was. */
  release() {
    if (!this.holding) return;
    this.holding = false;
    this.charge = this.chargeAt(performance.now());
    this.start = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.frame);
  }

  /** A press that didn't happen with a pointer (Enter, Space): a light ring from (clientX, clientY). */
  tap(clientX: number, clientY: number) {
    if (this.press(clientX, clientY)) {
      this.held0 = performance.now();
      this.release();
    }
  }

  destroy() {
    this.finish();
    this.picture = null;
  }

  private chargeAt(now: number) {
    const c = Math.min(1, (now - this.held0) / 1000 / CHARGE);
    return 1 - (1 - c) * (1 - c);
  }

  private ensureView(pic: Picture) {
    if (!this.view) {
      const view = document.createElement("canvas");
      view.setAttribute("aria-hidden", "true");
      const gl = view.getContext("webgl2", { alpha: false, antialias: false, preserveDrawingBuffer: false, premultipliedAlpha: false });
      if (!gl) return false;
      const sh = (k: number, src: string) => {
        const x = gl.createShader(k)!;
        gl.shaderSource(x, src);
        gl.compileShader(x);
        if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x) ?? "shader");
        return x;
      };
      try {
        const prog = gl.createProgram()!;
        gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
        gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
        gl.linkProgram(prog);
        gl.useProgram(prog);
        for (const n of ["uTex", "uSize", "uDpr", "uOrigin", "uT", "uPress", "uAmp", "uWidth", "uSpeed", "uChroma"]) this.u[n] = gl.getUniformLocation(prog, n);
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        for (const [k, v] of [
          [gl.TEXTURE_MIN_FILTER, gl.LINEAR],
          [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
          [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
          [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
        ])
          gl.texParameteri(gl.TEXTURE_2D, k, v);
      } catch {
        return false;
      }
      this.view = view;
      this.gl = gl;
    }
    const view = this.view;
    const gl = this.gl!;
    // A ring that starts while the last one is still fading takes the picture back at full strength.
    this.fading?.cancel();
    this.fading = null;
    const ratio = pic.canvas.width / pic.w;
    view.width = pic.canvas.width;
    view.height = pic.canvas.height;
    Object.assign(view.style, { position: "fixed", left: `${pic.x}px`, top: `${pic.y}px`, width: `${pic.w}px`, height: `${pic.h}px`, pointerEvents: "none", zIndex: "70" });
    gl.viewport(0, 0, view.width, view.height);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pic.canvas);
    gl.uniform1i(this.u.uTex, 0);
    gl.uniform2f(this.u.uSize, pic.w, pic.h);
    gl.uniform1f(this.u.uDpr, ratio);
    gl.uniform1f(this.u.uSpeed, SPEED);
    gl.uniform1f(this.u.uChroma, CHROMA);
    if (!view.isConnected) document.body.appendChild(view);
    return true;
  }

  private frame = (now: number) => {
    const gl = this.gl;
    const pic = this.picture;
    if (!gl || !pic) return this.finish();
    let t: number;
    let press: number;
    let amp = 0;
    let ring = RING;
    let more = true;
    if (this.holding) {
      press = this.chargeAt(now);
      t = -1;
    } else {
      const c = this.charge;
      t = (now - this.start) / 1000;
      amp = STRENGTH * (1 + BOOST * c);
      ring *= 1 + 0.4 * c;
      press = c * Math.exp(-t * 9) + Math.sin(Math.PI * Math.min(1, t / 0.45)) * 0.5 * (1 - c);
      const [ox, oy] = this.origin;
      const far = Math.max(...[[0, 0], [pic.w, 0], [0, pic.h], [pic.w, pic.h]].map(([x, y]) => Math.hypot(x - ox, y - oy)));
      more = t < Math.min(2.4, (far + ring * 2.5) / SPEED + 0.15);
    }
    gl.uniform2f(this.u.uOrigin, this.origin[0], this.origin[1]);
    gl.uniform1f(this.u.uT, t);
    gl.uniform1f(this.u.uPress, press);
    gl.uniform1f(this.u.uAmp, amp);
    gl.uniform1f(this.u.uWidth, ring);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (more) this.raf = requestAnimationFrame(this.frame);
    else this.finish();
  };

  /**
   * The ring is over: the picture fades back into the live page under it (which may have changed meanwhile, so the
   * change shows as a soft crossfade rather than a cut), and whoever waits for the end hears of it.
   */
  private finish() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.holding = false;
    this.stopScroll?.();
    this.stopScroll = null;
    const view = this.view;
    const done = () => {
      const waiting = this.waiting;
      this.waiting = [];
      for (const w of waiting) w();
    };
    if (view?.isConnected) {
      const fade = view.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
      this.fading = fade;
      fade.onfinish = () => {
        if (this.fading !== fade) return;
        this.fading = null;
        view.remove();
        done();
      };
      fade.oncancel = () => {
        if (this.fading === fade) this.fading = null;
      };
    } else done();
  }
}
