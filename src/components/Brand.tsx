import Link from "next/link";
import { LOGO_BOX, LOGO_SIGN_SCALE, SIGN_HEIGHT, SIGN_PATH, SIGN_WIDTH, WORD_PATH } from "./brandPaths";

// The logo is #111111 on light backgrounds and white on dark ones — no other colors, tiles, shadows or outlines.
const INK = "text-[#111111] dark:text-white";

/** The sign alone, "hy" in one band: `size` is its height in px (16 at the least). */
export function Mark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${SIGN_WIDTH} ${SIGN_HEIGHT}`}
      height={size}
      width={(size * SIGN_WIDTH) / SIGN_HEIGHT}
      fill="currentColor"
      aria-hidden="true"
      className={`flex-none ${INK} ${className}`}
    >
      <path d={SIGN_PATH} />
    </svg>
  );
}

/**
 * The logo: the sign and the name on one line, the sign on the left and as tall as the whole word (top of the h to
 * the tail of the p). `size` is that height in px — 20 at the least. Optionally a link home.
 */
export function Wordmark({ href, size = 21 }: { href?: string; size?: number }) {
  const logo = (
    <svg
      viewBox={`${LOGO_BOX.x} ${LOGO_BOX.y} ${LOGO_BOX.width} ${LOGO_BOX.height}`}
      height={size}
      width={(size * LOGO_BOX.width) / LOGO_BOX.height}
      fill="currentColor"
      role={href ? undefined : "img"}
      aria-label={href ? undefined : "Hyperanchor"}
      aria-hidden={href ? true : undefined}
      className={`block flex-none select-none ${INK}`}
    >
      <path transform={`translate(0 -727.5) scale(${LOGO_SIGN_SCALE})`} d={SIGN_PATH} />
      <path d={WORD_PATH} />
    </svg>
  );
  return href ? (
    <Link href={href} aria-label="Hyperanchor home" className="no-underline">
      {logo}
    </Link>
  ) : (
    logo
  );
}
