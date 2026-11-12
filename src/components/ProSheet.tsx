"use client";

import { useEffect, useRef, useState } from "react";
import type { ProInterest } from "@/lib/types";
import { CheckIcon, TimerIcon, XIcon } from "./icons";
import { reducedMotion } from "./motion";
import { Button, IconButton, Modal, radioKeys } from "./ui";
import { Orb } from "./voice/Orb";
import { ParticleRing } from "./voice/ParticleRing";

type Plan = "yearly" | "monthly";

const PLANS: { value: Plan; name: string; price: string; note: string; short: string; badge?: string }[] = [
  { value: "yearly", name: "Yearly", price: "$4", note: "$48 billed once a year", short: "$48 a year", badge: "Save 33%" },
  { value: "monthly", name: "Monthly", price: "$6", note: "Billed every month", short: "Every month" },
];

/**
 * Pro, as a window: on one side the sphere and what it's for, on the other what Pro brings, its two prices, and one
 * step. Pro isn't open yet, and the window says so: the step is to ask to be told when it is (with the billing one
 * would pick), not to pay. Nothing here takes money.
 */
export function ProSheet({ interest, onInterest, onClose }: { interest: ProInterest; onInterest: (p: ProInterest) => void; onClose: () => void }) {
  const [plan, setPlan] = useState<Plan>(interest ?? "yearly");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const save = async (next: ProInterest) => {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/account", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proInterest: next }) });
      if (!res.ok) throw new Error(String(res.status));
      onInterest(next);
    } catch {
      setFailed(true);
    }
    setBusy(false);
  };
  const pick = (p: Plan) => {
    setPlan(p);
    // Already on the list: the billing they'd pick follows the choice.
    if (interest && interest !== p) void save(p);
  };

  return (
    <Modal label="Hyperanchor Pro" onClose={onClose} sheet className="max-w-[880px] overflow-hidden md:flex">
      {/* What it is for: the sphere, and one sentence. */}
      <div className="relative flex flex-none flex-col items-center justify-center bg-primary px-6 pt-2 pb-7 text-center text-on-primary md:w-[380px] md:px-10 md:py-10">
        <span className="absolute top-3 right-3 md:hidden">
          <IconButton label="Close" onClick={onClose} className="bg-on-primary/12 text-on-primary! hover:bg-on-primary/20!">
            <XIcon size={14} />
          </IconButton>
        </span>
        <ProSphere />
        <h2 className="mt-1 text-[24px] leading-[30px] font-semibold tracking-[-0.026em] text-balance md:mt-3 md:text-[30px] md:leading-9 md:tracking-[-0.028em]">Talk your day into place.</h2>
        <p className="mt-2.5 max-w-[300px] text-body text-balance text-on-primary/65">Say everything that’s on your mind. It lands as tasks, on the right days.</p>
      </div>

      {/* What Pro brings, what it will cost, and the one step there is for now. */}
      <div className="flex min-w-0 flex-1 flex-col px-4 pt-5 pb-4 md:px-8 md:pt-0 md:pb-8">
        <div className="flex items-center gap-2.5 md:h-16">
          <h3 className="text-headline font-semibold">Hyperanchor Pro</h3>
          <span className="flex h-[22px] items-center rounded-[6px] px-[7px] text-caption-2 font-semibold text-ink-2 shadow-[inset_0_0_0_1px_var(--line-2)]">Coming soon</span>
          <span className="flex-1" />
          <IconButton label="Close" onClick={onClose} className="-mr-2 shadow-[inset_0_0_0_1px_var(--line-2)] max-md:hidden">
            <XIcon size={14} />
          </IconButton>
        </div>

        <ul className="mt-4 flex flex-col gap-4 md:mt-1">
          <Perk icon={<Orb size={20} />} title="More voice, every day" text="Well past the 60 sortings a day on Free." />
          <Perk icon={<TimerIcon size={17} />} title="A whole week in one go" text="Longer recordings: say it all at once." />
          <Perk icon={<CheckIcon size={13} />} title="Everything else stays free" text="Tasks, Focus and Progress, with or without Pro." />
        </ul>

        <div aria-hidden="true" className="my-5 h-px bg-line md:mt-7 md:mb-6" />

        <div
          role="radiogroup"
          aria-label="Billing"
          onKeyDown={(e) =>
            radioKeys(
              e,
              PLANS.map((p) => p.value),
              plan,
              pick,
            )
          }
          className="flex gap-2"
        >
          {PLANS.map((p) => {
            const on = p.value === plan;
            return (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                onClick={() => pick(p.value)}
                className={`flex min-w-0 flex-1 flex-col gap-2 rounded-lg bg-surface px-4 pt-3.5 pb-4 text-left transition-shadow duration-(--duration-fast) ${
                  on ? "shadow-[inset_0_0_0_1.5px_var(--ink)]" : "shadow-[inset_0_0_0_1px_var(--line-2)] hover:shadow-[inset_0_0_0_1px_var(--check-ring)]"
                }`}
              >
                <span className="flex h-5 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`flex size-[18px] flex-none items-center justify-center rounded-full transition-colors duration-(--duration-fast) ${on ? "bg-primary" : "shadow-[inset_0_0_0_1.5px_var(--check-ring)]"}`}
                  >
                    {on && <span className="size-1.5 rounded-full bg-on-primary" />}
                  </span>
                  <span className="text-footnote font-semibold">{p.name}</span>
                  {p.badge && <span className="ml-auto flex h-5 items-center rounded-[5px] bg-primary px-1.5 text-caption-2 font-semibold whitespace-nowrap text-on-primary">{p.badge}</span>}
                </span>
                <span className="flex items-baseline gap-1.5 pl-[26px]">
                  <span className="text-[28px] leading-8 font-semibold tracking-[-0.03em]">{p.price}</span>
                  <span className="text-footnote text-ink-3">a month</span>
                </span>
                <span className="truncate pl-[26px] text-caption text-ink-3">
                  <span className="sm:hidden">{p.short}</span>
                  <span className="max-sm:hidden">{p.note}</span>
                </span>
              </button>
            );
          })}
        </div>

        <span className="min-h-5 flex-1 md:min-h-7" />

        {interest ? (
          <div className="flex h-11 items-center justify-between gap-3 rounded-lg pr-1.5 pl-4 shadow-[inset_0_0_0_1px_var(--line-2)] md:h-12">
            <span className="flex min-w-0 items-center gap-2.5 text-body font-medium">
              <span className="flex size-[18px] flex-none items-center justify-center rounded-full bg-primary text-on-primary">
                <CheckIcon size={10} />
              </span>
              <span className="truncate">You’re on the list</span>
            </span>
            <Button variant="plain" disabled={busy} onClick={() => save(null)}>
              Leave the list
            </Button>
          </div>
        ) : (
          <Button variant="primary" size="lg" disabled={busy} onClick={() => save(plan)} className="w-full rounded-lg md:h-12">
            Tell me when Pro opens
          </Button>
        )}
        <p role={failed ? "alert" : undefined} className={`mt-2.5 text-center text-caption ${failed ? "font-medium text-red-ink" : "text-ink-3"}`}>
          {failed
            ? "Couldn’t save that. Check your connection and try again."
            : interest
              ? "Nothing to pay now. You’ll hear from us the day Pro opens."
              : "Pro isn’t open yet, so there’s nothing to pay now. The prices are the planned ones."}
        </p>
      </div>
    </Modal>
  );
}

function Perk({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <li className="flex items-center gap-3.5">
      <span className="flex size-9 flex-none items-center justify-center rounded-[10px] text-ink shadow-[inset_0_0_0_1px_var(--line-2)]">{icon}</span>
      <span className="min-w-0">
        <span className="block text-body font-semibold">{title}</span>
        <span className="block text-caption text-ink-3">{text}</span>
      </span>
    </li>
  );
}

/** The sphere, alive but calm, in the color of the panel's text. */
function ProSphere() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const size = el.clientWidth || 220;
    const ring = new ParticleRing(el, {
      count: Math.round((5200 * size) / 280),
      dotSize: 706 / size,
      mode: "steady",
      intensity: 0.55,
      reduced: reducedMotion(),
      color: getComputedStyle(el).color,
    });
    ring.start();
    const visible = () => (document.hidden ? ring.stop() : ring.start());
    document.addEventListener("visibilitychange", visible);
    return () => {
      document.removeEventListener("visibilitychange", visible);
      ring.stop();
    };
  }, []);
  return <canvas ref={canvas} aria-hidden="true" className="size-[170px] flex-none md:size-[230px]" />;
}
