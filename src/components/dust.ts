"use client";

/**
 * A finished card turns to dust: it holds for a beat with its box ticked, then comes apart from its left edge to its
 * right, and every piece of it floats up and away as a dot, the same round dots, in the same mix of sizes and strengths,
 * as the voice's sphere. What hasn't come apart yet stays whole, so the card dissolves rather than flickering out. It is
 * drawn once into a picture (its face, its box, its words), and that picture is what dissolves: a few thousand dots on
 * one canvas over the screen, gone in about a second. With reduced motion the card simply fades.
 */

/** What the card looked like as it left: where it was, and what was on it. */
export type CardShot = {
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
  face: string;
  check: { x: number; y: number; size: number; radius: number } | null;
  words: { text: string; x: number; y: number; font: string; spacing: string; color: string }[];
};

/** Takes the card's picture from the page: call while it is still there. */
export function shootCard(card: HTMLElement): CardShot {
  const r = card.getBoundingClientRect();
  const cs = getComputedStyle(card);
  // A card caught mid-way through moving up the deck is drawn as small as it was.
  const scale = card.offsetWidth ? r.width / card.offsetWidth : 1;
  const boxEl = card.querySelector<HTMLElement>('[role="checkbox"]');
  const b = boxEl?.getBoundingClientRect();
  const words: CardShot["words"] = [];
  const heading = card.querySelector("h2");
  if (heading) {
    const hs = getComputedStyle(heading);
    const size = parseFloat(hs.fontSize) * scale;
    const font = `${hs.fontStyle} ${hs.fontWeight} ${size}px ${hs.fontFamily}`;
    const spacing = hs.letterSpacing === "normal" ? "0px" : `${parseFloat(hs.letterSpacing) * scale}px`;
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? "";
      // Word by word (a word split over two lines, letter by letter), each where the page put it.
      for (const m of text.matchAll(/\S+/g)) {
        const at = m.index ?? 0;
        range.setStart(node, at);
        range.setEnd(node, at + m[0].length);
        const rects = range.getClientRects();
        if (rects.length === 1) words.push({ text: m[0], x: rects[0].left, y: rects[0].top + rects[0].height / 2, font, spacing, color: hs.color });
        else
          for (let i = 0; i < m[0].length; i++) {
            range.setStart(node, at + i);
            range.setEnd(node, at + i + 1);
            const c = range.getClientRects()[0];
            if (c) words.push({ text: m[0][i], x: c.left, y: c.top + c.height / 2, font, spacing, color: hs.color });
          }
      }
    }
  }
  return {
    x: r.left,
    y: r.top,
    w: r.width,
    h: r.height,
    radius: (parseFloat(cs.borderTopLeftRadius) || 0) * scale,
    face: cs.backgroundColor,
    check: b ? { x: b.left, y: b.top, size: b.width, radius: (parseFloat(boxEl ? getComputedStyle(boxEl).borderTopLeftRadius : "6") || 6) * scale } : null,
    words,
  };
}

type Dot = { x: number; y: number; at: number; vx: number; vy: number; lift: number; amp: number; freq: number; phase: number; life: number; size: number; alpha: number; tone: number };
type Cell = { x: number; y: number; at: number };

const HOLD = 90; // ms the card stays whole, box ticked, before it comes apart
const SWEEP = 520; // ms for the edge to cross the card
const LEVELS = 6; // how finely the dots' strengths are grouped for drawing

