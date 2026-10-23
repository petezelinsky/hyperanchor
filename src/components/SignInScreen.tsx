import Link from "next/link";
import { signInWithGoogle } from "@/app/actions";
import { GoogleButton } from "./GoogleButton";
import { FlameIcon } from "./icons";
import { Aurora } from "./landing/Aurora";
import { HeroCard } from "./landing/HeroCard";
import { Reveal } from "./landing/Reveal";
import { RotatingWord } from "./landing/RotatingWord";
import { KeysVisual, ProgressVisual, TypingVisual, WeekVisual } from "./landing/visuals";
import { SiteFooter, SiteHeader } from "./Site";

const FEATURES = [
  {
    title: "Capture in a blink",
    text: "Press N anywhere, type, hit Enter. Tasks land right where you are — no forms, no fuss.",
    visual: <TypingVisual />,
    tint: "from-[#efeefe] to-[#f7f3ff] dark:from-[#1c1c3a] dark:to-[#22193a]",
  },
  {
    title: "Your week at a glance",
    text: "Every day of the week side by side. Move anything to tomorrow or next week in a click.",
    visual: <WeekVisual />,
    tint: "from-[#fff3e8] to-[#fff9f1] dark:from-[#2a1d12] dark:to-[#272014]",
  },
  {
    title: "Progress you can feel",
    text: "Completion rate, streaks and your strongest days — clear numbers that keep you going, and stay private.",
    visual: <ProgressVisual />,
    tint: "from-[#eaf7f0] to-[#f3fbf6] dark:from-[#112a1e] dark:to-[#132620]",
  },
  {
    title: "Fast by design",
    text: "Keyboard shortcuts for everything and undo for every action. It stays out of your way.",
    visual: <KeysVisual />,
    tint: "from-[#fdeef4] to-[#fff5f9] dark:from-[#2d1424] dark:to-[#2a1925]",
  },
];

export function SignInScreen({ error }: { error?: boolean }) {
  return (
    <div className="min-h-dvh overflow-x-clip">
      {/* Without JavaScript nothing would reveal on scroll, so show everything. */}
      <noscript>
        <style>{"[data-reveal]{opacity:1;transform:none}"}</style>
      </noscript>
      <SiteHeader>
        <form action={signInWithGoogle}>
          <button type="submit" className="h-9 rounded-[10px] bg-surface px-4 text-[13.5px] font-medium shadow-lift transition-colors hover:bg-surface-2">
            Sign in
          </button>
        </form>
      </SiteHeader>

      <main>
        <section className="relative isolate">
          <Aurora className="[mask-image:linear-gradient(to_bottom,#000_40%,transparent_88%)]" />
          <div className="mx-auto max-w-[1100px] px-5 pt-14 text-center md:pt-24">
            <span className="inline-flex animate-rise items-center gap-2 rounded-full bg-surface/80 px-3 py-1 text-[12.5px] font-medium text-ink-2 shadow-lift">
              <span className="size-2 rounded-full bg-green" style={{ animation: "pulse-dot 2.4s ease-out infinite" }} />
              Free · Private · Keyboard-first
            </span>
            <h1 className="mx-auto mt-6 font-display text-[54px] leading-[1.02] font-bold tracking-[-0.045em] md:text-[100px]">
              <span className="sr-only">Own your day, week and month.</span>
              <span aria-hidden="true" className="block animate-rise">
                Own your
              </span>
              <RotatingWord words={["day.", "week.", "month."]} />
            </h1>
            <p className="mx-auto mt-6 max-w-[580px] animate-rise text-[17px] leading-relaxed text-pretty text-ink-2 [animation-delay:80ms] md:text-[19px]">
              Hyperanchor is a calm, fast planner. Capture tasks in a blink, see your week at a glance, and watch your progress grow.
            </p>
            <form action={signInWithGoogle} className="mt-9 flex animate-rise justify-center [animation-delay:140ms]">
              <GoogleButton />
            </form>
            {error && (
              <p role="alert" className="mx-auto mt-4 w-fit rounded-[10px] bg-red-soft px-3 py-1.5 text-[13px] font-medium text-red-ink">
                Sign-in didn’t work. Please try again.
              </p>
            )}
            <p className="mt-4 text-[12.5px] text-ink-3">
              Free forever. By continuing, you agree to the <Link href="/terms">Terms of Service</Link> and{" "}
              <span className="whitespace-nowrap">
                <Link href="/privacy">Privacy Policy</Link>.
              </span>
            </p>
          </div>

          <div className="relative mx-auto mt-12 flex max-w-[1040px] justify-center px-4 pb-20 md:mt-16 md:pb-28">
            <div inert className="relative w-full max-w-[420px] animate-rise [animation-delay:200ms]">
              <HeroCard />
            </div>
            <Chips />
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-4 py-16 md:py-24">
          <Reveal className="mx-auto max-w-[640px] text-center">
            <p className="text-[13px] font-semibold text-accent-ink">Why Hyperanchor</p>
            <h2 className="mt-3 font-display text-[34px] leading-[1.1] font-bold tracking-[-0.035em] text-balance md:text-[52px]">Planning that feels light.</h2>
            <p className="mt-4 text-[16px] leading-relaxed text-pretty text-ink-2 md:text-[18px]">
              Day, week and month views in one calm flow — plus the small details that make it a joy to come back to.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 2) * 90} className="rounded-[24px] bg-surface-2 p-3 pb-6 shadow-[inset_0_0_0_1px_var(--line)] md:p-4 md:pb-8">
                <div inert className={`h-[220px] overflow-hidden rounded-[18px] bg-gradient-to-br ${f.tint}`}>
                  {f.visual}
                </div>
                <h3 className="mt-6 px-3 text-[19px] font-semibold tracking-[-0.015em] md:px-4">{f.title}</h3>
                <p className="mt-2 px-3 text-[15px] leading-relaxed text-ink-2 md:px-4">{f.text}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="px-4 pb-20 md:pb-28">
          <Reveal className="relative isolate mx-auto max-w-[1120px] overflow-hidden rounded-[28px] bg-[#14142b] px-6 py-16 text-center md:py-24 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]">
            <Aurora className="opacity-90" />
            <h2 className="font-display text-[38px] leading-[1.06] font-bold tracking-[-0.035em] text-white md:text-[60px]">
              Make this week
              <br />
              your best one.
            </h2>
            <p className="mt-4 text-[16px] text-white/70 md:text-[18px]">Free, and it takes ten seconds to start.</p>
            <form action={signInWithGoogle} className="mt-9 flex justify-center">
              <GoogleButton variant="light" />
            </form>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

