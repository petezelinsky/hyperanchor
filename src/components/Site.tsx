import Link from "next/link";
import { Brand } from "./AppIcon";

/** Top bar for public pages (landing, legal). */
export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1040px] items-center justify-between gap-4 px-5">
        <Brand href="/" size={22} />
        {children}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1040px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-8">
        <span className="mono-label">© 2026 Hyperanchor</span>
        <nav className="flex gap-6 text-[13px] text-muted">
          <Link href="/privacy" className="transition-colors hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-ink">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
