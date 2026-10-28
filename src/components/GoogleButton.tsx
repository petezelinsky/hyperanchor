"use client";

import { useFormStatus } from "react-dom";
import { GoogleG } from "./icons";

/** "Continue with Google": a full-width button in the primary color (black, or white in dark mode) with Google's mark. */
export function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-12 w-full items-center justify-center gap-2.5 rounded-[12px] bg-primary text-[15px] font-medium text-on-primary transition-[background-color,transform] duration-150 ease-out hover:bg-primary-hover active:scale-[0.985] disabled:cursor-wait disabled:opacity-80"
    >
      <GoogleG size={18} />
      {pending ? "Signing in…" : "Continue with Google"}
    </button>
  );
}