/** Small cards floating around the hero list (wide screens only). */
function Chips() {
  const chip = "absolute hidden items-center gap-2.5 rounded-[14px] bg-surface px-3.5 py-2.5 text-[13px] shadow-float lg:flex";
  const week = ["done", "done", "late", "done", "today", "", ""];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className={`${chip} top-[8%] left-[1%]`} style={{ animation: "float-y 6s ease-in-out infinite" }}>
        <span className="flex size-8 items-center justify-center rounded-[10px] bg-[#fff1e6] text-orange dark:bg-[#2b1a0e]">
          <FlameIcon size={17} />
        </span>
        <span>
          <span className="block leading-4 font-semibold">12-day streak</span>
          <span className="block text-[11.5px] text-ink-3">Keep it going</span>
        </span>
      </div>

      <div className={`${chip} top-[3%] right-0 flex-col !items-stretch`} style={{ animation: "float-y 7s 1s ease-in-out infinite" }}>
        <span className="flex items-center justify-between gap-8">
          <span className="text-[12px] font-medium text-ink-2">This week</span>
          <span className="rounded-full bg-green-soft px-1.5 text-[11px] font-semibold text-green-ink">▲ 18%</span>
        </span>
        <span className="flex h-12 items-end gap-1">
          {[3, 5, 2, 6, 4, 7, 5].map((v, i) => (
            <span
              key={i}
              className={`w-2.5 origin-bottom rounded-t-[3px] ${i === 5 ? "bg-accent" : "bg-accent-track"}`}
              style={{ height: `${(v / 7) * 100}%`, animation: `grow-y 0.8s ${0.7 + i * 0.08}s cubic-bezier(0.2,0.8,0.2,1) both` }}
            />
          ))}
        </span>
      </div>

      <div className={`${chip} bottom-[30%] left-0`} style={{ animation: "float-y 6.5s 0.5s ease-in-out infinite" }}>
        <kbd
          className="flex h-7 min-w-7 items-center justify-center rounded-[7px] bg-surface font-sans text-[13px] font-semibold"
          style={{ animation: "key-press 3.2s 1.2s ease-in-out infinite", boxShadow: "0 0 0 1px var(--line-2), 0 3px 0 var(--line-2)" }}
        >
          N
        </kbd>
        <span className="font-medium">New task</span>
      </div>

      <div className={`${chip} right-[2%] bottom-[16%] gap-1.5`} style={{ animation: "float-y 7.5s 1.5s ease-in-out infinite" }}>
        {"MTWTFSS".split("").map((d, i) => (
          <span key={i} className="flex w-6 flex-col items-center gap-1">
            <span className={`text-[11px] font-medium ${week[i] === "today" ? "text-accent-ink" : "text-ink-3"}`}>{d}</span>
            <span
              className={`size-1.5 rounded-full ${
                week[i] === "done" ? "bg-green" : week[i] === "late" ? "bg-amber" : week[i] === "today" ? "bg-accent" : "bg-line-2"
              }`}
            />
          </span>
        ))}
      </div>
    </div>
  );
}
