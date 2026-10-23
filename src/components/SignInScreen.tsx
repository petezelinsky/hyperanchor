import Link from "next/link";
import { signInWithGoogle } from "@/app/actions";
import { GoogleButton } from "./GoogleButton";
import { LiveDemo } from "./LiveDemo";
import { SiteFooter, SiteHeader } from "./Site";

const FEATURES = [
  {
    title: "Type it. It lands.",
    text: "Quick add understands dates — “Report fri”, “Dentist oct 28”, “Review in 3 days” — and puts the task on the right day.",
  },
  {
    title: "A list with a spine.",
    text: "Every task in a strict, keyboard-first table. Edit in place, sort, carry unfinished work over in one click.",
  },
  {
    title: "Numbers without noise.",
    text: "Week, month and year at a glance: what you finished, your strongest days, and what is still open.",
  },
];

function SignIn({ error }: { error?: boolean }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <form action={signInWithGoogle}>
        <GoogleButton />
      </form>
      {error && (
        <p role="alert" className="text-[13px] text-signal">
          Sign-in didn’t work. Please try again.
        </p>
      )}
      <p className="max-w-[320px] text-[12.5px] leading-relaxed text-muted">
        Free. By continuing, you agree to the{" "}
        <Link href="/terms" className="text-ink-2 underline decoration-ghost underline-offset-[3px] hover:decoration-ink">
          Terms
        </Link>{" "}
        and the{" "}
        <span className="whitespace-nowrap">
          <Link href="/privacy" className="text-ink-2 underline decoration-ghost underline-offset-[3px] hover:decoration-ink">
            Privacy Policy
          </Link>
          .
        </span>
      </p>
    </div>
  );
}

export function SignInScreen({ error }: { error?: boolean }) {
  return (
    <div className="min-h-dvh bg-paper">
      <SiteHeader>
        <form action={signInWithGoogle}>
          <button type="submit" className="h-9 rounded-[10px] px-3 text-[13.5px] text-muted transition-colors hover:bg-fill hover:text-ink">
            Sign in
          </button>
        </form>
      </SiteHeader>

      <main>
        <section className="mx-auto max-w-[1040px] px-5 pt-16 md:pt-28">
          <div className="mono-label flex animate-up items-center gap-2">
            <span className="size-1.5 rounded-full bg-signal" />
            Task planner
          </div>
          <h1 className="mt-6 max-w-[900px] animate-up text-[46px] leading-[1.02] font-medium tracking-[-0.045em] [animation-delay:80ms] md:text-[80px]">
            Your whole week,
            <br />
            <span className="text-faint">on one screen.</span>
          </h1>
          <div className="mt-10 grid animate-up items-end gap-8 [animation-delay:200ms] md:grid-cols-[minmax(0,1fr)_auto] md:gap-16">
            <p className="max-w-[520px] text-[17px] leading-relaxed text-ink-2 md:text-[19px]">
              A calm planner for people who like their lists strict. Type a task and it lands on the right day. Check it off and watch the week
              fill up.
            </p>
            <SignIn error={error} />
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-[1040px] animate-up px-5 [animation-delay:340ms] md:mt-24">
          <LiveDemo />
        </section>

        <section className="mx-auto mt-24 grid max-w-[1040px] gap-10 px-5 md:mt-32 md:grid-cols-3 md:gap-8">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="border-t border-ink pt-5">
              <div className="mono-label">0{i + 1}</div>
              <h2 className="mt-5 text-[20px] font-medium tracking-[-0.02em]">{f.title}</h2>
              <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{f.text}</p>
            </div>
          ))}
        </section>

        <section className="mx-auto mt-28 mb-24 max-w-[1040px] px-5 md:mt-36">
          <div className="grid items-end gap-8 border-t border-line pt-12 md:grid-cols-[minmax(0,1fr)_auto]">
            <h2 className="text-[34px] leading-[1.08] font-medium tracking-[-0.035em] md:text-[48px]">
              Plan less. <span className="text-faint">Finish more.</span>
            </h2>
            <SignIn />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
