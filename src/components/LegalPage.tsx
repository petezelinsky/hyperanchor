import Link from "next/link";
import { SiteFooter, SiteHeader } from "./Site";

export function LegalPage({ title, effective, children }: { title: string; effective: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-window">
      <SiteHeader>
        <Link href="/" className="text-[13px] font-medium">
          Back to Hyperanchor
        </Link>
      </SiteHeader>

      <main className="mx-auto max-w-[720px] px-5 pt-14 pb-20 md:pt-20">
        <p className="text-[13px] font-semibold text-label-2">Legal</p>
        <h1 className="mt-2 font-display text-[36px] leading-[1.1] font-bold tracking-[-0.03em] md:text-[44px]">{title}</h1>
        <p className="mt-3 text-[15px] text-label-2">Effective {effective}</p>
        <article className="mt-10 border-t border-separator text-[16px] leading-[1.65] text-label">{children}</article>
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
