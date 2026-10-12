"use client";

import { useFormStatus } from "react-dom";
import { GoogleG } from "./icons";

export function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-9 flex h-14 items-center gap-3 rounded-full bg-white pr-[26px] pl-2.5 text-[15px] font-medium text-ink shadow-google transition-shadow duration-200 hover:shadow-google-hover disabled:cursor-wait"
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-fill">
        <GoogleG />
      </span>
      <span>{pending ? "Signing in…" : "Continue with Google"}</span>
    </button>
  );
}
