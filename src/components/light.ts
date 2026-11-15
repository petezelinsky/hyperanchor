/**
 * The light inside marks. The page is black and white; what it is about, in each panel, is lit. One scale of
 * six colours (--light-1…6: green, yellow, orange, red, pink, violet) runs through all of it: the more gets done, the
 * further along it a mark goes. A place on the scale is a number from 0 to 1.
 */
const STEPS = 6;

/** The colour at a place on the scale, as CSS (it follows the theme: the steps are tokens). */
export function lightAt(t: number): string {
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0)) * (STEPS - 1);
  const i = Math.min(STEPS - 2, Math.floor(x));
  const k = Math.round((x - i) * 100);
  if (k <= 0) return `var(--light-${i + 1})`;
  if (k >= 100) return `var(--light-${i + 2})`;
  return `color-mix(in oklch, var(--light-${i + 2}) ${k}%, var(--light-${i + 1}))`;
}

/** A stretch of the scale as gradient stops: where (0…1 along the gradient) and which colour. */
export function lightStops(from: number, to: number): [number, string][] {
  const span = to - from;
  const out: [number, string][] = [[0, lightAt(from)]];
  if (span !== 0) {
    const inside = [];
    for (let i = 0; i < STEPS; i++) {
      const s = i / (STEPS - 1);
      if (s > Math.min(from, to) + 1e-6 && s < Math.max(from, to) - 1e-6) inside.push(s);
    }
    if (span < 0) inside.reverse();
    for (const s of inside) out.push([(s - from) / span, lightAt(s)]);
  }
  out.push([1, lightAt(to)]);
  return out;
}

/** The same stretch as a CSS gradient, e.g. lightGradient("to right", 0, 0.47). */
export const lightGradient = (direction: string, from: number, to: number) =>
  `linear-gradient(${direction}, ${lightStops(from, to)
    .map(([at, c]) => `${c} ${(at * 100).toFixed(1)}%`)
    .join(", ")})`;

// ── The same scale as plain colours, for a canvas (which can't read tokens) ──

type Lch = [number, number, number];
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function hexToLch(hex: string): Lch {
  const h = hex.trim().replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => toLinear(parseInt(h.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), Math.atan2(B, A)];
}
function lchToRgb([L, C, H]: Lch): string {
  const A = C * Math.cos(H);
  const B = C * Math.sin(H);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return `rgb(${rgb.map((c) => Math.round(Math.min(1, Math.max(0, toGamma(c))) * 255)).join(" ")})`;
}

/** The scale in `n` even steps, as the theme has it right now (read from the tokens on `el`). */
export function lightRamp(el: Element, n: number): string[] {
  const css = getComputedStyle(el);
  const steps = Array.from({ length: STEPS }, (_, i) => css.getPropertyValue(`--light-${i + 1}`).trim());
  if (steps.some((c) => !/^#[0-9a-f]{6}$/i.test(c))) return [];
  const lch = steps.map(hexToLch);
  return Array.from({ length: n }, (_, k) => {
    const x = (n > 1 ? k / (n - 1) : 0) * (STEPS - 1);
    const i = Math.min(STEPS - 2, Math.floor(x));
    const f = x - i;
    const a = lch[i];
    const b = lch[i + 1];
    // The short way round the colour wheel.
    let dh = b[2] - a[2];
    if (dh > Math.PI) dh -= 2 * Math.PI;
    if (dh < -Math.PI) dh += 2 * Math.PI;
    return lchToRgb([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + dh * f]);
  });
}
