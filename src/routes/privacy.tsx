import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Bloxspark" },
      {
        name: "description",
        content:
          "How Bloxspark collects, uses, protects, and retains your personal data, and the rights available to you.",
      },
      { property: "og:title", content: "Privacy Policy — Bloxspark" },
      { property: "og:description", content: "Your data and your rights, explained clearly." },
    ],
  }),
  component: () => (
    <LegalPage title="Privacy Policy" updated="Last updated: September 12, 2026">
      <LegalSection title="1. Who is responsible for your data?">
        <p>
          Bloxspark is responsible for processing the personal data collected through the app.
          Bloxspark is an independent service and is not affiliated with Roblox Corporation. This
          policy explains which data we process, why we process it, how long we retain it, who we
          share it with, and how you can exercise your rights.
        </p>
      </LegalSection>

      <LegalSection title="2. Data we collect">
        <p>We collect only the data needed to operate the Service:</p>
        <ul>
          <li>
            <strong>Account data</strong>: email address, technical identifier, sign-in method
            (email or Google), and account creation date.
          </li>
          <li>
            <strong>Profile data</strong>: Bloxspark username, Roblox username you provide,
            language, date of birth (used to calculate age and apply protections for minors), bio,
            profile decorations, and selected theme.
          </li>
          <li>
            <strong>Parental data</strong>: for users aged 13 to 17, the name and email address of a
            parent or legal guardian and proof of their consent.
          </li>
          <li>
            <strong>Content</strong>: uploaded avatar photos, text messages, voice messages, and
            images sent in conversations.
          </li>
          <li>
            <strong>Usage data</strong>: swipes (like, pass, and Super Spark), matches, conversation
            activity, last active and last read timestamps, reports, and blocks.
          </li>
          <li>
            <strong>Technical data</strong>: sign-in logs and data strictly required for security
            and abuse prevention.
          </li>
        </ul>
        <p>
          We do not ask for your Roblox password, banking information, or postal address. Never
          share this information with another user.
        </p>
      </LegalSection>

      <LegalSection title="3. Purposes and legal bases">
        <ul>
          <li>
            <strong>Providing the Service</strong> (performance of a contract): account creation,
            profile display, profile recommendations, matches, messaging, and notifications.
          </li>
          <li>
            <strong>Protecting minors and maintaining safety</strong> (legal obligation and
            legitimate interest): verifying declared age, obtaining parental consent, moderation,
            and preventing abuse and fraud.
          </li>
          <li>
            <strong>Improving the Service</strong> (legitimate interest): aggregated and anonymized
            measurement of feature usage.
          </li>
          <li>
            <strong>Service communications</strong> (performance of a contract): confirmation
            emails, password resets, and security alerts.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Visibility of your information">
        <p>
          Your username, Roblox username, age, language, bio, decorations, and photos are visible to
          other users in the Sparks feed and on your profile. Your email address, exact date of
          birth, and parental contact information are never displayed publicly.
        </p>
        <p>
          Private and group messages are accessible only to conversation participants and, when a
          valid report is submitted, to the moderation team.
        </p>
      </LegalSection>

      <LegalSection title="5. Recipients and service providers">
        <p>
          Data is hosted and processed by our infrastructure providers, including database hosting,
          file storage, authentication, and transactional email services. They act as processors and
          are bound by confidentiality and security commitments. We never sell your personal data or
          use it for targeted advertising.
        </p>
        <p>
          Data may be disclosed to competent authorities when required by law or when necessary to
          protect a person's physical safety, especially that of a minor.
        </p>
      </LegalSection>

      <LegalSection title="6. Security">
        <p>
          Access to data is protected through authentication, encrypted communications (HTTPS), and
          database-level security rules that limit each user to their own data and to conversations
          in which they participate. Photos and voice messages are stored in private locations that
          can be accessed only through temporary signed links.
        </p>
      </LegalSection>

      <LegalSection title="7. Retention periods">
        <ul>
          <li>Account and profile data: retained while the account remains active.</li>
          <li>Messages and media: retained until they or the account are deleted.</li>
          <li>Security logs and reports: retained for up to twelve (12) months after review.</li>
          <li>
            After account deletion: erased within thirty (30) days, except where retention is
            required by law or needed to prevent repeated serious abuse.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Your rights">
        <p>
          Under the GDPR and other applicable regulations, you have the right to access, correct,
          erase, restrict, object to the processing of, and receive a portable copy of your data.
          You may also withdraw your consent at any time. Legal guardians may exercise these rights
          on behalf of a minor.
        </p>
        <p>
          You can exercise most of these rights directly in the app by editing your profile,
          deleting photos or messages, or permanently deleting your account from Settings. For any
          other request, contact us through the in-app form. You may also lodge a complaint with the
          competent supervisory authority.
        </p>
      </LegalSection>

      <LegalSection title="9. Cookies and local storage">
        <p>
          Bloxspark does not use advertising cookies or third-party trackers. We use browser local
          storage only to maintain your session, language, and light or dark theme preference.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes to this policy">
        <p>
          We may update this policy. We will notify you in the app before any material change takes
          effect.
        </p>
      </LegalSection>
    </LegalPage>
  ),
});
