"use client";

import { useFormStatus } from "react-dom";
import { GoogleG } from "./icons";

/** "Continue with Google": a glossy ink capsule; Google's mark keeps its colors on a white disc. */
export function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="ink inline-flex h-[52px] items-center gap-3 rounded-full pr-6 pl-2 text-[15.5px] font-medium transition-[filter,transform] duration-200 ease-glass hover:brightness-[1.35] active:scale-[0.98] disabled:cursor-wait disabled:opacity-80 dark:hover:brightness-[0.92]"
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.14),0_1px_2px_rgba(0,0,0,0.2)]">
        <GoogleG size={18} />
      </span>
      <span>{pending ? "Signing in…" : "Continue with Google"}</span>
    </button>
  );
}
