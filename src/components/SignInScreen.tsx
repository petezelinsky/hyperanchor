import Link from "next/link";
import { signInWithApple, signInWithGoogle } from "@/app/actions";
import { appleWebEnabled } from "@/auth";
import { FlameIcon } from "./icons";
import { HeroCard } from "./landing/HeroCard";
import { Reveal } from "./landing/Reveal";
import { RotatingWord } from "./landing/RotatingWord";
import { SignInButton } from "./SignInButton";
import { FocusVisual, ProgressVisual, TypingVisual, WeekVisual } from "./landing/visuals";
import { SiteFooter, SiteHeader } from "./Site";

const FEATURES = [
  {
    title: "Capture in a blink",
    text: "Press N anywhere, type, hit Enter. Every action has a shortcut, and every change can be undone.",
    visual: <TypingVisual />,
  },
  {
    title: "Your week at a glance",
    text: "Every day of the week side by side. Move anything to tomorrow or next week in a click.",
    visual: <WeekVisual />,
  },
  {
    title: "One thing at a time",
    text: "Focus mode shows just the next task, big and clear. Finish it or set it aside — the rest waits quietly.",
    visual: <FocusVisual />,
  },
  {
    title: "Progress you can feel",
    text: "Completion rate, streaks and your strongest days — clear numbers that keep you going, and stay private.",
    visual: <ProgressVisual />,
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
          <div className="mx-auto max-w-[1100px] px-5 pt-14 text-center md:pt-24">
            <span className="inline-flex animate-rise items-center gap-2 rounded-full px-3 py-1 text-[12.5px] font-medium text-ink-2 shadow-[inset_0_0_0_1px_var(--line-2)]">
              <span className="size-1.5 rounded-full bg-accent" style={{ animation: "pulse-dot 2.4s ease-out infinite" }} />
              Free · Private · Keyboard-first
            </span>
            <h1 className="mx-auto mt-6 font-display text-[54px] leading-[1.02] font-bold tracking-[-0.045em] md:text-[100px]">
              <span className="sr-only">Own your day, week and month.</span>
              <span aria-hidden="true" className="block animate-rise text-ink-3">
                Own your
              </span>
              <RotatingWord words={["day.", "week.", "month."]} />
            </h1>
            <p className="mx-auto mt-6 max-w-[580px] animate-rise text-[17px] leading-relaxed text-pretty text-ink-2 [animation-delay:80ms] md:text-[19px]">
              Hyperanchor is a calm, fast planner. Capture tasks in a blink, focus on one thing at a time, and see your week at a glance.
            </p>
            <div className="mt-9 flex animate-rise [animation-delay:140ms]">
              <SignInButtons />
            </div>
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
            <div
              aria-hidden="true"
              className="dot-grid absolute inset-x-0 -top-12 bottom-0 -z-10 [mask-image:radial-gradient(ellipse_52%_48%_at_50%_46%,#000_25%,transparent_80%)]"
            />
            <div inert className="relative w-full max-w-[420px] animate-rise [animation-delay:200ms]">
              <HeroCard />
            </div>
            <Chips />
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-4 py-16 md:py-24">
          <Reveal className="mx-auto max-w-[640px] text-center">
            <p className="text-[13px] font-medium text-ink-3">Why Hyperanchor</p>
            <h2 className="mt-3 font-display text-[34px] leading-[1.1] font-bold tracking-[-0.035em] text-balance md:text-[52px]">Planning that feels light.</h2>
            <p className="mt-4 text-[16px] leading-relaxed text-pretty text-ink-2 md:text-[18px]">
              Day, week and month views in one calm flow — plus the small details that make it a joy to come back to.
            </p>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 2) * 90} className="rounded-[24px] p-2 pb-6 shadow-[inset_0_0_0_1px_var(--line)] md:p-2.5 md:pb-8">
                <div inert className="h-[220px] overflow-hidden rounded-[18px] bg-canvas">
                  {f.visual}
                </div>
                <h3 className="mt-6 px-3 text-[19px] font-semibold tracking-[-0.015em] md:px-4">{f.title}</h3>
                <p className="mt-2 px-3 text-[15px] leading-relaxed text-ink-2 md:px-4">{f.text}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="px-4 pb-20 md:pb-28">
          <Reveal className="relative isolate mx-auto max-w-[1120px] overflow-hidden rounded-[28px] bg-[#0a0a0a] px-6 py-16 text-center md:py-24 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
            <div
              aria-hidden="true"
              className="dot-grid absolute inset-0 -z-10 [--dot:rgba(255,255,255,0.13)] [mask-image:radial-gradient(ellipse_60%_70%_at_50%_0%,#000,transparent)]"
            />
            <h2 className="font-display text-[38px] leading-[1.06] font-bold tracking-[-0.035em] text-white md:text-[60px]">
              Make this week
              <br />
              your best one.
            </h2>
            <p className="mt-4 text-[16px] text-white/70 md:text-[18px]">Free, and it takes ten seconds to start.</p>
            <div className="mt-9 flex">
              <SignInButtons variant="light" />
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

/** Google, and Sign in with Apple once it's configured: stacked on phones, side by side on wider screens. */
function SignInButtons({ variant }: { variant?: "primary" | "light" }) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
      {appleWebEnabled() && (
        <form action={signInWithApple}>
          <SignInButton provider="apple" variant={variant} />
        </form>
      )}
      <form action={signInWithGoogle}>
        <SignInButton provider="google" variant={variant} />
      </form>
    </div>
  );
}

/** Two small cards floating beside the hero list (wide screens only). */
function Chips() {
  const chip = "absolute hidden items-center gap-2.5 rounded-[14px] bg-surface px-3.5 py-2.5 text-[13px] shadow-float lg:flex";
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className={`${chip} top-[16%] left-[3%]`} style={{ animation: "float-y 6s ease-in-out infinite" }}>
        <span className="flex size-8 items-center justify-center rounded-[10px] bg-accent-soft text-accent">
          <FlameIcon size={17} />
        </span>
        <span>
          <span className="block leading-4 font-semibold">12-day streak</span>
          <span className="block text-[11.5px] text-ink-3">Keep it going</span>
        </span>
      </div>

      <div className={`${chip} right-[3%] bottom-[34%]`} style={{ animation: "float-y 7s 1s ease-in-out infinite" }}>
        <kbd
          className="flex h-7 min-w-7 items-center justify-center rounded-[7px] bg-surface font-sans text-[13px] font-semibold"
          style={{ animation: "key-press 3.2s 1.2s ease-in-out infinite", boxShadow: "0 0 0 1px var(--line-2), 0 3px 0 var(--line-2)" }}
        >
          N
        </kbd>
        <span className="font-medium">New task</span>
      </div>
    </div>
  );
}
