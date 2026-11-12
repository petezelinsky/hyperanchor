/** Preferences remembered on this device: the theme (light / dark), the first day of the week, the order of tasks, sounds. */

import type { WeekStart } from "@/lib/dates";
import { DEFAULT_SORT, type Sort } from "@/lib/tasks";

export type Theme = "light" | "dark";

const THEME_KEY = "hyperanchor:theme";
const WEEK_KEY = "hyperanchor:week-start";

declare global {
  interface Window {
    /** Installed by PREFS_BOOT: switches the theme in place. */
    __hyperanchorTheme?: { set: (t: Theme) => void };
  }
}

/**
 * Runs in <head> before the first paint, so a saved theme never flashes the default.
 * Sets html[data-theme] to the saved "light" or "dark" (until someone picks one, the device's setting at load)
 * and keeps the browser's theme-color in step. While the theme changes, html[data-switching] holds color
 * transitions back for a frame (see globals.css), so the whole page changes at once instead of in a ripple.
 */
export const PREFS_BOOT = `(function(){
var d=document.documentElement;
function get(k){try{return localStorage.getItem(k)}catch(e){return null}}
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

/** The theme on screen: the saved choice, or the device's setting until there is one. */
export function readTheme(): Theme {
  return typeof document !== "undefined" && document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function applyTheme(t: Theme) {
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    // Private mode or storage disabled: applies for this visit only.
  }
  window.__hyperanchorTheme?.set(t);
}

export function readWeekStart(): WeekStart {
  try {
    return localStorage.getItem(WEEK_KEY) === "sunday" ? 0 : 1;
  } catch {
    return 1;
  }
}

export function saveWeekStart(w: WeekStart) {
  try {
    localStorage.setItem(WEEK_KEY, w === 0 ? "sunday" : "monday");
  } catch {
    // As above.
  }
}

const SORT_KEY = "hyperanchor:sort";
const SOUNDS_KEY = "hyperanchor:sounds";
const FOCUS_MINUTES_KEY = "hyperanchor:focus-minutes";

/** The order tasks are listed in (Settings): the person's own, newest first, or by name. */
export function readSort(): Sort {
  try {
    const s = JSON.parse(localStorage.getItem(SORT_KEY) ?? "null") as Sort | null;
    if (s && ["manual", "added", "title"].includes(s.key) && (s.dir === "asc" || s.dir === "desc")) return { key: s.key, dir: s.dir };
  } catch {
    // Nothing saved, or storage disabled.
  }
  return DEFAULT_SORT;
}

export function saveSort(s: Sort) {
  try {
    localStorage.setItem(SORT_KEY, JSON.stringify(s));
  } catch {
    // As above.
  }
}

/** Whether the app may make its small sounds (listening starts, tasks are ready, the focus timer ends). */
export function readSounds(): boolean {
  try {
    return localStorage.getItem(SOUNDS_KEY) !== "off";
  } catch {
    return true;
  }
}

export function saveSounds(on: boolean) {
  try {
    localStorage.setItem(SOUNDS_KEY, on ? "on" : "off");
  } catch {
    // As above.
  }
}

/** The lengths the focus timer offers, in minutes; the last one picked is remembered. */
export const FOCUS_MINUTES = [5, 10, 15, 25, 45, 60];

export function readFocusMinutes(): number {
  try {
    const n = Number(localStorage.getItem(FOCUS_MINUTES_KEY));
    if (FOCUS_MINUTES.includes(n)) return n;
  } catch {
    // As above.
  }
  return 25;
}

export function saveFocusMinutes(n: number) {
  try {
    localStorage.setItem(FOCUS_MINUTES_KEY, String(n));
  } catch {
    // As above.
  }
}
