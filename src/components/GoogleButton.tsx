"use client";

import { useFormStatus } from "react-dom";
import { GoogleG } from "./icons";

/** "Continue with Google": the accent button (or white, on dark panels); Google's mark keeps its colors on a white tile. */
export function GoogleButton({ variant = "accent" }: { variant?: "accent" | "light" }) {
  const { pending } = useFormStatus();
  const look =
    variant === "accent"
      ? "bg-accent text-on-accent shadow-accent hover:bg-accent-hover"
      : "bg-white text-[#17171c] shadow-[0_10px_30px_-10px_rgba(255,255,255,0.45)] hover:bg-white/90";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex h-[52px] items-center gap-3 rounded-[14px] pr-6 pl-2 text-[15.5px] font-semibold transition-[background-color,transform] duration-150 ease-out active:scale-[0.98] disabled:cursor-wait disabled:opacity-80 ${look}`}
    >
      <span className="flex size-9 items-center justify-center rounded-[10px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
        <GoogleG size={18} />
      </span>
      <span>{pending ? "Signing in…" : "Continue with Google"}</span>
    </button>
  );
}
