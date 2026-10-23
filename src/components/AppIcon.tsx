import Link from "next/link";

/** The mark: an ink square, a white ring and the signal-colored anchor point (matches src/app/icon.svg). */
export function AppIcon({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, borderRadius: size * 0.26 }}
      className={`flex flex-none items-center justify-center bg-[#0a0a0a] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] dark:bg-[#1c1c1c] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] ${className}`}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="14.5" fill="none" stroke="#fff" strokeWidth="4.5" />
        <circle cx="20" cy="20" r="5.5" fill="#ff5a1f" />
      </svg>
    </span>
  );
}

/** Mark + lowercase wordmark, optionally a link. */
export function Brand({ href, size = 22, className = "" }: { href?: string; size?: number; className?: string }) {
  const content = (
    <>
      <AppIcon size={size} />
      <span className="text-[17px] leading-none font-semibold tracking-[-0.035em] text-ink">hyperanchor</span>
    </>
  );
  const cls = `flex items-center gap-2.5 ${className}`;
  return href ? (
    <Link href={href} className={cls}>
      {content}
    </Link>
  ) : (
    <div className={cls}>{content}</div>
  );
}
