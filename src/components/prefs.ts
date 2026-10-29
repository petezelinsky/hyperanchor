/** Appearance preferences, remembered on this device: theme (light / dark) and accent color. */

export type Accent = "blue" | "orange" | "green";
export type Theme = "light" | "dark";

export const ACCENTS: { value: Accent; label: string; swatch: string }[] = [
  { value: "blue", label: "Blue", swatch: "#2563eb" },
  { value: "orange", label: "Orange", swatch: "#f4511e" },
  { value: "green", label: "Green", swatch: "#16a34a" },
];

const ACCENT_KEY = "hyperanchor:accent";
const THEME_KEY = "hyperanchor:theme";

declare global {
  interface Window {
    /** Installed by PREFS_BOOT: switches the theme in place. */
    __hyperanchorTheme?: { set: (t: Theme) => void };
  }
}

/**
 * Runs in <head> before the first paint, so a saved theme or accent never flashes the default.
 * Sets html[data-theme] to the saved "light" or "dark" (until someone picks one, the device's setting at load)
 * and html[data-accent], and keeps the browser's theme-color in step. While a choice changes, html[data-switching]
 * holds color transitions back for a frame (see globals.css), so the whole page changes at once instead of in a ripple.
 */
export const PREFS_BOOT = `(function(){
var d=document.documentElement;
function get(k){try{return localStorage.getItem(k)}catch(e){return null}}
var a=get("${ACCENT_KEY}");if(a==="orange"||a==="green")d.dataset.accent=a;
var t=get("${THEME_KEY}");
if(t!=="light"&&t!=="dark")t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
function apply(){
d.dataset.theme=t;
var c=document.querySelector('meta[name="theme-color"]');
if(!c){c=document.createElement("meta");c.name="theme-color";document.head.appendChild(c)}
c.content=t==="dark"?"#141414":"#ffffff"}
function quiet(){d.dataset.switching="";requestAnimationFrame(function(){requestAnimationFrame(function(){delete d.dataset.switching})})}
apply();
window.__hyperanchorTheme={set:function(v){t=v;quiet();apply()}};
})()`;

export function readAccent(): Accent {
  const a = typeof document === "undefined" ? undefined : document.documentElement.dataset.accent;
  return a === "orange" || a === "green" ? a : "blue";
}

export function applyAccent(a: Accent) {
  const d = document.documentElement;
  d.dataset.switching = "";
  requestAnimationFrame(() => requestAnimationFrame(() => delete d.dataset.switching));
  if (a === "blue") delete d.dataset.accent;
  else d.dataset.accent = a;
  try {
    localStorage.setItem(ACCENT_KEY, a);
  } catch {
    // Private mode or storage disabled: the choice lasts until reload.
  }
}

/** The theme on screen: the saved choice, or the device's setting until there is one. */
export function readTheme(): Theme {
  return typeof document !== "undefined" && document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function applyTheme(t: Theme) {
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    // As above: applies for this visit only.
  }
  window.__hyperanchorTheme?.set(t);
}
