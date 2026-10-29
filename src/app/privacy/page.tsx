import type { Metadata } from "next";
import { LegalList, LegalPage, LegalSection, Strong } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy — Hyperanchor" };

const CONTACT_EMAIL = "privacy@hyperanchor.app";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" effective="October 26, 2026">
      <LegalSection n={1} title="Overview">
        <p>
          Hyperanchor (“we”, “us”) is a task planner. This policy explains what information we collect when you use Hyperanchor, how we use it
          and what choices you have.
        </p>
      </LegalSection>

      <LegalSection n={2} title="Information we collect">
        <LegalList>
          <li>
            <Strong>Account details.</Strong> When you sign in with Google, we receive your name, email address, profile picture and Google
            account ID. When you sign in with Apple, we receive your Apple account ID, your email address (or a private relay address if you
            choose to hide it) and, the first time only, your name. We never receive your password.
          </li>
          <li>
            <Strong>Your tasks.</Strong> Task titles, descriptions, dates and completion status that you create in Hyperanchor.
          </li>
          <li>
            <Strong>Technical data.</Strong> Basic server logs such as IP address, browser or app version and request times, used to run and
            secure the service.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection n={3} title="How we use it">
        <LegalList>
          <li>To sign you in and keep your account secure.</li>
          <li>To store your tasks and show them on any device you use.</li>
          <li>To fix problems and keep the service running.</li>
          <li>To tell you about important changes to Hyperanchor or this policy.</li>
        </LegalList>
        <p>We do not sell your data and do not use it for advertising.</p>
      </LegalSection>

      <LegalSection n={4} title="Google user data">
        <p>
          We request only basic profile access from Google (openid, email, profile). Hyperanchor’s use of information received from Google APIs
          adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>,
          including the Limited Use requirements.
        </p>
      </LegalSection>

      <LegalSection n={5} title="Sharing">
        <p>
          We share data only with service providers that help us run Hyperanchor, such as hosting, database and authentication providers. They
          may use it only to provide those services to us. We may also disclose information if required by law.
        </p>
      </LegalSection>

      <LegalSection n={6} title="Storage and security">
        <p>
          Your data is stored with our hosting and database providers and is encrypted in transit over HTTPS. We keep it for as long as your
          account is active. The iPhone app keeps a copy of your tasks on your device so it works offline; it is removed when you sign out. No
          method of storage is completely secure, but we take reasonable measures to protect your information.
        </p>
      </LegalSection>

      <LegalSection n={7} title="Cookies">
        <p>We use only essential cookies that keep you signed in. We do not use analytics or advertising cookies.</p>
      </LegalSection>

      <LegalSection n={8} title="Your choices">
        <p>
          You can delete your account at any time in Settings, on the web or in the iPhone app: all of your tasks are deleted right away and,
          if you use Sign in with Apple, Hyperanchor’s access to your Apple account is revoked. You can also ask us to access, export, correct
          or delete your data by contacting us, and revoke Hyperanchor’s access in your{" "}
          <a href="https://myaccount.google.com/permissions">Google account settings</a> or in your Apple account’s Sign in with Apple settings.
        </p>
      </LegalSection>

      <LegalSection n={9} title="Children">
        <p>Hyperanchor is not intended for children under 13, and we do not knowingly collect their data.</p>
      </LegalSection>

      <LegalSection n={10} title="Changes">
        <p>
          If we change this policy, we will update the effective date above. For significant changes, we will notify you by email or in the app.
        </p>
      </LegalSection>

      <LegalSection n={11} title="Contact">
        <p>
          Questions about this policy: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
