import { auth } from "@/auth";
import { SignInScreen } from "@/components/SignInScreen";
import { TaskAppLoader } from "@/components/TaskAppLoader";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    const { error } = await searchParams;
    return <SignInScreen error={!!error} />;
  }
  const { name, email, image } = session.user;
  return <TaskAppLoader user={{ name: name ?? email ?? "", email: email ?? "", image: image ?? null }} />;
}
