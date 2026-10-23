"use client";

import dynamic from "next/dynamic";
import type { AppUser } from "@/lib/types";

// The app works with the viewer's local date, so it renders on the client only.
const TaskApp = dynamic(() => import("./TaskApp").then((m) => m.TaskApp), {
  ssr: false,
  loading: () => <div className="min-h-dvh" />,
});

export function TaskAppLoader({ user }: { user: AppUser }) {
  return <TaskApp user={user} />;
}
