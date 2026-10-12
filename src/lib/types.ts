export type Task = {
  id: string;
  date: string; // YYYY-MM-DD, local
  title: string;
  description: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AppUser = {
  name: string;
  email: string;
  image: string | null;
};
