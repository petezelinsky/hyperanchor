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
  // The AI (speaking tasks, the summary in Progress) needs the server's Anthropic key: without one the app simply
  // doesn't offer it. Speech is heard on the server when it has an OpenAI key, else by the browser itself.
  return (
    <TaskAppLoader user={user} account={session.user.id} voice={!!process.env.ANTHROPIC_API_KEY} transcribe={!!process.env.ANTHROPIC_API_KEY && !!process.env.OPENAI_API_KEY} />
  );
}
