import Link from "next/link";
import { signInWithGoogle } from "@/app/actions";
import { GoogleButton } from "./GoogleButton";
import { LogoPill } from "./Logo";

export function SignInScreen({ error }: { error?: boolean }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-bg">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-380px] left-1/2 h-[560px] w-[1000px] -translate-x-1/2 rounded-full opacity-50 blur-[90px]"
        style={{ background: "conic-gradient(from 200deg, #FFD9C7, #FFF2C6, #DAF3D9, #D2E6FF, #E9DAFF, #FFD9C7)" }}
      />
      <header className="relative flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <LogoPill />
        <div className="mono text-[11px] text-muted-2">Task planner</div>
      </header>
      <main className="relative flex flex-1 items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-[560px] rounded-[36px] bg-white/60 px-6 pt-9 pb-8 shadow-card sm:px-10 sm:pt-11 sm:pb-9">
          <div className="mono text-[11px] text-muted-2">Sign in — 01</div>
          <h1 className="mt-4 text-[clamp(36px,5.5vw,52px)] leading-[1.04] font-medium tracking-[-0.035em] text-balance">
            Your whole week on one screen
          </h1>
          <p className="mt-4 max-w-[400px] text-[15px] leading-normal text-pretty text-muted">
            Create tasks with descriptions, plan them by day and check them off when done.
          </p>
          <form action={signInWithGoogle}>
            <GoogleButton />
          </form>
          {error && (
            <p role="alert" className="mt-4 text-[13px] text-danger">
              Sign-in didn’t work. Please try again.
            </p>
          )}
          <p className="mt-7 max-w-[360px] text-xs leading-normal text-faint">
            By continuing, you agree to the <Link href="/terms">Terms of Service</Link> and{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </div>
      </main>
      <div className="h-[72px]" />
    </div>
  );
}
