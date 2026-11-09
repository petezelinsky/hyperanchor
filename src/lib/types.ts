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

export type AppUser = {
  name: string;
  email: string;
  image: string | null;
};
