"use client";

import { useState } from "react";

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((p) => p[0]).join("") || "?").toUpperCase();
}

export function Avatar({ name, image, size, className = "" }: { name: string; image: string | null; size: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  if (image && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        style={style}
        className={`flex-none rounded-full bg-avatar object-cover ${className}`}
      />
    );
  }
  return (
    <span style={style} className={`flex flex-none items-center justify-center rounded-full bg-avatar font-sans font-semibold tracking-normal ${className}`}>
      {initials(name)}
    </span>
  );
}
