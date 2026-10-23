import Link from "next/link";
import { signInWithGoogle } from "@/app/actions";
import { AppPreview } from "./AppPreview";
import { GoogleButton } from "./GoogleButton";
import { ChartIcon, ListIcon, WeekIcon } from "./icons";
import { SiteFooter, SiteHeader } from "./Site";

const FEATURES = [
  {
    icon: <ListIcon size={18} />,
    title: "A table built for planning",
    text: "Add, edit and check off tasks inline. Keyboard shortcuts for everything — N for a new task, Space to complete it.",
  },
  {
    icon: <WeekIcon size={18} />,
    title: "Your week and month at a glance",
    text: "See the whole week grouped by day or the month on a calendar. Move anything to today or tomorrow in a click.",
  },
  {
    icon: <ChartIcon size={18} />,
    title: "Analytics that stay calm",
    text: "Completion rate, daily average, your strongest weekdays and a year of activity. Clear, private, no noise.",
  },
];

/** Slow-drifting light behind the glass: it is what the frosted surfaces refract. */
function Orbs() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[1700px] overflow-hidden">
      <div className="orb top-[-320px] left-1/2 size-[1100px] -translate-x-1/2 bg-[radial-gradient(closest-side,var(--orb-light),transparent)]" />
      <div className="orb top-[700px] left-[calc(50%-560px)] size-[640px] bg-[radial-gradient(closest-side,var(--orb-dark),transparent)]" />
      <div className="orb top-[820px] left-[calc(50%+40px)] size-[560px] bg-[radial-gradient(closest-side,var(--orb-dark),transparent)] [animation-delay:-9s] [animation-duration:34s]" />
      <div className="orb top-[560px] left-[calc(50%-120px)] size-[420px] bg-[radial-gradient(closest-side,var(--orb-light),transparent)] [animation-delay:-17s] [animation-duration:40s]" />
    </div>
  );
}

export function SignInScreen({ error }: { error?: boolean }) {
  return (
    <div className="relative isolate min-h-dvh overflow-x-clip">
      <Orbs />
      <SiteHeader>
        <form action={signInWithGoogle}>
          <button type="submit" className="control flex h-10 items-center rounded-full px-5 text-[13.5px] font-medium transition-colors hover:bg-control-hover">
            Sign in
          </button>
        </form>
      </SiteHeader>

      <main>
        <section className="mx-auto max-w-[1100px] px-5 pt-16 pb-14 text-center md:pt-24">
          <div className="glass rim relative inline-flex h-8 animate-rise items-center gap-2.5 rounded-full px-4 text-[12.5px] font-medium text-label-2">
            {["Day", "Week", "Month", "Analytics"].map((v, i) => (
              <span key={v} className="flex items-center gap-2.5">
                {i > 0 && <span className="size-[3px] rounded-full bg-label-3" />}
                {v}
              </span>
            ))}
          </div>
          <h1 className="title-gradient mx-auto mt-7 max-w-[920px] pb-2 font-display text-[46px] leading-[1.04] font-bold tracking-[-0.048em] text-balance md:text-[88px]">
            Your whole week on one screen.
          </h1>
          <p className="mx-auto mt-5 max-w-[600px] text-[17px] leading-relaxed text-pretty text-label-2 md:text-[20px]">
            Hyperanchor is a calm, focused planner. Plan each day in a clean table, see the week and month at a glance, and understand how you
            get things done.
          </p>
          <form action={signInWithGoogle} className="mt-10 flex justify-center">
            <GoogleButton />
          </form>
          {error && (
            <p role="alert" className="glass rim relative mt-5 inline-flex rounded-full px-4 py-1.5 text-[13px] font-medium text-label">
              Sign-in didn’t work. Please try again.
            </p>
          )}
          <p className="mt-5 text-[12.5px] text-label-3">
            Free. By continuing, you agree to the{" "}
            <Link href="/terms" className="text-label-2">
              Terms of Service
            </Link>{" "}
            and{" "}
            <span className="whitespace-nowrap">
              <Link href="/privacy" className="text-label-2">
                Privacy Policy
              </Link>
              .
            </span>
          </p>
        </section>

        <section className="mx-auto max-w-[1100px] px-3 md:px-5">
          <AppPreview />
        </section>

        <section className="mx-auto grid max-w-[1080px] gap-3 px-3 py-20 md:grid-cols-3 md:gap-4 md:py-28">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass rim relative rounded-[28px] p-7">
              <div className="lens flex size-11 items-center justify-center rounded-full text-label">{f.icon}</div>
              <h2 className="mt-6 text-[17px] font-semibold tracking-[-0.015em]">{f.title}</h2>
              <p className="mt-2 text-[14.5px] leading-relaxed text-label-2">{f.text}</p>
            </div>
          ))}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
