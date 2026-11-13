import Link from "next/link";

/**
 * The name, set as text: "hyperanchor", lowercase, in the interface's own face, ink on paper (white on dark). It stands
 * wherever the logo stood. `size` is its font size in px. Optionally a link home.
 */
export function Wordmark({ href, size = 17, className = "" }: { href?: string; size?: number; className?: string }) {
  const name = (
    <span
      style={{ fontSize: size, letterSpacing: "-0.035em" }}
      className={`block leading-none font-semibold whitespace-nowrap text-ink select-none ${className}`}
      aria-label={href ? undefined : "Hyperanchor"}
    >
      hyperanchor
    </span>
  );
  return href ? (
    <Link href={href} aria-label="Hyperanchor home" className="no-underline">
      {name}
    </Link>
  ) : (
    name
  );
}
