import Link from "next/link";
import { Wordmark } from "./Brand";

/** Top bar for public pages (landing, legal): a floating glass capsule. */
export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-3 z-30 px-3">
      <div className="glass rim relative mx-auto flex h-14 max-w-[1080px] items-center justify-between gap-4 rounded-full pr-2 pl-6">
        <Wordmark href="/" size={20} />
        {children}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto max-w-[1080px] px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-separator py-8 text-[12.5px] text-label-3">
        <span>© 2026 Hyperanchor</span>
        <nav className="flex gap-5">
          <Link href="/privacy" className="text-label-2 no-underline hover:text-label">
            Privacy Policy
          </Link>
          <Link href="/terms" className="text-label-2 no-underline hover:text-label">
            Terms of Service
          </Link>
        </nav>
      </div>
    </footer>
  );
}
