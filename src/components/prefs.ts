/** Appearance preferences, remembered on this device: theme (auto / light / dark) and accent color. */

export type Accent = "blue" | "orange" | "green";
export type Theme = "system" | "light" | "dark";

export const ACCENTS: { value: Accent; label: string; swatch: string }[] = [
  { value: "blue", label: "Blue", swatch: "#2563eb" },
  { value: "orange", label: "Orange", swatch: "#f4511e" },
  { value: "green", label: "Green", swatch: "#16a34a" },
];

const ACCENT_KEY = "hyperanchor:accent";
const THEME_KEY = "hyperanchor:theme";

declare global {
  interface Window {
    /** Installed by PREFS_BOOT: re-applies the theme and keeps following the system while on auto. */
    __hyperanchorTheme?: { set: (t: Theme) => void };
  }
}

/**
 * Runs in <head> before the first paint, so a saved theme or accent never flashes the default.
 * Sets html[data-theme] to "light" or "dark" (auto follows the system, live) and html[data-accent],
 * and keeps the browser's theme-color in step.
 */
export const PREFS_BOOT = `(function(){
var d=document.documentElement,t="system";
function get(k){try{return localStorage.getItem(k)}catch(e){return null}}
var a=get("${ACCENT_KEY}");if(a==="orange"||a==="green")d.dataset.accent=a;
var s=get("${THEME_KEY}");if(s==="light"||s==="dark")t=s;
var m=window.matchMedia("(prefers-color-scheme: dark)");
function apply(){
var k=t==="dark"||(t==="system"&&m.matches)?"dark":"light";d.dataset.theme=k;
var c=document.querySelector('meta[name="theme-color"]');
if(!c){c=document.createElement("meta");c.name="theme-color";document.head.appendChild(c)}
c.content=k==="dark"?"#141414":"#ffffff"}
apply();
window.__hyperanchorTheme={set:function(v){t=v;apply()}};
function follow(){if(t==="system")apply()}
if(m.addEventListener)m.addEventListener("change",follow);else if(m.addListener)m.addListener(follow);
})()`;

export function readAccent(): Accent {
  const a = typeof document === "undefined" ? undefined : document.documentElement.dataset.accent;
  return a === "orange" || a === "green" ? a : "blue";
}

export function applyAccent(a: Accent) {
  if (a === "blue") delete document.documentElement.dataset.accent;
  else document.documentElement.dataset.accent = a;
  try {
    localStorage.setItem(ACCENT_KEY, a);
  } catch {
    // Private mode or storage disabled: the choice lasts until reload.
  }
}

export function readTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(t: Theme) {
  try {
    if (t === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  } catch {
    // As above: applies for this visit only.
  }
  window.__hyperanchorTheme?.set(t);
}
