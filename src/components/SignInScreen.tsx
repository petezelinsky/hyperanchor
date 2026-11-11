import Link from "next/link";
import { signInWithApple, signInWithGoogle } from "@/app/actions";
import { appleWebEnabled } from "@/auth";
import { Wordmark } from "./Brand";
import { RotatingWord } from "./landing/RotatingWord";
import { Showcase } from "./landing/Showcase";
import { SignInButton } from "./SignInButton";
import { ThemeSwitch } from "./ThemeSwitch";

const enter = "animate-[fade_var(--duration-data)_var(--ease-out)_both]";

/**
 * The signed-out home page: sign-in on the left (logo, headline, Google and Apple buttons, legal), the animated showcase on the right.
 * On phones and tablets they stack — sign-in fills the first screen with the showcase peeking below — and the footer goes last.
 */
export function SignInScreen({ error }: { error?: boolean }) {
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:grid-rows-[minmax(0,1fr)_auto]">
      <section className="flex min-h-[min(calc(100svh_-_12rem),640px)] min-w-0 justify-center px-5 pt-5 sm:px-8 sm:pt-8 lg:col-start-1 lg:row-start-1 lg:min-h-0 lg:pt-10">
        <div className="flex w-full max-w-[380px] flex-col">
          <header className="flex h-8 items-center animate-[fade_var(--duration-data)_var(--ease-out)_both]">
            <Wordmark href="/" size={24} />
          </header>

          <main className="flex flex-1 flex-col justify-center py-10 lg:py-14">
            <h1 className={`font-display text-title font-semibold ${enter}`}>
              <span className="sr-only">Own your day, week and month.</span>
              <span aria-hidden="true">
                Own your <RotatingWord words={["day.", "week.", "month."]} />
              </span>
            </h1>
            <p className={`mt-3 text-callout text-ink-2 [animation-delay:70ms] ${enter}`}>
              Hyperanchor is a calm, fast planner.
              <br />
              Sign in to get started.
            </p>

            <div className={`mt-8 flex flex-col gap-2.5 [animation-delay:140ms] ${enter}`}>
              {appleWebEnabled() && (
                <form action={signInWithApple}>
                  <SignInButton provider="apple" />
                </form>
              )}
              <form action={signInWithGoogle}>
                <SignInButton provider="google" />
              </form>
            </div>
            {error && (
              <p role="alert" className="mt-4 rounded-sm bg-red-soft px-3 py-2 text-footnote font-medium text-red-ink">
                Sign-in didn’t work. Please try again.
              </p>
            )}
            {/* Two set lines: the documents always sit together on the second, and neither name ever breaks. */}
            <p className={`mt-5 text-caption text-ink-2 [animation-delay:210ms] ${enter}`}>
              <span className="block text-balance">Free forever. By continuing, you agree to the</span>
              <span className="block">
                <Link href="/terms" className="whitespace-nowrap">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="whitespace-nowrap">
                  Privacy Policy
                </Link>
                .
              </span>
            </p>
          </main>
        </div>
      </section>

      <aside className="flex min-w-0 px-3 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:p-4">
        <Showcase />
      </aside>

      <footer className="flex min-w-0 justify-center px-5 pt-7 pb-9 sm:px-8 lg:col-start-1 lg:row-start-2 lg:pt-0 lg:pb-11">
        {/* One line on computers, level with the carousel dots (it may run a little past the column); it wraps on phones. */}
        <div className="flex w-full max-w-[380px] flex-wrap items-center justify-between gap-x-5 gap-y-3 text-caption whitespace-nowrap text-ink-2 lg:flex-nowrap">
          <span>© 2026 Hyperanchor</span>
          <div className="flex items-center gap-4">
            <nav aria-label="Help and legal" className="flex gap-5">
              <Link href="/privacy" className="no-underline hover:underline tap relative">
                Privacy
              </Link>
              <Link href="/terms" className="no-underline hover:underline tap relative">
                Terms
              </Link>
              <Link href="/support" className="no-underline hover:underline tap relative">
                Support
              </Link>
            </nav>
            <ThemeSwitch />
          </div>
        </div>
      </footer>
    </div>
  );
}
