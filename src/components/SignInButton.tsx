"use client";

import { useFormStatus } from "react-dom";
import { AppleLogo, GoogleG } from "./icons";

const LABELS = { google: "Continue with Google", apple: "Continue with Apple" };

/**
 * "Continue with Google / Apple": a full-width button in the primary color (black, or white in dark mode) with the
 * provider's mark. Google's mark keeps its colors; Apple's logo takes the text color, as Apple's guidelines ask.
 */
export function SignInButton({ provider }: { provider: "google" | "apple" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-12 w-full items-center justify-center gap-2.5 rounded-[12px] bg-primary text-[15px] font-medium text-on-primary transition-[background-color,transform] duration-150 ease-out hover:bg-primary-hover active:scale-[0.985] disabled:cursor-wait disabled:opacity-80"
    >
      {provider === "google" ? <GoogleG size={18} /> : <AppleLogo size={19} />}
      {pending ? "Signing in…" : LABELS[provider]}
    </button>
  );
}
