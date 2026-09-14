import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy - Bloxspark" },
      {
        name: "description",
        content:
          "How Bloxspark collects, uses, shares, and protects your data - including what we receive from Roblox's OAuth sign-in and exactly why - and the rights available to you.",
      },
      { property: "og:title", content: "Privacy Policy - Bloxspark" },
      { property: "og:description", content: "Your data and your rights, explained clearly." },
      { property: "og:url", content: "https://bloxspark.app/privacy" },
      { name: "robots", content: "index, follow" },
    ],
    links: [{ rel: "canonical", href: "https://bloxspark.app/privacy" }],
  }),
  component: () => (
    <LegalPage title="Privacy Policy" updated="Last updated: September 14, 2026">
      <p className="text-sm leading-relaxed text-muted-foreground">
        This policy is intentionally detailed, including a dedicated explanation of the Roblox
        sign-in connection, because we'd rather over-explain than leave you guessing about what we
        do with your information.
      </p>

      <LegalSection title="1. Who is responsible for your data?">
        <p>
          Bloxspark is the data controller responsible for the personal data collected through the
          app. Bloxspark is an independent service and is not affiliated with Roblox Corporation.
          This policy explains what data we collect, why, how long we keep it, who else sees it, and
          how you can exercise your rights over it.
        </p>
      </LegalSection>

      <LegalSection title="2. Data we collect">
        <p>We collect only the data needed to operate the Service:</p>
        <ul>
          <li>
            <strong>Account data</strong>: email address (if you sign in with email), technical
            account identifier, sign-in method, and account creation date.
          </li>
          <li>
            <strong>Profile data</strong>: Bloxspark username, language, date of birth (used to
            calculate age and apply minor protections), bio, country, favorite games, external link,
            profile decorations (banner, frame, theme), and - for Bloxspark Premium subscribers -
            chosen profile font and glow style.
          </li>
          <li>
            <strong>Roblox OAuth data</strong>: if you connect or sign in with Roblox, we receive
            your Roblox user ID, Roblox username, display name, avatar image, and the time of
            connection. Section 3 below explains this in full detail - what we get, what we never
            get, and exactly why we use it.
          </li>
          <li>
            <strong>Parental data</strong>: for users aged 13 to 17, the name and email address of a
            parent or legal guardian and a record of their consent.
          </li>
          <li>
            <strong>Content</strong>: uploaded avatar photos, profile photos, banners, videos and
            their captions, comments, community posts, text messages, voice messages, and images
            sent in conversations, plus any reactions you leave on a message or comment.
          </li>
          <li>
            <strong>Sparks and social data</strong>: swipes (like, pass, and Super Spark), matches,
            follows, blocked users, and community memberships.
          </li>
          <li>
            <strong>Activity and presence data</strong>: conversation activity, last-active and
            last-read timestamps, your "appear online" and "do not disturb" preferences, watch time
            and view counts on videos, and unique-viewer records used to keep view counts honest
            (one real view per distinct account).
          </li>
          <li>
            <strong>Trust &amp; Safety data</strong>: reports you file or that are filed against you
            (including the reported content and your account details), automated safety-notice
            triggers from our banned-word detection system (see Section 4), moderation notes,
            warnings, and support tickets you submit.
          </li>
          <li>
            <strong>Payment data</strong>: for Bloxspark Premium, the status, billing period, and
            expiration date of your subscription. We do not collect or store your card number, CVC,
            or bank details - those go directly to Stripe. See Section 6.
          </li>
          <li>
            <strong>Technical data</strong>: sign-in logs and data strictly required for security,
            abuse prevention, and diagnosing bugs you report, including IP address, device and
            browser type, operating system, language, timestamps, referring page, crash details, and
            an approximate location inferred from IP when needed for security or localization.
          </li>
          <li>
            <strong>Device permissions</strong>: content you choose through the camera, microphone,
            or photo library, and a push-notification token if you enable notifications. We do not
            access these sources before you grant the relevant operating-system permission.
          </li>
        </ul>
        <p>
          We do not ask for your Roblox password, banking information, or postal address. Never
          share this information with another user, and never enter your Roblox password anywhere
          except Roblox's own website.
        </p>
      </LegalSection>

      <LegalSection title="3. The Roblox connection, in detail: what, why, and what we don't do">
        <p>
          Connecting Roblox uses Roblox's own OAuth 2.0 authorization flow. You're redirected to
          Roblox to log in and explicitly approve the connection; Bloxspark never sees or handles
          your Roblox password, and the authentication step itself happens entirely on Roblox's own
          servers, governed by Roblox's own terms and privacy policy.
        </p>
        <p>Once you approve the connection, Roblox shares exactly four things with us:</p>
        <ul>
          <li>your Roblox user ID;</li>
          <li>your Roblox username and current display name;</li>
          <li>the URL of your public Roblox avatar image; and</li>
          <li>the timestamp of that authorization.</li>
        </ul>
        <p>We use that information only to:</p>
        <ul>
          <li>authenticate you, as an alternative to an email/password sign-in;</li>
          <li>show a verified Roblox identity on your Bloxspark profile;</li>
          <li>reduce impersonation and duplicate or fake account creation;</li>
          <li>
            support Sparks matching and the games you choose to feature on your profile - your
            favorite games are picked by you, not read automatically from your Roblox library; and
          </li>
          <li>keep the connection status (connected, last synced) visible to you in Settings.</li>
        </ul>
        <p>We explicitly do not, and cannot, use this connection to:</p>
        <ul>
          <li>see your Robux balance, purchase history, or inventory;</li>
          <li>post, message, or take any action inside Roblox on your behalf;</li>
          <li>access private Roblox account or security settings; or</li>
          <li>read your Roblox friends list or private Roblox activity.</li>
        </ul>
        <p>
          You can disconnect Roblox at any time from Bloxspark Settings, which deletes the stored
          Roblox identifiers and avatar link from your profile (some features that depend on it,
          like Sparks, become unavailable until you reconnect). Independently of that, you can
          revoke Bloxspark's authorization at any time from your own Roblox account's security
          settings - doing so on Roblox's side will also break the connection on ours the next time
          we try to use it.
        </p>
        <p>
          Bloxspark uses Roblox's authorization-code flow and requests only the OpenID Connect
          scopes shown on Roblox's consent screen, such as <code>openid</code> and
          <code> profile</code>. We use state validation and PKCE where supported to protect the
          redirect. Short-lived access tokens and rotating refresh tokens are kept server-side,
          encrypted or otherwise access-controlled, and are never placed in public profiles,
          analytics, logs intended for users, or advertising systems. We revoke or delete tokens
          when you disconnect, delete your account, or when continued access is no longer needed.
        </p>
      </LegalSection>

      <LegalSection title="3A. Mobile permissions and notifications">
        <p>
          The mobile app may request camera access to record a video or story, microphone access to
          record sound or a voice message, photo-library access to select media, and notification
          permission to deliver messages, moderation notices, security alerts, and activity you
          choose to receive. Each permission is requested in context. You can refuse or revoke it in
          device settings; the rest of the app remains available except for the feature that
          requires that permission. Bloxspark does not currently require precise device location.
        </p>
      </LegalSection>

      <LegalSection title="3B. Recommendations, measurements, and automated decisions">
        <p>
          We use watch time, completion, likes, comments, follows, blocks, reports, language,
          country, age range, favorite games, and recent activity to rank Discover, Sparks, search,
          and creator insights. Unique-view records help distinguish viewers and remove suspected
          automated or repeated traffic. You can affect recommendations by hiding content,
          unfollowing, blocking, reporting, and changing interests or favorite games.
        </p>
        <p>
          Automated systems may detect spam, abusive words, suspicious engagement, or content that
          should receive less distribution. Significant account penalties receive human review when
          reasonably available, and you may contest a moderation decision through Support. We do not
          use automated decisions that produce legal or similarly significant effects without the
          safeguards required by applicable law.
        </p>
      </LegalSection>

      <LegalSection title="4. Automated safety detection and Trust & Safety notices">
        <p>
          To respond quickly to clearly abusive language, messages and comments are automatically
          checked against an administrator-managed list of banned words (currently maintained in
          English and French). This check happens as part of delivering your message - the content
          itself is processed the same way any message is (see retention in Section 8) and is not
          shared outside Bloxspark for this purpose.
        </p>
        <p>
          When a match is detected, the system sends the other participant(s) in that conversation
          an automatic safety notice, translated into their own selected language, reminding
          everyone to keep the conversation respectful and inviting them to contact Trust &amp;
          Safety if they are a witness or victim of a rule violation. The notice itself does not
          quote the flagged message back to anyone; it's a standing, generic reminder.
        </p>
      </LegalSection>

      <LegalSection title="5. Purposes and legal bases">
        <ul>
          <li>
            <strong>Providing the Service</strong> (performance of a contract): account creation,
            profile display, Sparks recommendations and matching, messaging, Communities, video
            feed, and notifications.
          </li>
          <li>
            <strong>Protecting minors and maintaining safety</strong> (legal obligation and
            legitimate interest): verifying declared age, obtaining parental consent, moderation,
            automated abusive-language detection, and preventing abuse and fraud.
          </li>
          <li>
            <strong>Billing</strong> (performance of a contract): processing and administering your
            Bloxspark Premium subscription through our payment processor.
          </li>
          <li>
            <strong>Improving the Service</strong> (legitimate interest): aggregated and anonymized
            measurement of feature usage, and diagnosing bugs you report through Support.
          </li>
          <li>
            <strong>Service communications</strong> (performance of a contract): confirmation
            emails, password resets, security alerts, and support-ticket responses.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Who we share data with">
        <p>
          We do not sell your personal data, and we do not use it for third-party targeted
          advertising. We share data only with service providers who act on our instructions (data
          processors) and only to the extent needed to run the Service:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> - our database, authentication, and file-storage
            infrastructure provider. Nearly all data described in Section 2 is stored on Supabase's
            infrastructure, protected by the access rules described in Section 7.
          </li>
          <li>
            <strong>Stripe</strong> - our payment processor for Bloxspark Premium. Stripe receives
            and stores your payment details directly under its own privacy policy; we only receive
            your subscription status back from Stripe.
          </li>
          <li>
            <strong>Roblox Corporation</strong> - acts as the identity provider when you choose to
            connect or sign in with Roblox, under the OAuth flow described in Section 3. We send
            Roblox only the standard OAuth authorization request; Roblox does not receive your
            Bloxspark content or activity from us.
          </li>
        </ul>
        <p>
          Data may also be disclosed to competent authorities when required by law, in response to
          valid legal process, or when necessary to protect a person's physical safety - especially
          that of a minor.
        </p>
      </LegalSection>

      <LegalSection title="7. Visibility of your information to other users">
        <p>
          Your username, Roblox username, age, country, language, bio, favorite games, decorations,
          videos, photos, and community memberships are visible to other users on your public
          profile and in Sparks, Discover, and Communities, depending on the visibility settings you
          choose. Your email address, exact date of birth, parental contact information, and the
          fact that Sparks is opt-in mean none of that is displayed publicly unless you explicitly
          share it.
        </p>
        <p>
          Private and group messages are accessible only to conversation participants and, when a
          valid report is submitted, to the Trust &amp; Safety team reviewing it. Community posts
          you make in a public Community are visible to anyone who can see that Community.
        </p>
      </LegalSection>

      <LegalSection title="8. Security">
        <p>
          Access to data is protected through authentication, encrypted communications (HTTPS), and
          database-level access rules (row-level security) that limit each account to its own data
          and to the conversations, communities, and content it actually participates in. Photos,
          videos, and voice messages are stored in private storage locations accessible only through
          short-lived signed links generated at the moment they're displayed to an authorized
          viewer.
        </p>
      </LegalSection>

      <LegalSection title="9. Retention periods">
        <ul>
          <li>Account and profile data: retained while the account remains active.</li>
          <li>
            Messages, videos, photos, and community posts: retained until they or the account are
            deleted.
          </li>
          <li>
            Roblox OAuth identifiers: retained while the connection is active; deleted when you
            disconnect Roblox or delete your account.
          </li>
          <li>
            Subscription and billing status: retained for the life of the subscription and for a
            reasonable period after for accounting and dispute purposes, as required by law.
          </li>
          <li>
            Security logs, ordinary reports, and support tickets: normally retained for up to twelve
            (12) months after resolution. Records involving serious abuse, child safety, fraud,
            legal claims, or a valid preservation request may be kept longer where necessary and
            permitted by law.
          </li>
          <li>
            After account deletion: erased within thirty (30) days, except where retention is
            required by law or needed to prevent repeated serious abuse (for example, a record
            sufficient to enforce a ban).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="10. International data transfers">
        <p>
          Our service providers may process data in countries other than your own, including outside
          the European Economic Area. Where that happens, we rely on the safeguards those providers
          make available (such as standard contractual clauses) to ensure your data continues to
          receive an adequate level of protection.
        </p>
      </LegalSection>

      <LegalSection title="11. Children's privacy">
        <p>
          The Service is not directed to, and must not be used by, children under 13. We do not
          knowingly collect personal data from anyone under 13. If we learn that we have collected
          data from a child under 13, we will delete the account and associated data promptly. If
          you believe a child under 13 is using Bloxspark, please report it through the in-app
          Support center so we can investigate.
        </p>
        <p>
          For users aged 13 to 17, we collect a parent or guardian's name and email address when
          required to obtain and verify authorization, respond to a youth-safety issue, or satisfy
          local law. In France, a user under 15 cannot alone provide valid consent for consent-based
          processing by an online service; joint authorization from the minor and holder of parental
          responsibility is required. Age thresholds vary by country. We make reasonable efforts to
          verify required authorization and do not treat the child's entry of an adult's email
          address as conclusive proof of consent.
        </p>
        <p>
          We do not use profiling-based advertising for users we know are minors. We limit access to
          exact birth dates and parental details, use age information to apply safety rules, and may
          restrict discovery or contact features where needed to protect a minor. Parents and
          guardians may request access, correction, or deletion through Support.
        </p>
      </LegalSection>

      <LegalSection title="12. Your rights">
        <p>
          Under the GDPR and other applicable regulations, you have the right to access, correct,
          erase, restrict, object to the processing of, and receive a portable copy of your data.
          You may also withdraw consent at any time where processing is based on it. Legal guardians
          may exercise these rights on behalf of a minor.
        </p>
        <p>
          You can exercise most of these rights directly in the app: edit your profile, delete
          photos, videos, or messages, disconnect your Roblox account, or permanently delete your
          account from Settings. For any other request - including a data export - contact us
          through the in-app Support center. You may also lodge a complaint with your local data
          protection supervisory authority.
        </p>
      </LegalSection>

      <LegalSection title="13. Cookies and local storage">
        <p>
          Bloxspark does not use advertising cookies or third-party trackers. We use browser local
          storage only for things that make the app work the way you left it: your session, your
          language, your light/dark theme, and per-conversation display preferences like chat
          wallpaper. This data stays on your device and is never sent to us or to any other user.
        </p>
      </LegalSection>

      <LegalSection title="13A. Apple App Privacy and Google Play Data Safety disclosures">
        <p>
          The privacy answers shown in an app-store listing must accurately describe the specific
          mobile build, every included software development kit, and every data flow. Depending on
          the features enabled in that build, disclosures may include contact information,
          identifiers, user content, purchases, product interaction, diagnostics, and coarse
          location inferred from IP. Data may be linked to your account when needed to provide the
          Service, secure it, personalize it, or measure it. Bloxspark does not sell this data or
          use it for third-party targeted advertising.
        </p>
        <p>
          If an app-store disclosure and this policy appear inconsistent, contact Support. We will
          investigate and correct the inaccurate disclosure or data practice. Store forms are a
          summary and do not replace this policy.
        </p>
      </LegalSection>

      <LegalSection title="14. Changes to this policy">
        <p>
          We may update this policy as the Service evolves. We will notify you in the app before any
          material change takes effect. Continued use of the Service after a change takes effect
          constitutes acceptance of the updated policy.
        </p>
      </LegalSection>

      <LegalSection title="15. Contact">
        <p>
          Questions about this Privacy Policy, or requests to exercise your rights, can be sent
          through the in-app Support center at any time.
        </p>
      </LegalSection>
    </LegalPage>
  ),
});