/** Turns the card in `shot` to dust over `host` (a fixed layer covering the screen). */
export function disintegrate(host: HTMLElement, shot: CardShot): void {
  const root = getComputedStyle(document.documentElement);
  const accent = root.getPropertyValue("--accent").trim() || "#2563eb";
  const onAccent = root.getPropertyValue("--on-accent").trim() || "#fff";
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = Math.ceil(shot.w);
  const H = Math.ceil(shot.h);
  if (W < 4 || H < 4) return;

  // The card's picture: its face, its box (ticked) and its words.
  const pic = document.createElement("canvas");
  pic.width = Math.ceil(W * dpr);
  pic.height = Math.ceil(H * dpr);
  const p = pic.getContext("2d", { willReadFrequently: true });
  if (!p) return;
  p.scale(dpr, dpr);
  p.fillStyle = shot.face;
  p.beginPath();
  p.roundRect(0, 0, shot.w, shot.h, shot.radius);
  p.fill();
  if (shot.check) {
    const c = shot.check;
    p.fillStyle = accent;
    p.beginPath();
    p.roundRect(c.x - shot.x, c.y - shot.y, c.size, c.size, c.radius);
    p.fill();
    const k = (c.size * 0.72) / 12;
    const ox = c.x - shot.x + c.size * 0.14;
    const oy = c.y - shot.y + c.size * 0.14;
    p.strokeStyle = onAccent;
    p.lineWidth = Math.max(1.6, c.size * 0.075);
    p.lineCap = "round";
    p.lineJoin = "round";
    p.beginPath();
    p.moveTo(ox + 2.6 * k, oy + 6.3 * k);
    p.lineTo(ox + 5 * k, oy + 8.6 * k);
    p.lineTo(ox + 9.4 * k, oy + 3.7 * k);
    p.stroke();
  }
  p.textBaseline = "middle";
  for (const w of shot.words) {
    p.font = w.font;
    (p as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = w.spacing;
    p.fillStyle = w.color;
    p.fillText(w.text, w.x - shot.x, w.y - shot.y);
  }

  const layer = document.createElement("canvas");
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, { position: "fixed", inset: "0", width: "100vw", height: "100dvh", pointerEvents: "none", zIndex: "10" });
  layer.width = Math.ceil(window.innerWidth * dpr);
  layer.height = Math.ceil(window.innerHeight * dpr);
  host.appendChild(layer);
  const g = layer.getContext("2d");
  if (!g) return layer.remove();
  g.scale(dpr, dpr);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const start = performance.now();
    const fade = (now: number) => {
      const t = Math.min(1, (now - start) / 160);
      g.clearRect(0, 0, window.innerWidth, window.innerHeight);
      g.globalAlpha = 1 - t;
      g.drawImage(pic, shot.x, shot.y, shot.w, shot.h);
      if (t < 1) requestAnimationFrame(fade);
      else layer.remove();
    };
    fade(start);
    return;
  }

  // The picture in cells: each comes apart at its moment (left first, a ragged edge), and most become a dot.
  const data = p.getImageData(0, 0, pic.width, pic.height).data;
  const step = Math.max(2.4, Math.sqrt((W * H) / 5200));
  const faceRGB = parseRGB(shot.face);
  const tones: string[] = [];
  const toneOf = new Map<number, number>();
  const cells: Cell[] = [];
  const dots: Dot[] = [];
  const rnd = Math.random;
  for (let y = step / 2; y < H; y += step) {
    for (let x = step / 2; x < W; x += step) {
      const i = (Math.floor(y * dpr) * pic.width + Math.floor(x * dpr)) * 4;
      const a = data[i + 3] / 255;
      if (a < 0.08) continue;
      const at = HOLD + (x / W) * SWEEP + (y / H) * 70 + (rnd() - 0.5) * 150;
      cells.push({ x, y, at });
      const rgb = [data[i], data[i + 1], data[i + 2]];
      const plain = Math.abs(rgb[0] - faceRGB[0]) + Math.abs(rgb[1] - faceRGB[1]) + Math.abs(rgb[2] - faceRGB[2]) < 24;
      // The plain face of the card goes as fewer, fainter dots than its box and its words.
      if (plain && rnd() > 0.42) continue;
      const key = ((rgb[0] >> 3) << 10) | ((rgb[1] >> 3) << 5) | (rgb[2] >> 3);
      let tone = toneOf.get(key);
      if (tone === undefined) {
        tone = tones.length;
        toneOf.set(key, tone);
        tones.push(`rgb(${rgb[0]},${rgb[1]},${rgb[2]})`);
      }
      const big = rnd() < 0.12;
      dots.push({
        x: shot.x + x,
        y: shot.y + y,
        at: Math.max(HOLD, at),
        vx: -8 + rnd() * 78,
        vy: -18 - rnd() * 62,
        lift: 50 + rnd() * 130,
        amp: 1.5 + rnd() * 8,
        freq: 2.5 + rnd() * 5,
        phase: rnd() * Math.PI * 2,
        life: 520 + rnd() * 560,
        size: (big ? 2.1 + rnd() * 0.9 : 0.95 + rnd() * 1.05) * (plain ? 1.1 : 1),
        alpha: a * (plain ? 0.5 + rnd() * 0.35 : 0.55 + rnd() * 0.45),
        tone,
      });
    }
  }
  cells.sort((a, b) => a.at - b.at);

  // What hasn't come apart yet: the picture, with each cell taken out as its moment comes.
  const rest = document.createElement("canvas");
  rest.width = pic.width;
  rest.height = pic.height;
  const r = rest.getContext("2d");
  if (!r) return layer.remove();
  r.drawImage(pic, 0, 0);
  let next = 0;
  const half = step / 2 + 0.5;

  const buckets: number[][] = Array.from({ length: tones.length * LEVELS }, () => []);
  const start = performance.now();
  const frame = (now: number) => {
    const t = now - start;
    while (next < cells.length && cells[next].at <= t) {
      const c = cells[next++];
      r.clearRect((c.x - half) * dpr, (c.y - half) * dpr, 2 * half * dpr, 2 * half * dpr);
    }
    g.clearRect(0, 0, window.innerWidth, window.innerHeight);
    if (next < cells.length) g.drawImage(rest, shot.x, shot.y, shot.w, shot.h);

    for (const b of buckets) b.length = 0;
    let alive = false;
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      const age = t - d.at;
      if (age < 0) {
        alive = true;
        continue;
      }
      if (age > d.life) continue;
      alive = true;
      const k = age / d.life;
      const fade = Math.pow(1 - k, 1.6) * d.alpha;
      if (fade < 0.02) continue;
      const level = Math.min(LEVELS - 1, Math.floor(fade * LEVELS));
      buckets[d.tone * LEVELS + level].push(i);
    }
    for (let bi = 0; bi < buckets.length; bi++) {
      const list = buckets[bi];
      if (!list.length) continue;
      g.fillStyle = tones[Math.floor(bi / LEVELS)];
      g.globalAlpha = ((bi % LEVELS) + 0.5) / LEVELS;
      g.beginPath();
      for (const i of list) {
        const d = dots[i];
        const s = (t - d.at) / 1000;
        const x = d.x + d.vx * s + Math.sin(d.freq * s + d.phase) * d.amp * Math.min(1, s * 3);
        const y = d.y + d.vy * s - 0.5 * d.lift * s * s;
        const rad = (d.size / 2) * (1 - 0.35 * ((t - d.at) / d.life));
        g.moveTo(x + rad, y);
        g.arc(x, y, rad, 0, Math.PI * 2);
      }
      g.fill();
    }
    g.globalAlpha = 1;
    if (alive || next < cells.length) requestAnimationFrame(frame);
    else layer.remove();
  };
  // The first frame now, in place of the card, so there is never a frame without it.
  frame(start);
}

