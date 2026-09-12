import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const Route = createFileRoute("/conditions")({
  head: () => ({
    meta: [
      { title: "Conditions d'utilisation — Bloxspark" },
      {
        name: "description",
        content:
          "Conditions générales d'utilisation de Bloxspark : compte, âge minimum, contenus, sanctions et responsabilités.",
      },
      { property: "og:title", content: "Conditions d'utilisation — Bloxspark" },
      { property: "og:description", content: "Les règles contractuelles du service Bloxspark." },
    ],
  }),
  component: () => (
    <LegalPage title="Conditions générales d'utilisation" updated="Dernière mise à jour : 12 septembre 2026">
      <LegalSection title="1. Objet et acceptation">
        <p>
          Les présentes conditions générales d'utilisation (les « Conditions ») encadrent l'accès et
          l'utilisation de l'application Bloxspark (le « Service »), un réseau social et de mise en relation
          destiné aux joueuses et joueurs de Roblox. En créant un compte, en accédant au Service ou en
          l'utilisant de quelque manière que ce soit, vous acceptez sans réserve l'intégralité des présentes
          Conditions. Si vous n'acceptez pas ces Conditions, vous devez cesser immédiatement d'utiliser le
          Service.
        </p>
        <p>
          Bloxspark est une plateforme indépendante. Bloxspark n'est ni affilié, ni associé, ni autorisé, ni
          approuvé par Roblox Corporation, et n'est en aucune façon officiellement lié à Roblox Corporation.
          « Roblox » est une marque déposée de Roblox Corporation, citée uniquement à des fins descriptives.
        </p>
      </LegalSection>

      <LegalSection title="2. Âge minimum et consentement parental">
        <p>
          Le Service est réservé aux personnes âgées d'au moins treize (13) ans. Toute inscription d'une
          personne de moins de 13 ans est strictement interdite ; tout compte identifié comme appartenant à
          une personne de moins de 13 ans sera supprimé sans préavis.
        </p>
        <p>
          Les personnes âgées de 13 à 17 ans ne peuvent utiliser le Service qu'avec l'autorisation expresse
          d'un parent ou d'un représentant légal, dont l'identité et l'adresse électronique doivent être
          renseignées lors de l'inscription. Le parent ou représentant légal reconnaît être informé de la
          nature sociale du Service et accepte les présentes Conditions au nom du mineur. Nous pouvons à tout
          moment demander une confirmation de ce consentement et suspendre le compte dans l'attente de cette
          confirmation.
        </p>
        <p>
          Les fonctionnalités de mise en relation sont conçues pour favoriser des interactions entre profils
          de tranches d'âge comparables. Tout comportement d'adulte cherchant à entrer en contact de manière
          inappropriée avec un mineur entraîne une exclusion définitive et, le cas échéant, un signalement aux
          autorités compétentes.
        </p>
      </LegalSection>

      <LegalSection title="3. Compte utilisateur">
        <p>
          Vous vous engagez à fournir des informations exactes, à jour et complètes lors de la création de
          votre compte, notamment votre pseudonyme Bloxspark, votre nom d'utilisateur Roblox, votre langue et
          votre date de naissance. Vous êtes seul responsable de la confidentialité de vos identifiants ainsi
          que de toute activité effectuée depuis votre compte.
        </p>
        <p>
          Le changement de pseudonyme est limité à une modification tous les sept (7) jours. Cette limitation
          est appliquée côté serveur afin de préserver la fiabilité des identités affichées et de limiter les
          usurpations.
        </p>
      </LegalSection>

      <LegalSection title="4. Règles de conduite et contenus interdits">
        <p>Il est strictement interdit de publier, transmettre ou diffuser via le Service :</p>
        <ul>
          <li>des contenus à caractère sexuel, sexuellement suggestif ou pornographique, en particulier impliquant des mineurs ;</li>
          <li>des propos haineux, racistes, sexistes, homophobes, transphobes, validistes ou discriminatoires ;</li>
          <li>du harcèlement, des menaces, du chantage, du doxxing ou toute forme d'intimidation ;</li>
          <li>des contenus violents, choquants, glorifiant l'automutilation, le suicide ou les troubles alimentaires ;</li>
          <li>des escroqueries, du phishing, la vente ou l'échange de comptes, de Robux, d'objets virtuels ou de services payants ;</li>
          <li>des liens malveillants, des logiciels malveillants, du spam ou de la publicité non sollicitée ;</li>
          <li>des contenus violant les droits de propriété intellectuelle de tiers ;</li>
          <li>l'usurpation de l'identité d'une autre personne, d'un modérateur ou d'un employé de Roblox Corporation.</li>
        </ul>
        <p>
          Vous vous engagez également à ne pas collecter de données personnelles d'autres utilisateurs, à ne
          pas automatiser l'accès au Service (bots, scripts, scraping) et à ne pas contourner les mesures
          techniques de sécurité ou de modération.
        </p>
      </LegalSection>

      <LegalSection title="5. Contenus publiés par les utilisateurs">
        <p>
          Vous conservez la propriété des contenus que vous publiez (photos d'avatar, biographie, messages,
          messages vocaux). Vous accordez à Bloxspark une licence mondiale, non exclusive et gratuite,
          limitée à l'hébergement, au stockage, à la reproduction et à l'affichage de ces contenus dans le
          seul but de faire fonctionner le Service. Cette licence prend fin lorsque vous supprimez le contenu
          concerné, sous réserve des copies de sauvegarde temporaires et des obligations légales de
          conservation.
        </p>
        <p>
          Vous déclarez disposer de tous les droits nécessaires sur les contenus publiés et garantissez
          qu'ils ne portent atteinte à aucun droit de tiers.
        </p>
      </LegalSection>

      <LegalSection title="6. Modération, signalement et sanctions">
        <p>
          Chaque profil, message et conversation peut être signalé depuis l'application. Les signalements
          sont examinés et peuvent donner lieu, selon la gravité et la récidive, à un avertissement, au
          masquage d'un contenu, à une suspension temporaire ou à la suppression définitive du compte, sans
          indemnité.
        </p>
        <p>
          Vous disposez également d'outils de protection individuels : blocage d'un utilisateur, suppression
          d'une conversation et restriction de visibilité de votre profil. Le blocage empêche toute nouvelle
          interaction et masque réciproquement les profils.
        </p>
      </LegalSection>

      <LegalSection title="7. Disponibilité du Service">
        <p>
          Le Service est fourni « en l'état » et « selon disponibilité ». Nous nous efforçons d'assurer une
          disponibilité continue mais ne garantissons aucune absence d'interruption, d'erreur ou de perte de
          données. Des opérations de maintenance, des évolutions fonctionnelles ou l'arrêt de certaines
          fonctionnalités peuvent survenir à tout moment.
        </p>
      </LegalSection>

      <LegalSection title="8. Limitation de responsabilité">
        <p>
          Bloxspark met en relation des utilisateurs mais n'intervient pas dans leurs échanges privés et ne
          garantit ni l'exactitude des informations déclarées par les utilisateurs, ni leur comportement.
          Dans la limite permise par la loi applicable, la responsabilité de Bloxspark ne saurait être
          engagée pour les dommages indirects résultant de l'utilisation du Service, notamment les préjudices
          liés aux relations nouées entre utilisateurs.
        </p>
        <p>
          Nous vous recommandons vivement de ne jamais communiquer d'informations personnelles sensibles
          (adresse, établissement scolaire, coordonnées bancaires, mots de passe de compte Roblox) et de ne
          jamais organiser de rencontre physique sans l'accord et la présence d'un adulte responsable si vous
          êtes mineur.
        </p>
      </LegalSection>

      <LegalSection title="9. Résiliation">
        <p>
          Vous pouvez supprimer votre compte à tout moment depuis les paramètres. La suppression entraîne
          l'effacement de votre profil, de vos photos, de vos swipes et de vos matchs, dans les conditions
          décrites par la politique de confidentialité. Nous pouvons résilier ou suspendre votre accès en cas
          de violation des présentes Conditions.
        </p>
      </LegalSection>

      <LegalSection title="10. Modification des Conditions">
        <p>
          Les présentes Conditions peuvent être modifiées afin de refléter les évolutions du Service ou du
          cadre légal. En cas de modification substantielle, vous en serez informé dans l'application. La
          poursuite de l'utilisation du Service après l'entrée en vigueur des modifications vaut acceptation.
        </p>
      </LegalSection>

      <LegalSection title="11. Droit applicable et contact">
        <p>
          Les présentes Conditions sont régies par le droit français, sans préjudice des règles de protection
          impératives applicables dans votre pays de résidence. Pour toute question relative aux Conditions,
          vous pouvez nous contacter via le formulaire de signalement intégré à l'application.
        </p>
      </LegalSection>
    </LegalPage>
  ),
});
