import Link from "next/link";
import { SiteFooter, SiteHeader } from "./Site";

export function LegalPage({ title, effective, children }: { title: string; effective: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper">
      <SiteHeader>
        <Link href="/" className="h-9 rounded-[10px] px-3 text-[13.5px] leading-9 text-muted transition-colors hover:bg-fill hover:text-ink">
          Back to Hyperanchor
        </Link>
      </SiteHeader>

      <main className="mx-auto max-w-[760px] px-5 pt-14 pb-24 md:pt-24">
        <div className="mono-label">Legal · Effective {effective}</div>
        <h1 className="mt-5 text-[40px] leading-[1.05] font-medium tracking-[-0.04em] md:text-[56px]">{title}</h1>
        <article className="mt-12 text-[15.5px] leading-[1.7] text-ink-2 [&_a]:text-ink [&_a]:underline [&_a]:decoration-ghost [&_a]:underline-offset-[3px] hover:[&_a]:decoration-ink">
          {children}
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}

export function LegalSection({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 border-t border-line py-8 text-pretty md:grid-cols-[64px_minmax(0,1fr)] md:gap-6">
      <span className="tabular pt-1 font-mono text-[11px] text-faint">{String(n).padStart(2, "0")}</span>
      <div className="flex flex-col gap-3">
        <h2 className="text-[19px] leading-snug font-medium tracking-[-0.015em] text-ink">{title}</h2>
        {children}
      </div>
    </section>
  );
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-ghost">{children}</ul>;
}

export function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-medium text-ink">{children}</strong>;
}
