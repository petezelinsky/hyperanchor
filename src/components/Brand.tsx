import Link from "next/link";

/** The logo is the name itself: a lowercase wordmark, optionally a link home. */
export function Wordmark({ href, size = 19 }: { href?: string; size?: number }) {
  const mark = (
    <span style={{ fontSize: size }} className="font-display leading-none font-semibold tracking-[-0.045em] whitespace-nowrap text-label select-none">
      hyperanchor
    </span>
  );
  return href ? (
    <Link href={href} aria-label="Hyperanchor home" className="no-underline">
      {mark}
    </Link>
  ) : (
    mark
  );
}
