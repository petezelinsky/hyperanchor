import Link from "next/link";
import { Wordmark } from "./Brand";

/** Top bar for public pages (landing, legal): frosted, sticky. */
export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="glass sticky top-0 z-40 shadow-[0_1px_0_var(--line)]">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-4 px-5">
        <Wordmark href="/" size={20} />
        {children}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-8 text-[12.5px] text-ink-3">
        <span className="flex items-center gap-3">
          <Wordmark size={15} />
          <span>© 2026</span>
        </span>
        <nav className="flex gap-5">
          <Link href="/privacy" className="no-underline hover:text-ink">
            Privacy Policy
          </Link>
          <Link href="/terms" className="no-underline hover:text-ink">
            Terms of Service
          </Link>
        </nav>
      </div>
    </footer>
  );
}
