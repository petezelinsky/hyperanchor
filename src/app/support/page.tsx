import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Support — Hyperanchor" };

const CONTACT_EMAIL = "support@hyperanchor.app";

export default function SupportPage() {
  return (
    <LegalPage
      title="Support"
      intro={
        <>
          Questions, problems or ideas? Write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </>
      }
    >
      <LegalSection n={1} title="Signing in">
        <p>
          Sign in with Google or Apple, on the website or in the iPhone and iPad app. The same account shows the same tasks everywhere. Google and
          Apple sign-ins are separate accounts, even when they use the same email address.
        </p>
      </LegalSection>

      <LegalSection n={2} title="Your tasks on every device">
        <p>
          Changes are saved as you make them and show up on your other devices. In the app, changes you make without a connection are kept and
          sent as soon as you’re back online.
        </p>
      </LegalSection>

      <LegalSection n={3} title="Deleting your account">
        <p>
          Open Settings and choose Delete Account, on the website or in the app. This deletes all of your tasks and can’t be undone. If you signed
          in with Apple, Hyperanchor’s access to your Apple ID is revoked as well.
        </p>
      </LegalSection>

      <LegalSection n={4} title="Privacy">
        <p>
          What we store and why is described in the <Link href="/privacy">Privacy Policy</Link>; the rules of use are in the{" "}
          <Link href="/terms">Terms of Service</Link>.
        </p>
      </LegalSection>

      <LegalSection n={5} title="Contact">
        <p>
          Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> — tell us what happened and, if it’s about the app, which device you use.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
