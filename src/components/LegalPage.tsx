import Link from "next/link";
import { LogoPill } from "./Logo";

export function LegalPage({ title, effective, children }: { title: string; effective: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-[rgba(237,237,235,0.94)] px-4 py-4 sm:px-6">
        <LogoPill href="/" />
        <Link
          href="/"
          className="mono flex h-10 items-center gap-2 rounded-full bg-white/60 px-[18px] text-xs text-ink no-underline transition-colors duration-150 hover:bg-white hover:text-ink"
        >
          <span>←</span>
          <span>Back</span>
        </Link>
      </header>

      <main className="mx-auto max-w-[760px] px-4 pt-6 pb-[72px] sm:px-6">
        <div className="px-2 pt-6 pb-9">
          <div className="mono text-[11px] text-muted-2">Legal</div>
          <h1 className="mt-3 text-[clamp(36px,5vw,56px)] leading-[1.04] font-medium tracking-[-0.035em]">{title}</h1>
          <p className="mt-3 text-sm text-muted">Effective {effective}</p>
        </div>

        <article className="flex flex-col gap-9 rounded-[36px] bg-white/60 p-6 text-[15px] leading-[1.6] text-ink-2 shadow-card sm:p-10">
          {children}
        </article>

        <div className="mono flex flex-wrap justify-between gap-4 px-2 pt-7 text-[11px] text-muted-2">
          <span>© 2026 Hyperanchor</span>
          <Link href="/" className="text-muted-2">
            Back to app
          </Link>
        </div>
      </main>
    </div>
  );
}

export function LegalSection({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 text-pretty">
      <div className="font-mono text-[11px] tracking-[0.08em] text-muted-2">{String(n).padStart(2, "0")}</div>
      <h2 className="text-[22px] leading-[1.2] font-medium tracking-[-0.02em] text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return <ul className="flex list-disc flex-col gap-2 pl-5">{children}</ul>;
}

export function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-medium text-ink">{children}</strong>;
}