function parseRGB(color: string): [number, number, number] {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(color);
  return m ? [+m[1], +m[2], +m[3]] : [255, 255, 255];
}

/**
 * What was said pours into the sphere: the words come apart from left to right, and every piece of them drifts in on a
 * curve to a point on the ring, shrinking and fading as it arrives (the sphere is thinking about them meanwhile). The
 * words are drawn once into a picture where they stand, and that picture is what pours; `el` itself should be hidden
 * as this starts. Nothing happens (false) with reduced motion, or with no words to pour.
 */
export function pourWords(host: HTMLElement, el: HTMLElement, to: { x: number; y: number; r: number }): boolean {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const box = el.getBoundingClientRect();
  const W = Math.ceil(box.width);
  const H = Math.ceil(box.height);
  if (W < 4 || H < 4) return false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // The words, each where the page put it, in its own font and color.
  const pic = document.createElement("canvas");
  pic.width = Math.ceil(W * dpr);
  pic.height = Math.ceil(H * dpr);
  const p = pic.getContext("2d", { willReadFrequently: true });
  if (!p) return false;
  p.scale(dpr, dpr);
  p.textBaseline = "middle";
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let any = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? "";
    const parent = node.parentElement;
    if (!parent) continue;
    const cs = getComputedStyle(parent);
    p.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    (p as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
    p.fillStyle = cs.color;
    for (const m of text.matchAll(/\S+/g)) {
      const at = m.index ?? 0;
      range.setStart(node, at);
      range.setEnd(node, at + m[0].length);
      const rects = range.getClientRects();
      if (rects.length === 1) {
        p.fillText(m[0], rects[0].left - box.left, rects[0].top - box.top + rects[0].height / 2);
        any = true;
      } else
        for (let i = 0; i < m[0].length; i++) {
          range.setStart(node, at + i);
          range.setEnd(node, at + i + 1);
          const c = range.getClientRects()[0];
          if (!c) continue;
          p.fillText(m[0][i], c.left - box.left, c.top - box.top + c.height / 2);
          any = true;
        }
    }
  }
  if (!any) return false;

  const layer = document.createElement("canvas");
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, { position: "fixed", inset: "0", width: "100vw", height: "100dvh", pointerEvents: "none", zIndex: "5" });
  layer.width = Math.ceil(window.innerWidth * dpr);
  layer.height = Math.ceil(window.innerHeight * dpr);
  host.appendChild(layer);
  const g = layer.getContext("2d");
  if (!g) {
    layer.remove();
    return false;
  }
  g.scale(dpr, dpr);

  type Grain = { x: number; y: number; cx: number; cy: number; tx: number; ty: number; at: number; life: number; size: number; alpha: number; tone: number };
  const data = p.getImageData(0, 0, pic.width, pic.height).data;
  const step = Math.max(1.8, Math.sqrt((W * H) / 14000));
  const tones: string[] = [];
  const toneOf = new Map<number, number>();
  const cells: { x: number; y: number; at: number }[] = [];
  const grains: Grain[] = [];
  const rnd = Math.random;
  const SWEEP_MS = 620;
  for (let y = step / 2; y < H; y += step) {
    for (let x = step / 2; x < W; x += step) {
      const i = (Math.floor(y * dpr) * pic.width + Math.floor(x * dpr)) * 4;
      const a = data[i + 3] / 255;
      if (a < 0.2) continue;
      const at = 60 + (x / W) * SWEEP_MS + (rnd() - 0.5) * 140;
      cells.push({ x, y, at });
      if (rnd() < 0.18) continue; // fewer grains than pixels: it pours, it doesn't smear
      const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
      let tone = toneOf.get(key);
      if (tone === undefined) {
        tone = tones.length;
        toneOf.set(key, tone);
        tones.push(`rgb(${data[i]},${data[i + 1]},${data[i + 2]})`);
      }
      const sx = box.left + x;
      const sy = box.top + y;
      // Where it lands: on the ring, on the side it comes from, give or take; the curve swings round as it goes.
      const ang = Math.atan2(sy - to.y, sx - to.x) + (rnd() - 0.5) * 1.9;
      const tr = to.r * (0.9 + rnd() * 0.22);
      const tx = to.x + Math.cos(ang) * tr;
      const ty = to.y + Math.sin(ang) * tr;
      const mx = (sx + tx) / 2;
      const my = (sy + ty) / 2;
      const swing = (rnd() < 0.5 ? -1 : 1) * (40 + rnd() * 110);
      const len = Math.hypot(tx - sx, ty - sy) || 1;
      grains.push({
        x: sx,
        y: sy,
        cx: mx + (-(ty - sy) / len) * swing,
        cy: my + ((tx - sx) / len) * swing - 30 - rnd() * 60,
        tx,
        ty,
        at: Math.max(60, at),
        life: 720 + rnd() * 520,
        size: rnd() < 0.12 ? 2 + rnd() * 0.9 : 0.9 + rnd() * 1.1,
        alpha: a * (0.6 + rnd() * 0.4),
        tone,
      });
    }
  }
  cells.sort((a, b) => a.at - b.at);
  const rest = document.createElement("canvas");
  rest.width = pic.width;
  rest.height = pic.height;
  const r = rest.getContext("2d");
  if (!r) {
    layer.remove();
    return false;
  }
  r.drawImage(pic, 0, 0);
  let next = 0;
  const half = step / 2 + 0.6;
  const buckets: number[][] = Array.from({ length: tones.length * LEVELS }, () => []);
  const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const start = performance.now();
  const frame = (now: number) => {
    const t = now - start;
    while (next < cells.length && cells[next].at <= t) {
      const c = cells[next++];
      r.clearRect((c.x - half) * dpr, (c.y - half) * dpr, 2 * half * dpr, 2 * half * dpr);
    }
    g.clearRect(0, 0, window.innerWidth, window.innerHeight);
    if (next < cells.length) g.drawImage(rest, box.left, box.top, W, H);
    for (const b of buckets) b.length = 0;
    let alive = false;
    for (let i = 0; i < grains.length; i++) {
      const d = grains[i];
      const age = t - d.at;
      if (age < 0) {
        alive = true;
        continue;
      }
      if (age > d.life) continue;
      alive = true;
      const k = age / d.life;
      const fade = d.alpha * (1 - Math.pow(k, 2.4));
      if (fade < 0.03) continue;
      buckets[d.tone * LEVELS + Math.min(LEVELS - 1, Math.floor(fade * LEVELS))].push(i);
    }
    for (let bi = 0; bi < buckets.length; bi++) {
      const list = buckets[bi];
      if (!list.length) continue;
      g.fillStyle = tones[Math.floor(bi / LEVELS)];
      g.globalAlpha = ((bi % LEVELS) + 0.5) / LEVELS;
      g.beginPath();
      for (const i of list) {
        const d = grains[i];
        const k = ease(Math.min(1, (t - d.at) / d.life));
        const u = 1 - k;
        const x = u * u * d.x + 2 * u * k * d.cx + k * k * d.tx;
        const y = u * u * d.y + 2 * u * k * d.cy + k * k * d.ty;
        const rad = (d.size / 2) * (1 - 0.45 * k);
        g.moveTo(x + rad, y);
        g.arc(x, y, rad, 0, Math.PI * 2);
      }
      g.fill();
    }
    g.globalAlpha = 1;
    if (alive || next < cells.length) requestAnimationFrame(frame);
    else layer.remove();
  };
  frame(start);
  return true;
}
