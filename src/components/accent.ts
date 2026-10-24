export type Accent = "orange" | "blue" | "green";

export const ACCENTS: { value: Accent; label: string; swatch: string }[] = [
  { value: "orange", label: "Orange", swatch: "#f4511e" },
  { value: "blue", label: "Blue", swatch: "#2563eb" },
  { value: "green", label: "Green", swatch: "#16a34a" },
];

const KEY = "accent";

/** Runs in <head> before the first paint so a saved accent never flashes the default. */
export const ACCENT_BOOT = `try{var a=localStorage.getItem("${KEY}");if(a==="blue"||a==="green")document.documentElement.dataset.accent=a}catch(e){}`;

export function readAccent(): Accent {
  const a = typeof document === "undefined" ? undefined : document.documentElement.dataset.accent;
  return a === "blue" || a === "green" ? a : "orange";
}

export function applyAccent(a: Accent) {
  if (a === "orange") delete document.documentElement.dataset.accent;
  else document.documentElement.dataset.accent = a;
  try {
    localStorage.setItem(KEY, a);
  } catch {
    // Private mode or storage disabled: the choice lasts until reload.
  }
}
