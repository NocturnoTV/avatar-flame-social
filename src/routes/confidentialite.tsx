import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — Bloxspark" },
      {
        name: "description",
        content:
          "Comment Bloxspark collecte, utilise, protège et conserve vos données personnelles, et quels sont vos droits.",
      },
      { property: "og:title", content: "Politique de confidentialité — Bloxspark" },
      { property: "og:description", content: "Vos données, vos droits, en toute transparence." },
    ],
  }),
  component: () => (
    <LegalPage title="Politique de confidentialité" updated="Dernière mise à jour : 12 septembre 2026">
      <LegalSection title="1. Qui est responsable de vos données ?">
        <p>
          Bloxspark est responsable du traitement des données personnelles collectées via l'application.
          Bloxspark est un service indépendant, sans lien d'affiliation avec Roblox Corporation. Cette
          politique explique de manière détaillée quelles données nous traitons, pourquoi, pendant combien de
          temps, avec qui elles sont partagées et comment vous pouvez exercer vos droits.
        </p>
      </LegalSection>

      <LegalSection title="2. Données que nous collectons">
        <p>Nous collectons uniquement les données nécessaires au fonctionnement du Service :</p>
        <ul>
          <li>
            <strong>Données de compte</strong> : adresse e-mail, identifiant technique, méthode de connexion
            (e-mail ou Google), date de création du compte.
          </li>
          <li>
            <strong>Données de profil</strong> : pseudonyme Bloxspark, nom d'utilisateur Roblox déclaré,
            langue, date de naissance (utilisée pour calculer l'âge et appliquer les protections liées à la
            minorité), biographie, décorations de profil, thème choisi.
          </li>
          <li>
            <strong>Données parentales</strong> : pour les utilisateurs de 13 à 17 ans, nom et adresse
            e-mail du parent ou représentant légal, ainsi que la preuve du consentement donné.
          </li>
          <li>
            <strong>Contenus</strong> : photos d'avatar téléversées, messages texte, messages vocaux, images
            envoyées en conversation.
          </li>
          <li>
            <strong>Données d'usage</strong> : swipes (like, passe, super spark), matchs, participations aux
            conversations, horodatage de dernière activité et de dernière lecture, signalements et blocages.
          </li>
          <li>
            <strong>Données techniques</strong> : journaux de connexion et données strictement nécessaires à
            la sécurité et à la lutte contre les abus.
          </li>
        </ul>
        <p>
          Nous ne demandons ni votre mot de passe Roblox, ni vos coordonnées bancaires, ni votre adresse
          postale. Ne communiquez jamais ces informations à un autre utilisateur.
        </p>
      </LegalSection>

      <LegalSection title="3. Finalités et bases légales">
        <ul>
          <li>
            <strong>Fourniture du Service</strong> (exécution du contrat) : création du compte, affichage du
            profil, recommandation de profils, matchs, messagerie, notifications.
          </li>
          <li>
            <strong>Protection des mineurs et sécurité</strong> (obligation légale et intérêt légitime) :
            vérification de l'âge déclaré, recueil du consentement parental, modération, prévention des abus
            et des fraudes.
          </li>
          <li>
            <strong>Amélioration du Service</strong> (intérêt légitime) : mesure agrégée et anonymisée de
            l'utilisation des fonctionnalités.
          </li>
          <li>
            <strong>Communications de service</strong> (exécution du contrat) : e-mails de confirmation,
            réinitialisation de mot de passe, alertes de sécurité.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Visibilité de vos informations">
        <p>
          Votre pseudonyme, votre nom d'utilisateur Roblox, votre âge, votre langue, votre biographie, vos
          décorations et vos photos sont visibles par les autres utilisateurs dans le fil Sparks et sur votre
          profil. Votre adresse e-mail, votre date de naissance exacte et les coordonnées parentales ne sont
          jamais affichées publiquement.
        </p>
        <p>
          Les messages privés et de groupe ne sont accessibles qu'aux participants de la conversation, ainsi
          qu'à l'équipe de modération en cas de signalement justifié.
        </p>
      </LegalSection>

      <LegalSection title="5. Destinataires et sous-traitants">
        <p>
          Les données sont hébergées et traitées par nos prestataires d'infrastructure (hébergement de la
          base de données, stockage des fichiers, authentification, envoi d'e-mails transactionnels), agissant
          en qualité de sous-traitants et liés par des engagements de confidentialité et de sécurité. Nous ne
          vendons jamais vos données personnelles et ne les utilisons pas à des fins de publicité ciblée.
        </p>
        <p>
          Des données peuvent être transmises aux autorités compétentes lorsque la loi l'exige ou lorsque
          cela est nécessaire pour protéger l'intégrité physique d'une personne, en particulier d'un mineur.
        </p>
      </LegalSection>

      <LegalSection title="6. Sécurité">
        <p>
          Les accès aux données sont protégés par une authentification, par un chiffrement des échanges
          (HTTPS) et par des règles de sécurité au niveau de la base de données qui limitent chaque
          utilisateur à ses propres données et à celles des conversations dont il est membre. Les photos et
          les messages vocaux sont stockés dans des espaces privés accessibles uniquement via des liens
          temporaires signés.
        </p>
      </LegalSection>

      <LegalSection title="7. Durées de conservation">
        <ul>
          <li>Données de compte et de profil : conservées tant que le compte est actif.</li>
          <li>Messages et médias : conservés jusqu'à leur suppression ou celle du compte.</li>
          <li>Journaux de sécurité et signalements : jusqu'à douze (12) mois après leur traitement.</li>
          <li>
            Après suppression du compte : effacement sous trente (30) jours, hors obligations légales de
            conservation et hors données nécessaires à la prévention d'une récidive d'abus grave.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Vos droits">
        <p>
          Conformément au RGPD et aux réglementations applicables, vous disposez d'un droit d'accès, de
          rectification, d'effacement, de limitation, d'opposition et de portabilité de vos données, ainsi que
          du droit de retirer votre consentement à tout moment. Les représentants légaux peuvent exercer ces
          droits pour le compte d'un mineur.
        </p>
        <p>
          La plupart de ces droits s'exercent directement depuis l'application : modification du profil,
          suppression de photos ou de messages, suppression définitive du compte depuis les paramètres. Pour
          toute autre demande, contactez-nous via le formulaire intégré. Vous pouvez également introduire une
          réclamation auprès de l'autorité de contrôle compétente.
        </p>
      </LegalSection>

      <LegalSection title="9. Cookies et stockage local">
        <p>
          Bloxspark n'utilise pas de cookies publicitaires ni de traceurs tiers. Nous utilisons uniquement le
          stockage local du navigateur pour conserver votre session, votre langue et votre thème (clair ou
          sombre).
        </p>
      </LegalSection>

      <LegalSection title="10. Modifications">
        <p>
          Cette politique peut évoluer. Toute modification substantielle vous sera notifiée dans
          l'application avant son entrée en vigueur.
        </p>
      </LegalSection>
    </LegalPage>
  ),
});
