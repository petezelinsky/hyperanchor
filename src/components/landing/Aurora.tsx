/** Soft color drifting slowly behind a section; fades out toward the bottom. */
export function Aurora({ className = "" }: { className?: string }) {
  const blob = "absolute rounded-full will-change-transform";
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`}>
      <div
        className={`${blob} -top-[28%] left-[6%] size-[min(720px,95vw)] opacity-55 dark:opacity-35`}
        style={{ background: "radial-gradient(closest-side, #a78bfa, transparent)", animation: "aurora-a 20s ease-in-out infinite" }}
      />
      <div
        className={`${blob} -top-[20%] right-[2%] size-[min(640px,85vw)] opacity-40 dark:opacity-30`}
        style={{ background: "radial-gradient(closest-side, #f472b6, transparent)", animation: "aurora-b 24s ease-in-out infinite" }}
      />
      <div
        className={`${blob} top-[18%] left-[28%] size-[min(560px,75vw)] opacity-35 dark:opacity-25`}
        style={{ background: "radial-gradient(closest-side, #fdba74, transparent)", animation: "aurora-c 22s ease-in-out infinite" }}
      />
      <div
        className={`${blob} top-[2%] left-[52%] size-[min(520px,70vw)] opacity-35 dark:opacity-25`}
        style={{ background: "radial-gradient(closest-side, #7dd3fc, transparent)", animation: "aurora-a 26s ease-in-out infinite reverse" }}
      />
    </div>
  );
}
