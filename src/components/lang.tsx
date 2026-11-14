"use client";

import { useSyncExternalStore } from "react";
import { getLang, subscribeLang, type Lang } from "@/lib/i18n";

/** The language on this device; whatever reads it is drawn again when it changes. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribeLang, getLang, () => "en" as Lang);
}
