"use client";

import { useFormStatus } from "react-dom";
import { GoogleG } from "./icons";

/** "Continue with Google" in Google's dark button style (light style on dark backgrounds). */
export function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-12 items-center gap-3 rounded-full border border-[#8e918f] bg-[#131314] pr-6 pl-2 text-[15px] font-medium text-[#e3e3e3] transition-transform duration-150 active:scale-[0.98] disabled:cursor-wait disabled:opacity-80 dark:border-[#747775] dark:bg-white dark:text-[#1f1f1f]"
    >
      <span className="flex size-8 items-center justify-center rounded-full bg-white">
        <GoogleG size={17} />
      </span>
      <span>{pending ? <span className="shimmer-text">Signing in…</span> : "Continue with Google"}</span>
    </button>
  );
}
