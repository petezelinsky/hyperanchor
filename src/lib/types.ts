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
