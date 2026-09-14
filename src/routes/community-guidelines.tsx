import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const Route = createFileRoute("/community-guidelines")({
  head: () => ({
    meta: [
      { title: "Community Guidelines | Bloxspark" },
      {
        name: "description",
        content: "Bloxspark rules for safe, respectful Roblox community interactions.",
      },
      { property: "og:title", content: "Community Guidelines | Bloxspark" },
      {
        property: "og:description",
        content: "The safety rules that apply everywhere on Bloxspark.",
      },
      { property: "og:url", content: "https://bloxspark.app/community-guidelines" },
      { name: "robots", content: "index, follow" },
    ],
    links: [{ rel: "canonical", href: "https://bloxspark.app/community-guidelines" }],
  }),
  component: () => (
    <LegalPage title="Community Guidelines" updated="Last updated: September 14, 2026">
      <p className="text-sm leading-7 text-muted-foreground">
        These rules apply to every part of Bloxspark, including usernames, avatars, profiles,
        videos, stories, audio, captions, hashtags, comments, GIFs, messages, Sparks, Communities,
        links, and live or future interactive features. Context matters, but jokes, coded language,
        altered spelling, private groups, and off-platform instructions do not excuse harm.
      </p>

      <LegalSection title="1. Our standard for the community">
        <p>
          Bloxspark helps Roblox players discover creators, games, and people to play with. Treat
          people with respect, share only content you have the right to share, and never use the
          Service to place another person at risk. We may remove content that creates a meaningful
          safety risk even when it is not expressly listed below.
        </p>
        <ul>
          <li>Do not harass, exploit, deceive, threaten, or expose another person.</li>
          <li>Do not publish sexual, hateful, violent, fraudulent, or illegal content.</li>
          <li>Do not manipulate engagement, reports, recommendations, or account systems.</li>
          <li>Use report and block tools when an interaction becomes unsafe.</li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Age, youth safety, and adult responsibility">
        <p>
          Bloxspark is for people aged 13 and older. Anyone under 13 must not create or use an
          account. Users aged 13 to 17 must have the permission required by the law where they live.
          Adults must maintain clear, age-appropriate boundaries with minors.
        </p>
        <ul>
          <li>
            Never ask a minor for sexual content, intimate images, secrecy, or an in-person meeting.
          </li>
          <li>
            Never pressure a minor to move to an encrypted, disappearing, or less moderated service.
          </li>
          <li>
            Do not request a minor's address, school, live location, phone number, or private
            contact details.
          </li>
          <li>Do not sexualize young-looking people, youth-focused avatars, or school settings.</li>
          <li>
            Do not misrepresent your age to access another age group or evade a safety control.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Child sexual abuse and exploitation: zero tolerance">
        <p>
          Child sexual abuse material, grooming, sextortion, sexual solicitation of minors,
          trafficking, and any attempt to obtain or distribute intimate content involving a minor
          are prohibited. This includes fictionalized, generated, altered, blurred, linked, or
          off-platform material when it sexualizes or exploits a minor.
        </p>
        <p>
          We remove this material, permanently disable involved accounts, preserve relevant evidence
          when legally permitted, and report apparent child exploitation to competent authorities or
          designated reporting bodies when required. Never download, save, forward, or repost
          suspected material. Report it immediately. If a child is in immediate danger, contact
          local emergency services and a trusted adult.
        </p>
      </LegalSection>

      <LegalSection title="4. Sexual content and unwanted romantic conduct">
        <p>
          Pornography, nudity, sexual acts, fetish content, sexual services, explicit sexual
          language, and requests for intimate images are not allowed. Sexualized depictions of
          Roblox characters or avatars are also prohibited. Educational or newsworthy context may be
          considered only when it is age-appropriate and not graphic.
        </p>
        <p>
          Sparks is for friendship and gaming. Bloxspark does not permit anonymous sexual chat,
          random sexual matching, escort services, or persistent romantic or sexual advances after a
          person has declined, stopped replying, unmatched, or blocked you.
        </p>
      </LegalSection>

      <LegalSection title="5. Harassment, bullying, hate, and degrading conduct">
        <ul>
          <li>
            No repeated insults, humiliation, dogpiling, stalking, blackmail, or intimidation.
          </li>
          <li>
            No slurs, dehumanization, exclusion, or attacks based on a protected characteristic.
          </li>
          <li>No wishing death, illness, or serious harm on another person.</li>
          <li>
            No coordinated abuse, false mass reports, or directing followers to target someone.
          </li>
          <li>
            No sharing private conversations to shame a person without a legitimate safety reason.
          </li>
        </ul>
        <p>
          Criticism of ideas, games, and public conduct is allowed when it does not become targeted
          abuse. Satire and counterspeech are assessed in context and must not disguise harassment.
        </p>
      </LegalSection>

      <LegalSection title="6. Violence, dangerous acts, and self-harm">
        <p>
          Do not threaten, celebrate, instruct, or encourage real-world violence, terrorism,
          self-harm, suicide, eating disorders, or dangerous challenges. Graphic injury or death is
          prohibited except where limited documentary context makes it clearly newsworthy and it is
          appropriately restricted. Credible threats may be referred to emergency services or law
          enforcement.
        </p>
        <p>
          Supportive discussion about recovery is allowed. Do not provide methods, rankings,
          encouragement, or graphic details. An in-app report is not an emergency service.
        </p>
      </LegalSection>

      <LegalSection title="7. Privacy, personal information, and off-platform safety">
        <ul>
          <li>
            No doxxing or publishing an address, school, live location, private phone number,
            password, or financial information.
          </li>
          <li>
            No non-consensual intimate imagery, secret recordings, or threats to reveal private
            material.
          </li>
          <li>No collecting, scraping, selling, or combining user data without permission.</li>
          <li>
            No encouraging users, especially minors, to bypass family, platform, or safety controls.
          </li>
        </ul>
        <p>
          Protect your Roblox and Bloxspark credentials. Bloxspark staff will never ask for your
          password, authentication code, Robux, or gift cards in a message.
        </p>
      </LegalSection>

      <LegalSection title="8. Authenticity, impersonation, and deceptive media">
        <p>
          Do not impersonate another user, creator, moderator, Bloxspark, Roblox, or a public
          organization. Fan and parody accounts must be clearly labeled and must not mislead people.
          Do not use edited, synthetic, or AI-generated media to falsely show a real person saying
          or doing something harmful. Label realistic synthetic media when it could be mistaken for
          real.
        </p>
      </LegalSection>

      <LegalSection title="9. Scams, Robux, accounts, and malicious activity">
        <ul>
          <li>No phishing, fake giveaways, advance-fee schemes, or promises of free Robux.</li>
          <li>
            No buying, selling, lending, or trading Roblox or Bloxspark accounts and credentials.
          </li>
          <li>
            No malicious links, malware, token theft, credential harvesting, or security bypass
            instructions.
          </li>
          <li>
            No unauthorized sale of virtual items, currency, cheats, exploits, or boosting services.
          </li>
          <li>
            No requests for payment that conceal the recipient, price, recurring nature, or purpose.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="10. Spam, automation, and metric manipulation">
        <p>
          Do not use bots, scripts, purchased traffic, engagement exchanges, duplicate accounts, or
          coordinated behavior to inflate views, likes, follows, comments, matches, or rankings.
          Repetitive promotion, irrelevant hashtags, mass messages, copied comments, and misleading
          thumbnails may be removed or made ineligible for recommendation.
        </p>
      </LegalSection>

      <LegalSection title="11. Intellectual property and content ownership">
        <p>
          Upload only content you created or are authorized to use. Credit alone does not replace
          permission. Do not repost videos, music, art, logos, game assets, or personal images in a
          way that infringes copyright, trademark, privacy, publicity, or other rights. Rights
          holders may use the copyright process described in the Terms of Use.
        </p>
      </LegalSection>

      <LegalSection title="12. Regulated goods, gambling, and illegal activity">
        <p>
          Do not facilitate illegal drugs, weapons, counterfeit documents, stolen goods, gambling,
          betting, or other regulated transactions. Games of chance involving Robux, virtual items,
          money, or prizes are prohibited unless Bloxspark has expressly approved a legally
          compliant feature.
        </p>
      </LegalSection>

      <LegalSection title="13. Misleading and harmful information">
        <p>
          Do not spread fabricated emergency alerts, dangerous medical instructions, election
          interference, or deceptive claims likely to cause serious harm. Opinions and ordinary
          mistakes are not automatically violations. We consider intent, context, reach, and the
          likelihood of harm, and may add context or reduce recommendation instead of removing
          content.
        </p>
      </LegalSection>

      <LegalSection title="14. Recommendation eligibility">
        <p>
          Content may remain available but be excluded from Discover, search, or recommendations if
          it is repetitive, low quality, shocking, mature, copied, misleading, or unsuitable for a
          broad audience. Recommendation is not a right or a guarantee. Creators must not use
          suggestive thumbnails, unrelated trends, or hidden text to evade these standards.
        </p>
      </LegalSection>

      <LegalSection title="15. Reporting, blocking, and evidence">
        <p>
          Use the report control attached to the content, profile, or conversation and select the
          most accurate reason. Include links, dates, and context where possible. Block a user to
          stop direct contact. Reports must be made in good faith; knowingly false or coordinated
          reports are themselves a violation. We keep the reporter's identity confidential except
          when disclosure is legally required.
        </p>
      </LegalSection>

      <LegalSection title="16. How enforcement works">
        <p>
          We consider severity, context, intent, audience, previous violations, risk to minors, and
          cooperation. Actions may include reduced distribution, age restriction, content removal,
          loss of a feature, warning, temporary suspension, permanent account disablement, device or
          account restrictions, and referral to authorities. Severe safety violations can result in
          immediate permanent removal without a prior warning.
        </p>
        <p>
          Community owners and moderators may set additional rules, but they may not permit content
          prohibited here. They must not retaliate against good-faith reporters or use moderation
          tools for harassment. Bloxspark may remove moderators or communities that repeatedly fail
          to address serious violations.
        </p>
      </LegalSection>

      <LegalSection title="17. Notice and appeals">
        <p>
          When appropriate and legally permitted, we tell the account holder what rule was applied,
          what action was taken, and whether an appeal is available. You may appeal through Support
          by identifying the decision and explaining why it should be reconsidered. A different
          review may confirm, modify, or reverse the decision. Repeated identical appeals or threats
          against reviewers may be closed without further response.
        </p>
      </LegalSection>

      <LegalSection title="18. Updates and questions">
        <p>
          We update these Guidelines as features, risks, and legal requirements change. Material
          changes will be announced in the Service. Questions, safety reports, appeals, and concerns
          about a child can be submitted through Support. For immediate danger, contact local
          emergency services.
        </p>
      </LegalSection>
    </LegalPage>
  ),
});
