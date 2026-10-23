import Link from "next/link";
import { signInWithGoogle } from "@/app/actions";
import { AppIcon } from "./AppIcon";
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

export function SignInScreen({ error }: { error?: boolean }) {
  return (
    <div className="min-h-dvh bg-window">
      <SiteHeader>
        <form action={signInWithGoogle}>
          <button type="submit" className="text-[13px] font-medium text-accent hover:underline">
            Sign in
          </button>
        </form>
      </SiteHeader>

      <main>
        <section className="mx-auto max-w-[1100px] px-5 pt-14 pb-12 text-center md:pt-24">
          <AppIcon size={72} className="mx-auto shadow-[0_14px_32px_-10px_rgba(0,96,223,0.55)]" />
          <h1 className="mt-8 font-display text-[42px] leading-[1.05] font-bold tracking-[-0.035em] text-balance md:text-[64px]">
            Your whole week
            <br />
            on one screen.
          </h1>
          <p className="mx-auto mt-5 max-w-[620px] text-[17px] leading-relaxed text-pretty text-label-2 md:text-[20px]">
            Hyperanchor is a calm, focused planner. Plan each day in a clean table, see the week and month at a glance, and understand how you
            get things done.
          </p>
          <form action={signInWithGoogle} className="mt-9 flex justify-center">
            <GoogleButton />
          </form>
          {error && (
            <p role="alert" className="mt-4 text-[13px] text-red">
              Sign-in didn’t work. Please try again.
            </p>
          )}
          <p className="mt-4 text-[12.5px] text-label-3">
            Free. By continuing, you agree to the <Link href="/terms">Terms of Service</Link> and{" "}
            <span className="whitespace-nowrap">
              <Link href="/privacy">Privacy Policy</Link>.
            </span>
          </p>
        </section>

        <section className="mx-auto max-w-[1040px] px-5">
          <AppPreview />
        </section>

        <section className="mx-auto grid max-w-[1040px] gap-10 px-5 py-20 md:grid-cols-3 md:py-24">
          {FEATURES.map((f) => (
            <div key={f.title}>
              <div className="flex size-9 items-center justify-center rounded-[9px] bg-accent-soft text-accent">{f.icon}</div>
              <h2 className="mt-4 text-[17px] font-semibold tracking-[-0.01em]">{f.title}</h2>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-label-2">{f.text}</p>
            </div>
          ))}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
