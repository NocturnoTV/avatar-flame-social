import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { useI18n } from "@/lib/i18n";

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
  component: CommunityGuidelinesPage,
});

/**
 * English is the canonical, legally authoritative version of this document
 * (same as Terms/Privacy/Shop Terms elsewhere on the site) - the French
 * translation below is shown for readability when the viewer's selected
 * language is French, with a short note saying so, rather than silently
 * replacing the source text.
 */
function CommunityGuidelinesPage() {
  const { lang } = useI18n();
  const isFr = lang === "fr";

  return (
    <LegalPage
      title={isFr ? "Règles de la communauté" : "Community Guidelines"}
      updated={
        isFr ? "Dernière mise à jour : 14 septembre 2026" : "Last updated: September 14, 2026"
      }
      lang={isFr ? "fr" : "en"}
    >
      {isFr ? <FrenchGuidelines /> : <EnglishGuidelines />}
    </LegalPage>
  );
}

function EnglishGuidelines() {
  return (
    <>
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
    </>
  );
}

function FrenchGuidelines() {
  return (
    <>
      <p className="rounded-2xl border border-dashed border-border bg-surface p-3 text-xs italic text-muted-foreground">
        Cette traduction est fournie à titre informatif pour faciliter la lecture. En cas de
        divergence ou de litige, la version anglaise de ce document fait foi.
      </p>

      <p className="text-sm leading-7 text-muted-foreground">
        Ces règles s'appliquent à toutes les composantes de Bloxspark : noms d'utilisateur, avatars,
        profils, vidéos, stories, contenus audio, légendes, hashtags, commentaires, GIFs, messages,
        Sparks, Communautés, liens, ainsi que toute fonctionnalité interactive actuelle ou future.
        Le contexte compte, mais l'humour, le langage codé, l'orthographe modifiée, les groupes
        privés et les instructions données en dehors de la plateforme n'excusent pas un préjudice
        causé.
      </p>

      <LegalSection title="1. Notre exigence pour la communauté">
        <p>
          Bloxspark aide les joueurs Roblox à découvrir des créateurs, des jeux et des personnes
          avec qui jouer. Traitez les autres avec respect, ne partagez que du contenu que vous avez
          le droit de partager, et n'utilisez jamais le Service pour mettre une autre personne en
          danger. Nous pouvons supprimer tout contenu créant un risque réel pour la sécurité, même
          s'il n'est pas explicitement mentionné ci-dessous.
        </p>
        <ul>
          <li>Ne harcelez, n'exploitez, ne trompez, ne menacez et n'exposez personne.</li>
          <li>
            Ne publiez aucun contenu à caractère sexuel, haineux, violent, frauduleux ou illégal.
          </li>
          <li>
            Ne manipulez pas l'engagement, les signalements, les recommandations ou les systèmes de
            comptes.
          </li>
          <li>
            Utilisez les outils de signalement et de blocage dès qu'une interaction devient
            dangereuse.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Âge, sécurité des mineurs et responsabilité des adultes">
        <p>
          Bloxspark est destiné aux personnes âgées de 13 ans et plus. Toute personne de moins de 13
          ans ne doit ni créer ni utiliser de compte. Les utilisateurs âgés de 13 à 17 ans doivent
          disposer de l'autorisation exigée par la loi de leur lieu de résidence. Les adultes
          doivent maintenir des limites claires et adaptées à l'âge avec les mineurs.
        </p>
        <ul>
          <li>
            Ne demandez jamais à un mineur du contenu sexuel, des images intimes, de garder le
            secret, ou une rencontre en personne.
          </li>
          <li>
            N'incitez jamais un mineur à basculer vers un service chiffré, à messages éphémères ou
            moins modéré.
          </li>
          <li>
            Ne demandez pas l'adresse, l'établissement scolaire, la localisation en temps réel, le
            numéro de téléphone ou les coordonnées privées d'un mineur.
          </li>
          <li>
            Ne sexualisez pas des personnes à l'apparence jeune, des avatars destinés aux jeunes
            publics, ou des contextes scolaires.
          </li>
          <li>
            Ne mentez pas sur votre âge pour accéder à une autre tranche d'âge ou contourner un
            contrôle de sécurité.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Abus et exploitation sexuels d'enfants : tolérance zéro">
        <p>
          Les contenus d'abus sexuels sur mineurs, le grooming (mise en confiance à des fins
          d'abus), la sextorsion, la sollicitation sexuelle de mineurs, la traite d'êtres humains,
          ainsi que toute tentative d'obtenir ou de diffuser du contenu intime impliquant un mineur,
          sont interdits. Cela inclut les contenus fictifs, générés, modifiés, floutés, mis en lien
          ou hébergés hors plateforme, dès lors qu'ils sexualisent ou exploitent un mineur.
        </p>
        <p>
          Nous supprimons ce contenu, désactivons définitivement les comptes impliqués, conservons
          les preuves pertinentes lorsque la loi le permet, et signalons toute exploitation
          apparente d'un enfant aux autorités compétentes ou aux organismes de signalement désignés
          lorsque cela est requis. Ne téléchargez, n'enregistrez, ne transférez et ne republiez
          jamais un contenu suspect. Signalez-le immédiatement. Si un enfant est en danger immédiat,
          contactez les services d'urgence locaux ainsi qu'un adulte de confiance.
        </p>
      </LegalSection>

      <LegalSection title="4. Contenu sexuel et comportement romantique non désiré">
        <p>
          La pornographie, la nudité, les actes sexuels, le contenu fétichiste, les services à
          caractère sexuel, le langage sexuel explicite et les demandes d'images intimes sont
          interdits. Les représentations sexualisées de personnages ou d'avatars Roblox sont
          également prohibées. Un contexte éducatif ou d'actualité ne peut être pris en compte que
          s'il reste adapté à l'âge et non graphique.
        </p>
        <p>
          Sparks est conçu pour l'amitié et le jeu. Bloxspark n'autorise pas le chat sexuel anonyme,
          le matching à caractère sexuel aléatoire, les services d'escorte, ni les avances
          romantiques ou sexuelles répétées après qu'une personne a refusé, cessé de répondre,
          annulé le match ou vous a bloqué.
        </p>
      </LegalSection>

      <LegalSection title="5. Harcèlement, intimidation, haine et comportements dégradants">
        <ul>
          <li>
            Aucune insulte répétée, humiliation, harcèlement de groupe, traque, chantage ou
            intimidation.
          </li>
          <li>
            Aucune insulte discriminatoire, déshumanisation, exclusion ou attaque fondée sur une
            caractéristique protégée.
          </li>
          <li>
            Aucun souhait de mort, de maladie ou de préjudice grave envers une autre personne.
          </li>
          <li>
            Aucun harcèlement coordonné, signalement massif mensonger, ou incitation de vos abonnés
            à cibler quelqu'un.
          </li>
          <li>
            Aucun partage de conversations privées visant à humilier une personne, sauf motif de
            sécurité légitime.
          </li>
        </ul>
        <p>
          La critique d'idées, de jeux ou de comportements publics est autorisée tant qu'elle ne
          devient pas un harcèlement ciblé. La satire et le contre-discours sont évalués selon le
          contexte et ne doivent pas servir à dissimuler du harcèlement.
        </p>
      </LegalSection>

      <LegalSection title="6. Violence, actes dangereux et automutilation">
        <p>
          Ne menacez, ne glorifiez, n'expliquez ni n'encouragez la violence réelle, le terrorisme,
          l'automutilation, le suicide, les troubles alimentaires ou les défis dangereux. Les images
          explicites de blessures ou de mort sont interdites, sauf contexte documentaire limité
          clairement justifié par son caractère informatif et correctement restreint. Toute menace
          crédible peut être signalée aux services d'urgence ou aux forces de l'ordre.
        </p>
        <p>
          Les échanges de soutien autour du rétablissement sont autorisés. Ne fournissez ni
          méthodes, ni classements, ni encouragements, ni détails explicites. Un signalement dans
          l'application n'est pas un service d'urgence.
        </p>
      </LegalSection>

      <LegalSection title="7. Vie privée, informations personnelles et sécurité hors plateforme">
        <ul>
          <li>
            Aucun doxxing ni publication d'adresse, d'établissement scolaire, de localisation en
            temps réel, de numéro de téléphone privé, de mot de passe ou d'informations financières.
          </li>
          <li>
            Aucune image intime diffusée sans consentement, aucun enregistrement secret, ni menace
            de révéler des contenus privés.
          </li>
          <li>
            Aucune collecte, extraction, vente ou combinaison de données d'utilisateurs sans
            autorisation.
          </li>
          <li>
            N'incitez pas les utilisateurs, en particulier les mineurs, à contourner les contrôles
            familiaux, de la plateforme ou de sécurité.
          </li>
        </ul>
        <p>
          Protégez vos identifiants Roblox et Bloxspark. L'équipe Bloxspark ne vous demandera jamais
          votre mot de passe, un code d'authentification, des Robux ou des cartes cadeaux par
          message.
        </p>
      </LegalSection>

      <LegalSection title="8. Authenticité, usurpation d'identité et contenus trompeurs">
        <p>
          N'usurpez l'identité d'aucun autre utilisateur, créateur, modérateur, de Bloxspark, de
          Roblox ou d'une organisation publique. Les comptes de fans ou de parodie doivent être
          clairement identifiés comme tels et ne doivent tromper personne. N'utilisez pas de médias
          modifiés, synthétiques ou générés par IA pour faire croire faussement qu'une personne
          réelle a dit ou fait quelque chose de nuisible. Indiquez clairement le caractère
          synthétique d'un média réaliste lorsqu'il pourrait être pris pour un contenu authentique.
        </p>
      </LegalSection>

      <LegalSection title="9. Arnaques, Robux, comptes et activités malveillantes">
        <ul>
          <li>
            Aucun phishing, faux concours, arnaque à l'avance de frais, ou promesse de Robux
            gratuits.
          </li>
          <li>
            Aucun achat, vente, prêt ou échange de comptes ou d'identifiants Roblox ou Bloxspark.
          </li>
          <li>
            Aucun lien malveillant, logiciel malveillant, vol de jetons de session, collecte
            d'identifiants, ou instructions de contournement de la sécurité.
          </li>
          <li>
            Aucune vente non autorisée d'objets virtuels, de monnaie, de triches, d'exploits ou de
            services de boost.
          </li>
          <li>
            Aucune demande de paiement dissimulant le destinataire, le prix, le caractère récurrent
            ou l'objet réel du paiement.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="10. Spam, automatisation et manipulation des statistiques">
        <p>
          N'utilisez pas de bots, scripts, trafic acheté, échanges d'engagement, comptes multiples
          ou comportements coordonnés pour gonfler artificiellement les vues, les j'aime, les
          abonnements, les commentaires, les matchs ou les classements. La promotion répétitive, les
          hashtags hors sujet, les messages en masse, les commentaires copiés et les miniatures
          trompeuses peuvent être supprimés ou exclus des recommandations.
        </p>
      </LegalSection>

      <LegalSection title="11. Propriété intellectuelle et droits sur le contenu">
        <p>
          Ne publiez que du contenu que vous avez créé ou que vous êtes autorisé à utiliser.
          Créditer un auteur ne remplace pas son autorisation. Ne republiez pas de vidéos, musiques,
          œuvres, logos, éléments de jeu ou images personnelles d'une manière qui porte atteinte au
          droit d'auteur, à une marque, à la vie privée, au droit à l'image ou à d'autres droits.
          Les titulaires de droits peuvent utiliser la procédure relative au droit d'auteur décrite
          dans nos Conditions d'utilisation.
        </p>
      </LegalSection>

      <LegalSection title="12. Biens réglementés, jeux d'argent et activités illégales">
        <p>
          Ne facilitez pas le trafic de drogues illégales, d'armes, de faux documents, de biens
          volés, les jeux d'argent, les paris ou toute autre transaction réglementée. Les jeux de
          hasard impliquant des Robux, des objets virtuels, de l'argent ou des prix sont interdits,
          sauf fonctionnalité expressément approuvée par Bloxspark et conforme à la loi.
        </p>
      </LegalSection>

      <LegalSection title="13. Informations trompeuses ou dangereuses">
        <p>
          Ne diffusez pas de fausses alertes d'urgence, d'instructions médicales dangereuses, de
          contenus visant à interférer avec un processus électoral, ou d'affirmations trompeuses
          susceptibles de causer un préjudice grave. Les opinions et les erreurs ordinaires ne
          constituent pas automatiquement une infraction. Nous tenons compte de l'intention, du
          contexte, de la portée et du risque de préjudice, et pouvons ajouter du contexte ou
          réduire la mise en avant d'un contenu plutôt que de le supprimer.
        </p>
      </LegalSection>

      <LegalSection title="14. Éligibilité aux recommandations">
        <p>
          Un contenu peut rester disponible tout en étant exclu de Discover, de la recherche ou des
          recommandations s'il est répétitif, de faible qualité, choquant, réservé aux adultes,
          copié, trompeur ou inadapté à un large public. La mise en recommandation n'est ni un droit
          ni une garantie. Les créateurs ne doivent pas utiliser de miniatures suggestives, de
          tendances sans rapport ou de texte caché pour contourner ces règles.
        </p>
      </LegalSection>

      <LegalSection title="15. Signalement, blocage et éléments de preuve">
        <p>
          Utilisez l'outil de signalement associé au contenu, au profil ou à la conversation
          concerné, et sélectionnez le motif le plus précis possible. Indiquez des liens, des dates
          et du contexte lorsque c'est possible. Bloquez un utilisateur pour mettre fin à tout
          contact direct. Les signalements doivent être faits de bonne foi ; un signalement
          sciemment mensonger ou coordonné constitue lui-même une infraction. Nous gardons
          l'identité de l'auteur du signalement confidentielle, sauf obligation légale de
          divulgation.
        </p>
      </LegalSection>

      <LegalSection title="16. Comment fonctionne l'application des règles">
        <p>
          Nous tenons compte de la gravité, du contexte, de l'intention, du public visé, des
          infractions antérieures, du risque pour les mineurs et de la coopération. Les mesures
          possibles incluent une diffusion réduite, une restriction d'âge, la suppression du
          contenu, la perte d'une fonctionnalité, un avertissement, une suspension temporaire, la
          désactivation définitive du compte, des restrictions d'appareil ou de compte, et un
          signalement aux autorités. Une infraction grave à la sécurité peut entraîner une
          suppression définitive immédiate, sans avertissement préalable.
        </p>
        <p>
          Les propriétaires et modérateurs de communautés peuvent établir des règles
          supplémentaires, mais ne peuvent pas autoriser un contenu interdit par le présent
          document. Ils ne doivent pas exercer de représailles contre une personne ayant signalé un
          contenu de bonne foi, ni utiliser les outils de modération à des fins de harcèlement.
          Bloxspark peut retirer les modérateurs ou supprimer les communautés qui ne traitent pas de
          manière répétée les infractions graves.
        </p>
      </LegalSection>

      <LegalSection title="17. Notification et recours">
        <p>
          Lorsque cela est approprié et légalement possible, nous informons le titulaire du compte
          de la règle appliquée, de la mesure prise et de la possibilité de faire appel. Vous pouvez
          faire appel via le Support en identifiant la décision concernée et en expliquant pourquoi
          elle devrait être réexaminée. Un nouvel examen peut confirmer, modifier ou annuler la
          décision. Les appels identiques répétés ou les menaces envers les personnes chargées de
          l'examen peuvent être clos sans réponse supplémentaire.
        </p>
      </LegalSection>

      <LegalSection title="18. Mises à jour et questions">
        <p>
          Nous mettons à jour ces Règles à mesure que les fonctionnalités, les risques et les
          exigences légales évoluent. Les modifications importantes seront annoncées dans le
          Service. Les questions, signalements de sécurité, recours et préoccupations concernant un
          enfant peuvent être soumis via le Support. En cas de danger immédiat, contactez les
          services d'urgence locaux.
        </p>
      </LegalSection>
    </>
  );
}
