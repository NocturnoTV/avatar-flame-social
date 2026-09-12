import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const Route = createFileRoute("/community-guidelines")({
  head: () => ({
    meta: [
      { title: "Règles de la communauté — Bloxspark" },
      {
        name: "description",
        content: "Les règles de respect, de sécurité et de bienveillance à suivre sur Bloxspark.",
      },
      { property: "og:title", content: "Règles de la communauté — Bloxspark" },
      { property: "og:description", content: "Une communauté Roblox sûre et respectueuse." },
    ],
  }),
  component: () => (
    <LegalPage title="Règles de la communauté" updated="Dernière mise à jour : 12 septembre 2026">
      <LegalSection title="L'esprit Bloxspark">
        <p>
          Bloxspark est fait pour rencontrer d'autres joueuses et joueurs de Roblox, parler de vos
          jeux préférés, former des équipes et créer des amitiés. Tout le monde doit s'y sentir en
          sécurité, quel que soit son âge, son pays, sa langue ou son style de jeu.
        </p>
      </LegalSection>

      <LegalSection title="1. Respect avant tout">
        <ul>
          <li>Pas d'insultes, de moqueries, de harcèlement ni de menaces.</li>
          <li>Pas de racisme, de sexisme, d'homophobie, de transphobie ni de discrimination.</li>
          <li>Accepte un refus : si quelqu'un ne répond pas ou te bloque, passe à autre chose.</li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Protection des mineurs">
        <ul>
          <li>
            Interdit aux moins de 13 ans. De 13 à 17 ans, l'accord d'un parent est obligatoire.
          </li>
          <li>Aucun contenu sexuel ou suggestif, jamais, sous aucune forme.</li>
          <li>
            Un adulte qui tient des propos déplacés à un mineur est exclu définitivement et peut
            être signalé aux autorités.
          </li>
          <li>Ne propose jamais de rencontre en dehors de l'application à un mineur.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Protège tes informations">
        <ul>
          <li>Ne partage jamais ton mot de passe Roblox ou Bloxspark.</li>
          <li>
            Ne donne pas ton adresse, ton école, ton numéro de téléphone ni tes coordonnées
            bancaires.
          </li>
          <li>
            Méfie-toi des liens envoyés en message : les arnaques aux Robux gratuits sont
            fréquentes.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Sois toi-même">
        <ul>
          <li>Utilise ton vrai pseudo Roblox et des photos de ton avatar.</li>
          <li>Pas d'usurpation d'identité, de faux âge ni de faux profil.</li>
          <li>Le changement de pseudo est limité à une fois tous les 7 jours.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Pas de commerce ni de spam">
        <ul>
          <li>Pas de vente ou d'échange de comptes, de Robux, d'objets ou de services.</li>
          <li>Pas de publicité, de chaînes de messages ni de promotion massive.</li>
          <li>Pas de bots, de scripts ni d'automatisation.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Signaler et bloquer">
        <p>
          Si un comportement te met mal à l'aise, utilise le bouton de signalement sur le profil ou
          la conversation, puis bloque la personne. Les signalements sont examinés et peuvent
          entraîner un avertissement, une suspension ou une exclusion définitive. Si tu es en
          danger, parles-en à un adulte de confiance et contacte les services d'urgence de ton pays.
        </p>
      </LegalSection>

      <LegalSection title="7. Conséquences">
        <p>
          Selon la gravité : avertissement, suppression du contenu, limitation des fonctionnalités,
          suspension temporaire ou suppression définitive du compte. Les infractions les plus graves
          (contenus impliquant des mineurs, menaces, arnaques organisées) entraînent une exclusion
          immédiate et sans avertissement.
        </p>
      </LegalSection>
    </LegalPage>
  ),
});
