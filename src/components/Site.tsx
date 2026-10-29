import Link from "next/link";
import { Wordmark } from "./Brand";
import { ThemeSwitch } from "./ThemeSwitch";

/** Top bar for the legal pages: plain, with a way back. */
export function SiteHeader() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-14 max-w-[760px] items-center justify-between gap-4 px-5">
        <Wordmark href="/" size={18} />
        <Link href="/" className="text-[13.5px] text-ink-2 no-underline transition-colors hover:text-ink pointer-coarse:-my-2.5 pointer-coarse:py-2.5">
          Back to Hyperanchor
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[760px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-6 text-[12.5px] text-ink-2">
        <span>© 2026 Hyperanchor</span>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <nav aria-label="Legal" className="flex gap-5">
            <Link href="/privacy" className="no-underline hover:underline pointer-coarse:-my-2.5 pointer-coarse:py-2.5">
              Privacy
            </Link>
            <Link href="/terms" className="no-underline hover:underline pointer-coarse:-my-2.5 pointer-coarse:py-2.5">
              Terms
            </Link>
          </nav>
          <ThemeSwitch />
        </div>
      </div>
    </footer>
  );
}
