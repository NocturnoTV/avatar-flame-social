import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — Bloxspark" },
      {
        name: "description",
        content:
          "Bloxspark Terms of Use: accounts, Roblox connection, Sparks, Communities, subscriptions, content, moderation, copyright and liability.",
      },
      { property: "og:title", content: "Terms of Use — Bloxspark" },
      { property: "og:description", content: "The rules governing the Bloxspark service." },
    ],
  }),
  component: () => (
    <LegalPage title="Terms of Use" updated="Last updated: September 13, 2026">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Welcome to Bloxspark. These Terms of Use are long because we would rather be precise than
        vague about what you're agreeing to — please read them. If any part is unclear, you can
        reach us through the in-app Support center before you continue using the Service.
      </p>

      <LegalSection title="1. Purpose and acceptance">
        <p>
          These Terms of Use (the "Terms") form a binding agreement between you and Bloxspark
          governing your access to and use of the Bloxspark application, website, and related
          services (together, the "Service") — a social, discovery, and matchmaking network built
          around the Roblox player community. By creating an account, accessing the Service, or
          using it in any way, you accept these Terms in full. If you do not agree, you must not
          use the Service.
        </p>
        <p>
          Bloxspark is an independent, unofficial platform. It is not affiliated with, associated
          with, sponsored by, endorsed by, or in any way officially connected to Roblox
          Corporation, its subsidiaries, or its affiliates. "Roblox" and any related trademarks,
          service marks, trade names, and logos are the property of Roblox Corporation. We use
          them only to describe compatibility with and reference to the Roblox platform.
        </p>
        <p>
          These Terms incorporate by reference our{" "}
          <a href="/privacy" className="underline">
            Privacy Policy
          </a>{" "}
          and our{" "}
          <a href="/community-guidelines" className="underline">
            Community Guidelines
          </a>
          . Together they describe the full relationship between you and Bloxspark.
        </p>
      </LegalSection>

      <LegalSection title="2. Eligibility, minimum age, and parental consent">
        <p>
          The Service is available only to individuals aged thirteen (13) or older. Registration,
          account creation, or use of the Service by anyone under 13 is strictly prohibited,
          regardless of parental permission. Any account we identify, or that is reported to us,
          as belonging to a person under 13 will be suspended and deleted, along with associated
          content, without prior notice.
        </p>
        <p>
          Users aged 13 to 17 ("minor users") may use the Service only with the express permission
          of a parent or legal guardian. During onboarding, a minor user must provide the name and
          email address of a parent or legal guardian, who is deemed by that submission to have
          reviewed and accepted these Terms and the Privacy Policy on the minor's behalf. We may
          contact the parent or guardian to confirm this consent at any time, and may suspend the
          account until confirmation is received.
        </p>
        <p>
          Certain features are restricted or adapted for minor users, including narrower
          discovery/matching ranges intended to keep interactions within similar age groups and
          additional moderation sensitivity for reports involving a minor. These safeguards reduce
          risk but cannot eliminate it — see Section 9 (Sparks, matching, and your safety) below.
        </p>
        <p>
          By using the Service you also represent that your use does not violate any law
          applicable to you, including any local law that sets a higher minimum age than these
          Terms for the use of social or matchmaking-style services.
        </p>
      </LegalSection>

      <LegalSection title="3. Your account">
        <p>
          You agree to provide accurate, current, and complete information when creating and
          maintaining your account, including your Bloxspark username, your Roblox username,
          language, and date of birth. You are solely responsible for keeping your login
          credentials confidential and for all activity that occurs through your account, whether
          or not authorized by you. Notify us immediately through Support if you suspect
          unauthorized access.
        </p>
        <p>
          Username changes are limited to once every seven (7) days, enforced server-side, to
          preserve the reliability of displayed identities and reduce impersonation. You may not
          register an account using another person's name or identity, a name you don't have the
          right to use, or a name that impersonates Bloxspark staff, a moderator, or Roblox
          Corporation.
        </p>
        <p>
          We currently support at most a limited number of accounts associated with the same
          person for account-switching convenience; using multiple accounts to evade a
          suspension, manipulate Sparks matching, inflate engagement metrics, or harass another
          user is a violation of these Terms regardless of how many accounts are involved.
        </p>
      </LegalSection>

      <LegalSection title="4. Connecting your Roblox account">
        <p>
          Bloxspark lets you connect a Roblox account using Roblox's own OAuth 2.0 sign-in flow.
          When you choose to connect Roblox — whether to sign in or to link an existing Bloxspark
          account — you are redirected to Roblox's own website to authenticate and to explicitly
          authorize Bloxspark. We never see, request, or store your Roblox password; the
          authentication itself happens entirely on Roblox's infrastructure.
        </p>
        <p>Once authorized, Roblox shares with us only the following, limited information:</p>
        <ul>
          <li>your Roblox user ID (a numeric identifier);</li>
          <li>your Roblox username and display name;</li>
          <li>your public Roblox avatar image; and</li>
          <li>the timestamp of the authorization.</li>
        </ul>
        <p>We use this connection specifically to:</p>
        <ul>
          <li>let you sign in without creating a separate password;</li>
          <li>
            display a verified Roblox identity on your profile so other players know who they're
            talking to;
          </li>
          <li>reduce impersonation and fake-account creation;</li>
          <li>
            power Sparks matching signals and favorite-game display (see Section 9) using your
            self-selected favorite Roblox experiences — not data pulled from your Roblox account
            without your input; and
          </li>
          <li>prevent a single person from creating unlimited duplicate Bloxspark accounts.</li>
        </ul>
        <p>
          We do not use the Roblox connection to take any action on your behalf inside Roblox, to
          access your Robux balance, inventory, or purchase history, to post or message on your
          Roblox account, or to access private Roblox account settings. You can disconnect your
          Roblox account at any time from Settings; disconnecting may limit or disable features
          that depend on your Roblox identity (such as Sparks) until you reconnect. You can also
          revoke Bloxspark's access directly from your Roblox account security settings at any
          time, independently of anything you do inside Bloxspark.
        </p>
      </LegalSection>

      <LegalSection title="5. Bloxspark Premium (Spark Plus) and payments">
        <p>
          Bloxspark offers an optional paid subscription, Bloxspark Premium (also referred to as
          "Spark Plus"), that unlocks additional customization and features described in the app
          at the time of purchase (for example, profile styling and chat personalization). Feature
          availability may change over time as the Service evolves.
        </p>
        <p>
          Payments are processed by Stripe, an independent third-party payment processor. Bloxspark
          never receives or stores your full card number, CVC, or bank credentials — Stripe handles
          that data under its own terms and privacy policy. We retain only what's needed to manage
          your subscription: its status (active, cancelled, past due), its billing period, and its
          expiration or renewal date.
        </p>
        <p>
          Unless stated otherwise at checkout, subscriptions renew automatically at the end of each
          billing period until cancelled. You can cancel at any time through the payment provider's
          customer portal or by contacting Support; cancelling stops future renewals but does not
          automatically refund the current billing period. Refunds, where legally required or
          granted at our discretion, are processed back to the original payment method.
          Administrator-granted Premium (for example, promotional or support-goodwill grants) is
          not a purchase and carries no billing relationship or refund right.
        </p>
        <p>
          We may change the price or composition of Bloxspark Premium going forward; changes will
          not retroactively alter a period you have already paid for.
        </p>
      </LegalSection>

      <LegalSection title="6. Conduct rules and prohibited content">
        <p>You must not publish, transmit, upload, or distribute through the Service anything that:</p>
        <ul>
          <li>
            is sexual, sexually suggestive, or pornographic, especially anything involving or
            appearing to involve a minor, which we treat as a zero-tolerance violation reported to
            the relevant authorities;
          </li>
          <li>is hateful, racist, sexist, homophobic, transphobic, ableist, or discriminatory;</li>
          <li>harasses, threatens, blackmails, doxxes, stalks, or intimidates any person;</li>
          <li>
            is violent or graphic, or glorifies self-harm, suicide, disordered eating, or
            extremist violence;
          </li>
          <li>
            scams or defrauds others, including phishing, or the sale, trade, or solicitation of
            Robux, virtual items, accounts, or real-money trading of any kind;
          </li>
          <li>contains malicious links, malware, spam, or unsolicited commercial advertising;</li>
          <li>infringes a third party's intellectual property or other legal rights (see Section 11); or</li>
          <li>
            impersonates another person, a Bloxspark moderator or employee, or Roblox Corporation
            or its staff.
          </li>
        </ul>
        <p>You also agree not to:</p>
        <ul>
          <li>collect or harvest other users' personal data without consent;</li>
          <li>
            automate access to the Service through bots, scripts, scrapers, or unauthorized
            third-party tools, including to inflate metrics such as views, likes, or Sparks
            matches;
          </li>
          <li>
            attempt to bypass, disable, or interfere with security, moderation, rate-limiting, or
            age-protection features, including the automated language-filtering described in
            Section 8; or
          </li>
          <li>reverse-engineer, decompile, or attempt to extract the source code of the Service, except as permitted by law.</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. User-generated content and license">
        <p>
          You retain ownership of the content you create and publish through the Service —
          including avatar photos, banners, bio text, videos, comments, community posts, messages,
          and voice messages ("Your Content"). By publishing Your Content, you grant Bloxspark a
          worldwide, non-exclusive, royalty-free, sublicensable license to host, store, cache,
          reproduce, adapt (for formats such as thumbnails), and display Your Content solely to
          operate, promote within the app, and improve the Service. This license ends when you
          delete the relevant content or your account, subject to (a) temporary backup or cache
          copies that age out in the ordinary course of operation, and (b) copies we are legally
          required or permitted to retain, such as reports under active review.
        </p>
        <p>
          You represent and warrant that you own or have all rights necessary to publish Your
          Content, and that it does not infringe or violate any third party's rights, including
          intellectual property and privacy rights. Content published in a public Community or
          public video may be visible to any user of the Service, including people you have not
          matched or connected with.
        </p>
      </LegalSection>

      <LegalSection title="8. Moderation, reporting, and automated enforcement">
        <p>
          Profiles, videos, comments, community posts, and private messages can be reported from
          within the app. Reports are reviewed by our Trust &amp; Safety team and, depending on
          severity and history, may result in a warning, content removal, temporary suspension, or
          permanent account termination without compensation or refund of any paid subscription.
        </p>
        <p>
          To respond faster to clearly abusive language, Bloxspark also runs an automated
          detection system that compares message and comment text against an administrator-managed
          list of banned words (maintained in English and French, with more languages added over
          time). When a match is detected, the system automatically sends the other participant(s)
          in that conversation a safety notice, in their own language, reminding them to keep
          Bloxspark respectful and encouraging them to contact Trust &amp; Safety if they are a
          witness or victim of a rule violation. This automated check happens on our servers as
          part of delivering the message — see the Privacy Policy for how that data is used and
          retained.
        </p>
        <p>
          You also have personal safety tools available at any time, including blocking a user
          (which prevents further interaction and hides both profiles from each other), muting or
          leaving a group conversation, hiding a creator or category from your feed, and choosing
          whether your online/"active recently" status is visible to others.
        </p>
      </LegalSection>

      <LegalSection title="9. Sparks, matching, and your safety">
        <p>
          Sparks is an opt-in feature that suggests other players based on shared favorite games,
          age range, country, and language you provide, so that you can find people to play with.
          Sparks is designed around friendship and gaming — it is not intended, marketed, or
          moderated as a romantic dating service, and you should not treat matches as vetted or
          background-checked in any way.
        </p>
        <p>
          Bloxspark facilitates introductions but does not participate in, supervise, or guarantee
          the safety of any interaction that follows a match or a message. We strongly recommend
          that you never share sensitive personal information — your address, school, phone
          number, financial details, or your Roblox account password — with another user. If you
          are a minor, never agree to meet another user in person, and tell a parent or guardian if
          anyone asks you to.
        </p>
      </LegalSection>

      <LegalSection title="10. Communities">
        <p>
          Communities let users create and join spaces organized around a shared game or interest,
          with their own posts, discussions, and (as those features roll out) events and media. A
          Community's creator and any moderators or admins they designate are responsible for
          setting and enforcing that Community's own rules, in addition to these Terms and our
          Community Guidelines, which always apply and always take precedence in case of conflict.
        </p>
        <p>
          We may remove a Community, its content, or its members, or reassign or revoke a
          Community's moderation roles, if it is used to violate these Terms, to harass or evade a
          suspension, or to host content that would not be allowed anywhere else on Bloxspark. A
          Community being publicly listed does not mean Bloxspark has reviewed or endorses its
          content in advance.
        </p>
      </LegalSection>

      <LegalSection title="11. Intellectual property and copyright (DMCA)">
        <p>
          Bloxspark's name, logo, interface design, and underlying software are owned by us or our
          licensors and are protected by intellectual property law. Nothing in these Terms grants
          you rights in Bloxspark's own branding or software beyond what's needed to use the
          Service normally.
        </p>
        <p>
          If you believe content on Bloxspark infringes your copyright, submit a notice through the
          in-app Support center (category: "Copyright / DMCA") including: a description of the
          copyrighted work, the specific content and its location in the app, your contact
          information, a statement that you have a good-faith belief the use is unauthorized, and a
          statement made under penalty of perjury that the notice is accurate and that you are the
          rights holder or authorized to act on their behalf. We will review valid notices, remove
          or disable access to the identified content where warranted, and notify the user who
          posted it. A user who believes their content was removed in error may submit a
          counter-notice through the same channel. We terminate the accounts of users we determine
          to be repeat infringers.
        </p>
      </LegalSection>

      <LegalSection title="12. Service availability and changes">
        <p>
          The Service is provided "as is" and "as available." We work to keep it reliable, and our
          current Support center includes a live status page, but we do not guarantee that the
          Service will be uninterrupted, error-free, or free of data loss. We may add, change, or
          remove features, impose limits on certain features, or restrict access to parts of the
          Service, at any time, with or without notice.
        </p>
      </LegalSection>

      <LegalSection title="13. Disclaimers and limitation of liability">
        <p>
          To the maximum extent permitted by applicable law, Bloxspark and its team disclaim all
          warranties, express or implied, regarding the Service, including implied warranties of
          merchantability, fitness for a particular purpose, and non-infringement. We do not
          guarantee the accuracy of information other users provide, their real identity, age, or
          intentions, or the outcome of any interaction, match, or transaction between users.
        </p>
        <p>
          To the maximum extent permitted by applicable law, Bloxspark is not liable for indirect,
          incidental, special, consequential, or punitive damages arising from your use of the
          Service, including harm arising from interactions or relationships formed between users,
          even if we have been advised of the possibility of such damages. Nothing in these Terms
          limits liability that cannot be limited under applicable law, including liability for
          gross negligence, willful misconduct, or death or personal injury caused by our
          negligence where the law says so.
        </p>
      </LegalSection>

      <LegalSection title="14. Indemnification">
        <p>
          You agree to defend, indemnify, and hold harmless Bloxspark and its team from any claim,
          liability, damages, loss, or expense (including reasonable legal fees) arising from your
          use of the Service, Your Content, or your violation of these Terms, except to the extent
          caused by our own violation of applicable law.
        </p>
      </LegalSection>

      <LegalSection title="15. Termination">
        <p>
          You may delete your account at any time from Settings. Deletion removes your profile,
          photos, videos, swipes, matches, and messages under the conditions described in the
          Privacy Policy. We may suspend or terminate your access, with or without notice, if you
          violate these Terms, if required by law, or if continued access would create risk or
          legal exposure for us or another user. Sections of these Terms that by their nature
          should survive termination (including Sections 7, 11, 13, and 14) continue to apply after
          your account is closed.
        </p>
      </LegalSection>

      <LegalSection title="16. Changes to these Terms">
        <p>
          We may update these Terms to reflect changes to the Service, our practices, or applicable
          law. We will notify you in the app of any material change before it takes effect where
          feasible. Your continued use of the Service after a change takes effect constitutes
          acceptance of the updated Terms; if you don't agree with a change, you should stop using
          the Service and delete your account.
        </p>
      </LegalSection>

      <LegalSection title="17. Severability, waiver, and entire agreement">
        <p>
          If any provision of these Terms is found unenforceable, the remaining provisions remain
          in full effect, and the unenforceable provision will be interpreted to best reflect its
          original intent. Our failure to enforce a provision is not a waiver of our right to do so
          later. These Terms, together with the Privacy Policy and Community Guidelines, are the
          entire agreement between you and Bloxspark regarding the Service.
        </p>
      </LegalSection>

      <LegalSection title="18. Governing law and contact">
        <p>
          These Terms are governed by French law, without prejudice to any mandatory consumer-
          protection provisions of the law of your country of habitual residence, which continue to
          apply where applicable. If you have questions about these Terms, contact us through the
          in-app Support center.
        </p>
      </LegalSection>
    </LegalPage>
  ),
});
