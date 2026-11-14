import { createElement, Fragment, type ReactNode } from "react";
import { setDateLocale } from "./dates";
import { pl } from "./locales/pl";
import { ru } from "./locales/ru";

/**
 * The interface in three languages. The words in the code are the English ones, and they are the key as well: `tr("Add
 * task")` gives "Add task" in English and looks the same sentence up in the Russian or the Polish list (locales/ru.ts,
 * locales/pl.ts) otherwise; a sentence a list doesn't have stays English. So nothing has to be named twice, and the
 * code still reads as what it says. `node scripts/i18n-check.mjs` checks that every sentence in the code is in both
 * lists, with the same {placeholders}.
 *
 * - `tr("Good morning, {name}", { name })`: a sentence, with values put in.
 * - `trn(n, "{n} task", "{n} tasks")`: a count. English has two forms; Russian and Polish have three (1 задача,
 *   2 задачи, 5 задач), kept as a list of three under the singular sentence.
 * - `rich("Done {n} of {total}", { n: <b>3</b>, total })`: the same with pieces of the page put in.
 * - `m("Rising")`: only marks a sentence for the lists, where it is kept as data and translated when shown.
 * - `tr("Open|action")`: a note after a bar tells two meanings of one English word apart; it is never shown.
 *
 * Which language: chosen in Settings and kept on this device. Dates follow it (dates.ts); so do numbers. The app
 * itself is drawn in the browser only, so the choice is known before anything is on screen; the pages the server
 * draws (sign-in, the legal pages) stay in English.
 */
export type Lang = "en" | "ru" | "pl";
export const LANGS: { code: Lang; name: string }[] = [
  { code: "en", name: "English" },
  { code: "ru", name: "Русский" },
  { code: "pl", name: "Polski" },
];
export const isLang = (v: unknown): v is Lang => v === "en" || v === "ru" || v === "pl";

/** A sentence in another language; for a count, its three forms: one, a few, many (1 задача, 2 задачи, 5 задач). */
export type Entry = string | readonly [one: string, few: string, many: string];
export type Dict = Readonly<Record<string, Entry>>;
export type Vars = Record<string, string | number>;

const DICTS: Record<Lang, Dict | null> = { en: null, ru, pl };
const TAGS: Record<Lang, string> = { en: "en-US", ru: "ru-RU", pl: "pl-PL" };
const STORE_KEY = "hyperanchor:lang";

const numbers = new Map<Lang, Intl.NumberFormat>();
const rules = new Map<Lang, Intl.PluralRules>();
const format = (lang: Lang, n: number) => {
  let f = numbers.get(lang);
  if (!f) numbers.set(lang, (f = new Intl.NumberFormat(TAGS[lang])));
  return f.format(n);
};
const fill = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (whole, k: string) => (k in vars ? String(vars[k]) : whole)) : s);

/** A sentence without its note: "Open|action" → "Open" (the note tells two meanings of one English word apart). */
const bare = (text: string) => text.replace(/\|[\w-]+$/, "");

/** The sentence in `lang` (unfilled). */
function word(lang: Lang, text: string) {
  const e = DICTS[lang]?.[text];
  return typeof e === "string" ? e : bare(text);
}
/** The form of a counted sentence that suits `n`. */
function counted(lang: Lang, n: number, one: string, other: string) {
  const e = DICTS[lang]?.[one];
  if (!e) return bare(n === 1 ? one : other);
  if (typeof e === "string") return e;
  let r = rules.get(lang);
  if (!r) rules.set(lang, (r = new Intl.PluralRules(TAGS[lang])));
  const form = r.select(n);
  // A fraction ("3.5 задачи") takes the form for a few.
  return form === "one" ? e[0] : form === "many" ? e[2] : e[1];
}

// ── The language on this device ──

let current: Lang = "en";
const listeners = new Set<() => void>();

export const getLang = () => current;
export function subscribeLang(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function apply(lang: Lang) {
  current = lang;
  setDateLocale(lang);
  if (typeof document !== "undefined") document.documentElement.lang = lang;
}

/** Reads the language kept on this device. Called once, as the app's code loads, before anything is drawn. */
export function initLang() {
  if (typeof window === "undefined") return;
  try {
    const kept = localStorage.getItem(STORE_KEY);
    if (isLang(kept)) apply(kept);
  } catch {}
}

/** Changes the language everywhere at once, and keeps the choice. */
export function setLang(lang: Lang) {
  apply(lang);
  try {
    localStorage.setItem(STORE_KEY, lang);
  } catch {}
  listeners.forEach((fn) => fn());
}

export const tr = (text: string, vars?: Vars) => fill(word(current, text), vars);
export const trn = (n: number, one: string, other: string, vars?: Vars) => fill(counted(current, n, one, other), { n: format(current, n), ...vars });
/** A number the way the language writes it: 10,000 / 10 000. */
export const num = (n: number) => format(current, n);
/** Marks a sentence kept as data (a list of options, a label worked out elsewhere); `tr` translates it when shown. */
export const m = (text: string) => text;

/** A sentence with pieces of the page in it: `rich("{n} more and it’s a typical day", { n: <b>2</b> })`. */
export function rich(text: string, parts: Record<string, ReactNode>): ReactNode[] {
  return word(current, text)
    .split(/(\{\w+\})/)
    .filter(Boolean)
    .map((piece, i) => {
      const key = /^\{(\w+)\}$/.exec(piece)?.[1];
      return key && key in parts ? createElement(Fragment, { key: i }, parts[key]) : piece;
    });
}
