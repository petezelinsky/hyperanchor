import Link from "next/link";
import { ChevronLeft } from "./icons";
import { SiteFooter, SiteHeader } from "./Site";

export function LegalPage({ title, effective, children }: { title: string; effective: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh overflow-x-clip">
      <SiteHeader>
        <Link href="/" className="flex h-9 items-center gap-1 rounded-[10px] bg-surface pr-3.5 pl-2.5 text-[13px] font-medium no-underline shadow-lift transition-colors hover:bg-surface-2">
          <ChevronLeft size={14} strokeWidth={2} />
          Back
        </Link>
      </SiteHeader>

      <main>
        <div className="mx-auto max-w-[720px] animate-rise px-5 pt-14 pb-20 md:pt-20">
          <p className="text-[13px] font-semibold text-accent-ink">Legal</p>
          <h1 className="mt-3 font-display text-[40px] leading-[1.06] font-bold tracking-[-0.035em] md:text-[52px]">{title}</h1>
          <p className="mt-3 text-[15px] text-ink-2">Effective {effective}</p>
          <article className="mt-10 border-t border-line text-[16px] leading-[1.7] text-ink">{children}</article>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

export function LegalSection({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-line py-8 text-pretty last:border-0">
      <h2 className="flex items-baseline gap-3 text-[20px] leading-7 font-semibold tracking-[-0.015em]">
        <span className="tabular text-[15px] font-medium text-accent-ink">{String(n).padStart(2, "0")}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-ink-4">{children}</ul>;
}

export function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}
