export type Task = {
  id: string;
  date: string; // YYYY-MM-DD, local
  title: string;
  description: string;
  done: boolean;
  /** Manual order within the day; null sorts by creation time (see sortTasks). */
  position: number | null;
  createdAt: string;
  updatedAt: string;
};

/** A task understood from what was said or typed: shown for review, and saved only when the person adds it. */
export type TaskDraft = Pick<Task, "title" | "description" | "date">;

export type AppUser = {
  name: string;
  email: string;
  image: string | null;
};

/**
 * Today's AI allowance (UTC day), in tokens: how much has been used, how much is left, and the whole of it. `features`
 * says what this server offers (the iOS app reads it; the web gets the same from the page): sorting speech or text into
 * tasks and the Analytics summary need the Anthropic key, hearing speech on the server the OpenAI key too.
 */
export type Usage = {
  today: { used: number; left: number; limit: number };
  features?: { voice: boolean; transcribe: boolean; summary: boolean };
  /** With `?history=N`: each of the last N days (UTC, oldest first, today last). */
  history?: { day: string; tokens: number; requests: number }[];
};
