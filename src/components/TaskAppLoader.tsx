"use client";

import dynamic from "next/dynamic";
import type { AppUser } from "@/lib/types";

// The app works with the viewer's local date, so it renders on the client only.
const TaskApp = dynamic(() => import("./TaskApp").then((m) => m.TaskApp), {
  ssr: false,
  loading: () => <div className="min-h-dvh" />,
});

/** `account`: the signed-in account's id; it names this account's waiting changes in the browser. */
export function TaskAppLoader({ user, account }: { user: AppUser; account: string }) {
  return <TaskApp user={user} account={account} />;
}
