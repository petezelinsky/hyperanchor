import { auth } from "@/auth";
import { SignInScreen } from "@/components/SignInScreen";
import { TaskAppLoader } from "@/components/TaskAppLoader";
import { signedInAt } from "@/lib/api";
import { ensureSchema } from "@/lib/db";
import { stillValid } from "@/lib/revocations";
import { touchUser } from "@/lib/users";

/** A session from before the account was deleted is no session: it signs in afresh (and never brings the account back). */
async function live(id: string | undefined, session: unknown) {
  if (!id) return false;
  try {
    await ensureSchema();
    return await stillValid(id, signedInAt(session));
  } catch {
    return true; // the database being slow never locks anyone out of the page; the API checks again
  }
}

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !(await live(session.user.id, session))) {
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
