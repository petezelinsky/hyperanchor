import Link from "next/link";

/** The app icon: a blue rounded square with the anchor-point mark (matches src/app/icon.svg). */
export function AppIcon({ size = 24, className = "" }: { size?: number; className?: string }) {
  // CSS gradient instead of an SVG <linearGradient>: duplicate SVG ids break when the first icon is hidden.
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, borderRadius: size * 0.22, background: "linear-gradient(#3d9bff, #0060df)" }}
      className={`flex flex-none items-center justify-center shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.12)] ${className}`}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="14.5" fill="none" stroke="#fff" strokeWidth="5" />
        <circle cx="20" cy="20" r="5" fill="#fff" />
      </svg>
    </span>
  );
}

/** Icon + wordmark, optionally a link. */
export function Brand({ href, size = 24, className = "" }: { href?: string; size?: number; className?: string }) {
  const content = (
    <>
      <AppIcon size={size} />
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-label">Hyperanchor</span>
    </>
  );
  const cls = `flex items-center gap-2.5 ${className}`;
  return href ? (
    <Link href={href} className={`${cls} hover:no-underline`}>
      {content}
    </Link>
  ) : (
    <div className={cls}>{content}</div>
  );
}
