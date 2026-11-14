import { getLang } from "@/lib/i18n";
import { fmt1 as plain } from "@/lib/stats";

export { pct } from "@/lib/stats";

/** A number to one decimal the way the language on screen writes it: 3.5, or 3,5 in Russian and Polish. */
export const fmt1 = (n: number) => (getLang() === "en" ? plain(n) : plain(n).replace(".", ","));
