import { Children, isValidElement } from "react";
import { SiteFooter, SiteHeader } from "./Site";

/** A legal document set plainly: title, effective date, numbered contents, then the numbered sections. */
export function LegalPage({ title, effective, children }: { title: string; effective: string; children: React.ReactNode }) {
  // The contents list comes from the sections themselves, so it can't drift from them.
  const sections = Children.toArray(children)
    .filter(isValidElement)
    .map((s) => s.props as { n: number; title: string });

  return (
    <div className="min-h-dvh overflow-x-clip">
      <SiteHeader />

      <main className="mx-auto max-w-[760px] px-5 pt-12 pb-20 md:pt-16">
        <h1 className="text-[30px] leading-[1.2] font-semibold tracking-[-0.02em] md:text-[34px]">{title}</h1>
        <p className="mt-2 text-[14px] text-ink-2">Effective {effective}</p>

        <nav aria-label="Contents" className="mt-8 border-y border-line py-5">
          <h2 className="text-[13px] font-semibold">Contents</h2>
          <ol className="mt-3 gap-x-8 text-[14px] sm:columns-2">
            {sections.map((s) => (
              <li key={s.n} className="mb-1.5 break-inside-avoid">
                <a href={`#section-${s.n}`} className="text-ink-2 no-underline hover:text-ink hover:underline">
                  <span className="tabular">{s.n}.</span> {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="mt-10 text-[15.5px] leading-[1.7] text-ink">{children}</article>
      </main>

      <SiteFooter />
    </div>
  );
}

export function LegalSection({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section id={`section-${n}`} className="scroll-mt-6 pt-9 first:pt-0">
      <h2 className="text-[17px] leading-7 font-semibold">
        <span className="tabular">{n}.</span> {title}
      </h2>
      <div className="mt-2 flex flex-col gap-3 text-pretty">{children}</div>
    </section>
  );
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-ink-3">{children}</ul>;
}

export function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold">{children}</strong>;
}
