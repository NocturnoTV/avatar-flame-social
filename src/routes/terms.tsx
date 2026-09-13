import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — Bloxspark" },
      {
        name: "description",
        content:
          "Bloxspark Terms of Use covering accounts, minimum age, content, enforcement, and liability.",
      },
      { property: "og:title", content: "Terms of Use — Bloxspark" },
      { property: "og:description", content: "The rules governing the Bloxspark service." },
    ],
  }),
  component: () => (
    <LegalPage title="Terms of Use" updated="Last updated: September 12, 2026">
      <LegalSection title="1. Purpose and acceptance">
        <p>
          These Terms of Use (the “Terms”) govern access to and use of the Bloxspark application
          (the “Service”), a social and discovery network for Roblox players. By creating an
          account, accessing the Service, or using it in any way, you agree to all of these Terms.
          If you do not agree to these Terms, you must stop using the Service immediately.
        </p>
        <p>
          Bloxspark is an independent platform. It is not affiliated with, associated with,
          authorized by, endorsed by, or officially connected to Roblox Corporation in any way.
          “Roblox” is a registered trademark of Roblox Corporation and is used only for descriptive
          purposes.
        </p>
      </LegalSection>

      <LegalSection title="2. Minimum age and parental consent">
        <p>
          The Service is available only to people aged thirteen (13) or older. Registration by
          anyone under 13 is strictly prohibited. Any account identified as belonging to a person
          under 13 will be deleted without notice.
        </p>
        <p>
          Users aged 13 to 17 may use the Service only with the express permission of a parent or
          legal guardian, whose name and email address must be provided during registration. The
          parent or legal guardian acknowledges the social nature of the Service and accepts these
          Terms on behalf of the minor. We may request confirmation of this consent at any time and
          suspend the account while awaiting confirmation.
        </p>
        <p>
          Discovery features are designed to encourage interactions between profiles in similar age
          groups. Any adult who attempts to contact a minor inappropriately will be permanently
          banned and, where appropriate, reported to the competent authorities.
        </p>
      </LegalSection>

      <LegalSection title="3. User accounts">
        <p>
          You agree to provide accurate, current, and complete information when creating your
          account, including your Bloxspark username, Roblox username, language, and date of birth.
          You are solely responsible for keeping your credentials confidential and for all activity
          performed through your account.
        </p>
        <p>
          Username changes are limited to one change every seven (7) days. This restriction is
          enforced on the server to preserve the reliability of displayed identities and reduce
          impersonation.
        </p>
      </LegalSection>

      <LegalSection title="4. Conduct rules and prohibited content">
        <p>You must not publish, transmit, or distribute through the Service:</p>
        <ul>
          <li>
            sexual, sexually suggestive, or pornographic content, especially content involving
            minors;
          </li>
          <li>
            hateful, racist, sexist, homophobic, transphobic, ableist, or discriminatory content;
          </li>
          <li>harassment, threats, blackmail, doxxing, or any form of intimidation;</li>
          <li>
            violent or shocking content, or content that glorifies self-harm, suicide, or eating
            disorders;
          </li>
          <li>
            scams, phishing, or the sale or exchange of accounts, Robux, virtual items, or paid
            services;
          </li>
          <li>malicious links, malware, spam, or unsolicited advertising;</li>
          <li>content that infringes a third party's intellectual property rights;</li>
          <li>
            impersonation of another person, a moderator, or an employee of Roblox Corporation.
          </li>
        </ul>
        <p>
          You also agree not to collect other users' personal data, automate access to the Service
          through bots, scripts, or scraping, or bypass technical security or moderation measures.
        </p>
      </LegalSection>

      <LegalSection title="5. User-generated content">
        <p>
          You retain ownership of the content you publish, including avatar photos, your bio,
          messages, and voice messages. You grant Bloxspark a worldwide, non-exclusive, royalty-free
          license limited to hosting, storing, reproducing, and displaying that content solely to
          operate the Service. This license ends when you delete the relevant content, subject to
          temporary backup copies and legal retention obligations.
        </p>
        <p>
          You represent that you hold all rights required for the content you publish and warrant
          that it does not infringe any third-party rights.
        </p>
      </LegalSection>

      <LegalSection title="6. Moderation, reporting, and enforcement">
        <p>
          Profiles, messages, and conversations can be reported in the app. Reports are reviewed
          and, depending on severity and repeated violations, may result in a warning, content
          removal, temporary suspension, or permanent account deletion without compensation.
        </p>
        <p>
          You also have personal safety tools, including blocking a user, deleting a conversation,
          and limiting your profile's visibility. Blocking prevents further interaction and hides
          both profiles from each other.
        </p>
      </LegalSection>

      <LegalSection title="7. Service availability">
        <p>
          The Service is provided “as is” and “as available.” We work to maintain continuous
          availability, but we do not guarantee that the Service will be uninterrupted, error-free,
          or free from data loss. Maintenance, feature updates, or the discontinuation of certain
          features may occur at any time.
        </p>
      </LegalSection>

      <LegalSection title="8. Limitation of liability">
        <p>
          Bloxspark connects users but does not participate in their private interactions and does
          not guarantee the accuracy of information users provide or their behavior. To the maximum
          extent permitted by applicable law, Bloxspark is not liable for indirect damages arising
          from use of the Service, including harm related to relationships formed between users.
        </p>
        <p>
          We strongly recommend that you never share sensitive personal information such as your
          address, school, banking details, or Roblox account password. If you are a minor, never
          arrange an in-person meeting without the permission and presence of a responsible adult.
        </p>
      </LegalSection>

      <LegalSection title="9. Termination">
        <p>
          You may delete your account at any time from Settings. Deletion removes your profile,
          photos, swipes, and matches under the conditions described in the Privacy Policy. We may
          terminate or suspend your access if you violate these Terms.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes to these Terms">
        <p>
          We may change these Terms to reflect changes to the Service or applicable law. We will
          notify you in the app of any material change. Your continued use of the Service after the
          changes take effect constitutes acceptance of the updated Terms.
        </p>
      </LegalSection>

      <LegalSection title="11. Governing law and contact">
        <p>
          These Terms are governed by French law, without affecting any mandatory consumer
          protections that apply in your country of residence. If you have questions about these
          Terms, contact us through the in-app reporting form.
        </p>
      </LegalSection>
    </LegalPage>
  ),
});
