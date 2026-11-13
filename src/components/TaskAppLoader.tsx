"use client";

import dynamic from "next/dynamic";
import type { AppUser } from "@/lib/types";

// The app works with the viewer's local date, so it renders on the client only.
const TaskApp = dynamic(() => import("./TaskApp").then((m) => m.TaskApp), {
  ssr: false,
  loading: () => <div className="min-h-dvh" />,
});

/**
 * `account`: the signed-in account's id; it names this account's waiting changes in the browser.
 * `voice`: whether this server has the AI: it sorts what is said into tasks (the Speak screen) and writes the summary.
 * `transcribe`: whether this server also hears speech itself (else the browser's own recognition is used).
 */
export function TaskAppLoader({ user, account, voice, transcribe }: { user: AppUser; account: string; voice: boolean; transcribe: boolean }) {
  return <TaskApp user={user} account={account} voice={voice} transcribe={transcribe} />;
}
