import Link from "next/link";

export function LogoMark() {
  return (
    <span className="flex size-3.5 flex-none items-center justify-center rounded-full border-[1.5px] border-ink">
      <span className="size-1 rounded-full bg-ink" />
    </span>
  );
}

const pill = "mono flex h-10 items-center gap-2.5 rounded-full bg-white/60 px-4 text-xs text-ink no-underline";

export function LogoPill({ href, compact = false }: { href?: string; compact?: boolean }) {
  const content = (
    <>
      <LogoMark />
      <span className={compact ? "max-sm:hidden" : undefined}>Hyperanchor</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={`${pill} hover:text-ink`} aria-label="Hyperanchor">
        {content}
      </Link>
    );
  }
  return <div className={pill}>{content}</div>;
}
