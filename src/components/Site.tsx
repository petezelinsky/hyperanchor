import Link from "next/link";
import { Brand } from "./AppIcon";

/** Top bar for public pages (landing, legal). */
export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="material sticky top-0 z-20 border-b border-separator bg-toolbar">
      <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between gap-4 px-5">
        <Brand href="/" size={26} />
        {children}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-separator">
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-7 text-[12.5px] text-label-3">
        <span>© 2026 Hyperanchor</span>
        <nav className="flex gap-5">
          <Link href="/privacy" className="text-label-2">
            Privacy Policy
          </Link>
          <Link href="/terms" className="text-label-2">
            Terms of Service
          </Link>
        </nav>
      </div>
    </footer>
  );
}
