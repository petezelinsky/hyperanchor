import Link from "next/link";
import { ChevronLeft } from "./icons";
import { SiteFooter, SiteHeader } from "./Site";

export function LegalPage({ title, effective, children }: { title: string; effective: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <SiteHeader>
        <Link href="/" className="control flex h-10 items-center gap-1 rounded-full pr-4 pl-3 text-[13px] font-medium no-underline transition-colors hover:bg-control-hover">
          <ChevronLeft size={14} strokeWidth={2} />
          Back
        </Link>
      </SiteHeader>

      <main className="mx-auto max-w-[800px] px-3 pt-8 pb-14 md:pt-14">
        <div className="glass-sheet rim relative animate-rise rounded-[32px] px-6 py-10 md:px-14 md:py-14">
          <p className="text-[11.5px] font-semibold tracking-[0.08em] text-label-3 uppercase">Legal</p>
          <h1 className="mt-3 font-display text-[36px] leading-[1.08] font-bold tracking-[-0.035em] md:text-[48px]">{title}</h1>
          <p className="mt-3 text-[15px] text-label-2">Effective {effective}</p>
          <article className="mt-10 border-t border-separator text-[16px] leading-[1.65] text-label">{children}</article>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

export function LegalSection({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-separator py-8 text-pretty last:border-0">
      <h2 className="flex items-baseline gap-3 text-[20px] leading-7 font-semibold tracking-[-0.015em]">
        <span className="tabular text-[15px] font-medium text-label-3">{String(n).padStart(2, "0")}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-label-3">{children}</ul>;
}

export function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-label">{children}</strong>;
}
