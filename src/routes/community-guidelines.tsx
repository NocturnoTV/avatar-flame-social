import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const Route = createFileRoute("/community-guidelines")({
  head: () => ({
    meta: [
      { title: "Community Guidelines — Bloxspark" },
      {
        name: "description",
        content: "The respect, safety, and kindness guidelines everyone must follow on Bloxspark.",
      },
      { property: "og:title", content: "Community Guidelines — Bloxspark" },
      {
        property: "og:description",
        content: "A safe and respectful community for Roblox players.",
      },
      { property: "og:url", content: "https://bloxspark.app/community-guidelines" },
      { name: "robots", content: "index, follow" },
    ],
    links: [{ rel: "canonical", href: "https://bloxspark.app/community-guidelines" }],
  }),
  component: () => (
    <LegalPage title="Community Guidelines" updated="Last updated: September 12, 2026">
      <LegalSection title="The Bloxspark spirit">
        <p>
          Bloxspark is a place to meet other Roblox players, talk about your favorite games, build
          teams, and make friends. Everyone should feel safe here, regardless of age, country,
          language, or play style.
        </p>
      </LegalSection>

      <LegalSection title="1. Respect comes first">
        <ul>
          <li>No insults, ridicule, harassment, or threats.</li>
          <li>No racism, sexism, homophobia, transphobia, ableism, or discrimination.</li>
          <li>If someone does not reply or blocks you, respect their decision and move on.</li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Protecting minors">
        <ul>
          <li>
            The Service is not available to anyone under 13. Users aged 13 to 17 need permission
            from a parent or legal guardian.
          </li>
          <li>Sexual or suggestive content is never allowed in any form.</li>
          <li>
            An adult who behaves inappropriately toward a minor will be permanently banned and may
            be reported to the authorities.
          </li>
          <li>Never ask a minor to meet outside the app.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Protect your information">
        <ul>
          <li>Never share your Roblox or Bloxspark password.</li>
          <li>Do not share your address, school, phone number, or banking details.</li>
          <li>Be careful with links sent in messages. Free Robux scams are common.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Be yourself">
        <ul>
          <li>Use your real Roblox username and photos of your avatar.</li>
          <li>Do not impersonate others or use a false age or fake profile.</li>
          <li>You can change your username only once every 7 days.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. No trading or spam">
        <ul>
          <li>Do not sell or trade accounts, Robux, items, or services.</li>
          <li>No advertising, chain messages, or mass promotion.</li>
          <li>No bots, scripts, or automation.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Reporting and blocking">
        <p>
          If someone's behavior makes you uncomfortable, use the report button on their profile or
          in the conversation, then block them. We review reports and may issue a warning, suspend
          the account, or permanently ban the user. If you are in danger, tell a trusted adult and
          contact your country's emergency services.
        </p>
      </LegalSection>

      <LegalSection title="7. Consequences">
        <p>
          Depending on the severity of the violation, enforcement may include a warning, content
          removal, feature restrictions, temporary suspension, or permanent account deletion. The
          most serious violations, including content involving minors, threats, or organized scams,
          result in an immediate ban without warning.
        </p>
      </LegalSection>
    </LegalPage>
  ),
});
