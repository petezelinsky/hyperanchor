"use client";

import { useState } from "react";

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((p) => p[0]).join("") || "?").toUpperCase();
}

/** Google profile photo with an initials fallback. */
export function Avatar({ name, image, size }: { name: string; image: string | null; size: number }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (image && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        style={style}
        className="flex-none rounded-full bg-surface-3 object-cover"
      />
    );
  }
  return (
    <span
      style={style}
      className="flex flex-none items-center justify-center rounded-full bg-gradient-to-br from-[#8b7cf6] to-[#5b5bd6] font-semibold text-white"
    >
      {initials(name)}
    </span>
  );
}
