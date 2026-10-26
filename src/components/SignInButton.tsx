"use client";

import { useFormStatus } from "react-dom";
import { AppleLogo, GoogleG } from "./icons";

const LABELS = { google: "Continue with Google", apple: "Continue with Apple" };

/**
 * "Continue with Google / Apple": the primary button (or white, on dark panels). Google's mark keeps its
 * colors on a white tile; Apple's logo takes the text color, as Apple's guidelines ask.
 */
export function SignInButton({ provider, variant = "primary" }: { provider: "google" | "apple"; variant?: "primary" | "light" }) {
  const { pending } = useFormStatus();
  const look =
    variant === "primary"
      ? "bg-primary text-on-primary shadow-[0_1px_2px_rgba(0,0,0,0.16),0_10px_28px_-12px_rgba(0,0,0,0.45)] hover:bg-primary-hover"
      : "bg-white text-[#171717] hover:bg-white/90";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex h-[52px] w-[264px] items-center gap-3 rounded-[14px] pr-6 pl-2 text-[15.5px] font-semibold transition-[background-color,transform] duration-150 ease-out active:scale-[0.98] disabled:cursor-wait disabled:opacity-80 ${look}`}
    >
      {provider === "google" ? (
        <span className="flex size-9 items-center justify-center rounded-[10px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
          <GoogleG size={18} />
        </span>
      ) : (
        <span className="flex size-9 items-center justify-center">
          <AppleLogo size={19} />
        </span>
      )}
      <span>{pending ? "Signing in…" : LABELS[provider]}</span>
    </button>
  );
}
