"use client";

import { useFormStatus } from "react-dom";
import { GoogleG } from "./icons";

/** "Continue with Google" in Google's own button style (neutral light / dark theme, pill shape). */
export function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 items-center gap-3 rounded-full border border-[#747775] bg-white pr-5 pl-4 text-[15px] font-medium text-[#1f1f1f] shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-[background-color,box-shadow] duration-150 hover:bg-[#f8f9fa] hover:shadow-[0_1px_3px_rgba(0,0,0,0.15)] disabled:cursor-wait disabled:opacity-80 dark:border-[#8e918f] dark:bg-[#131314] dark:text-[#e3e3e3] dark:hover:bg-[#1f1f20]"
    >
      <GoogleG size={18} />
      <span>{pending ? "Signing in…" : "Continue with Google"}</span>
    </button>
  );
}
