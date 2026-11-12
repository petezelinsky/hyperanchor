"use client";

import dynamic from "next/dynamic";
import type { AppUser, ProInterest } from "@/lib/types";

// The app works with the viewer's local date, so it renders on the client only.
const TaskApp = dynamic(() => import("./TaskApp").then((m) => m.TaskApp), {
  ssr: false,
  loading: () => <div className="min-h-dvh" />,
});

/**
 * `account`: the signed-in account's id; it names this account's waiting changes in the browser.
 * `voice`: whether this server can sort what is said into tasks (the Speak screen).
 * `proInterest`: whether this person asked to hear when Pro opens (and with which billing).
 */
export function TaskAppLoader({ user, account, voice, proInterest }: { user: AppUser; account: string; voice: boolean; proInterest: ProInterest }) {
  return <TaskApp user={user} account={account} voice={voice} proInterest={proInterest} />;
}
