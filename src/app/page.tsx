import { auth } from "@/auth";
import { SignInScreen } from "@/components/SignInScreen";
import { TaskAppLoader } from "@/components/TaskAppLoader";
import { touchUser } from "@/lib/users";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    const { error } = await searchParams;
    return <SignInScreen error={!!error} />;
  }
  const { name, email, image } = session.user;
  const user = { name: name ?? email ?? "", email: email ?? "", image: image ?? null };
  await touchUser(session.user.id, user);
  // Speaking tasks needs the server's Anthropic key: without one the app simply doesn't offer it.
  return <TaskAppLoader user={user} account={session.user.id} voice={!!process.env.ANTHROPIC_API_KEY} />;
}
