import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of Service — Hyperanchor" };

const CONTACT_EMAIL = "support@hyperanchor.app";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" effective="October 26, 2026">
      <LegalSection n={1} title="Agreement">
        <p>
          By using Hyperanchor (“the service”), you agree to these terms. If you don’t agree, please don’t use the service.
        </p>
      </LegalSection>

      <LegalSection n={2} title="Your account">
        <p>
          You sign in with your Google or Apple account and are responsible for activity under it. You must be at least 13 years old to use Hyperanchor.
        </p>
      </LegalSection>

      <LegalSection n={3} title="Your content">
        <p>
          The tasks you create belong to you. You give us permission to store and display them to you so the service can work. How we handle your
          data is described in our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </LegalSection>

      <LegalSection n={4} title="Acceptable use">
        <p>
          Don’t misuse the service: don’t try to access other people’s data, disrupt or overload the service, or use it for anything unlawful.
        </p>
      </LegalSection>

      <LegalSection n={5} title="Availability">
        <p>
          Hyperanchor is provided “as is”, without warranties of any kind. We may change, suspend or discontinue features at any time. We aim to
          keep your data safe, but we recommend keeping your own copy of anything important.
        </p>
      </LegalSection>

      <LegalSection n={6} title="Liability">
        <p>To the extent permitted by law, we are not liable for any indirect or consequential damages arising from your use of the service.</p>
      </LegalSection>

      <LegalSection n={7} title="Ending your use">
        <p>
          You can stop using Hyperanchor at any time and delete your account in Settings. We may suspend accounts that violate these terms.
        </p>
      </LegalSection>

      <LegalSection n={8} title="Changes">
        <p>If we change these terms, we will update the effective date above. Continuing to use the service means you accept the new terms.</p>
      </LegalSection>

      <LegalSection n={9} title="Contact">
        <p>
          Questions about these terms: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
