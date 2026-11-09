import Link from "next/link";

/** The app icon in small: an "h" on a rounded square (primary colors, so it inverts in dark mode). */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="flex-none">
      <rect width="64" height="64" rx="16" className="fill-primary" />
      <path
        d="M22.25 15v34M22.25 33.5c0-6 4.4-10 10-10s9.5 4 9.5 10V49"
        fill="none"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-on-primary"
      />
    </svg>
  );
}

/** The logo: the mark and the lowercase name, optionally a link home. */
export function Wordmark({ href, size = 19 }: { href?: string; size?: number }) {
  const logo = (
    <span className="inline-flex items-center gap-[0.42em] select-none" style={{ fontSize: size }}>
      <Mark size={Math.round(size * 1.16)} />
      <span className="font-display leading-none font-semibold tracking-[-0.045em] whitespace-nowrap text-ink">hyperanchor</span>
    </span>
  );
  return href ? (
    <Link href={href} aria-label="Hyperanchor home" className="no-underline">
      {logo}
    </Link>
  ) : (
    logo
  );
}
