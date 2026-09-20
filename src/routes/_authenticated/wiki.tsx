import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Coins,
  Compass,
  Crown,
  Flame,
  Gem,
  Gift,
  Hash,
  Heart,
  Info,
  Lightbulb,
  Lock,
  Menu,
  MessageCircle,
  Rocket,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  UserCircle,
  Users,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { Sheet } from "@/components/ui-kit";
import { useI18n, type LangCode } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/wiki")({
  head: () => ({
    meta: [
      { title: "Wiki - BloxSpark" },
      {
        name: "description",
        content: "The complete BloxSpark guide: Discover, Sparks, Communities, Blox and safety.",
      },
    ],
  }),
  component: WikiPage,
});

// --- content model ---------------------------------------------------------
// Kept intentionally simple (paragraph / bullet list / callout) rather than a
// full markdown renderer - plenty expressive for a guide like this, and easy
// to keep in sync across all 6 languages.
type NoteTone = "tip" | "warn" | "info";
type Block = { p: string } | { ul: string[] } | { note: string; tone: NoteTone };

type WikiPageContent = { id: string; title: string; icon: LucideIcon; blocks: Block[] };
type WikiCategory = { id: string; title: string; icon: LucideIcon; pages: WikiPageContent[] };

const NOTE_STYLES: Record<NoteTone, string> = {
  tip: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warn: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  info: "border-primary/25 bg-primary/10 text-primary",
};
const NOTE_ICONS = { tip: Lightbulb, warn: AlertTriangle, info: Info };

function cat(id: string, title: string, icon: LucideIcon, pages: WikiPageContent[]): WikiCategory {
  return { id, title, icon, pages };
}
function pg(id: string, title: string, icon: LucideIcon, blocks: Block[]): WikiPageContent {
  return { id, title, icon, blocks };
}

const WIKI: Record<
  LangCode,
  { eyebrow: string; title: string; searchPlaceholder: string; categories: WikiCategory[] }
> = {
  fr: {
    eyebrow: "Académie BloxSpark",
    title: "Le guide complet de BloxSpark",
    searchPlaceholder: "Rechercher dans le wiki...",
    categories: [
      cat("start", "Bien démarrer", Rocket, [
        pg("welcome", "Bienvenue sur BloxSpark", Sparkles, [
          {
            p: "BloxSpark est le réseau social pensé pour les joueurs Roblox : partage tes moments de jeu en vidéo, rencontre d'autres joueurs, rejoins des communautés et discute avec tes amis, le tout au même endroit.",
          },
          {
            ul: [
              "🎥 Découvrir — un feed vertical de vidéos Roblox, façon TikTok gaming",
              "✨ Sparks — rencontre et matche avec d'autres joueurs qui partagent tes jeux",
              "👥 Communautés — des salons façon Discord organisés par jeu ou par thème",
              "💬 Messages — discute avec tes amis, tes Sparks et l'équipe BloxSpark",
              "💰 Blox — la monnaie virtuelle de l'app, à gagner gratuitement ou à acheter",
            ],
          },
          {
            note: "Le plus simple pour démarrer : connecte ton compte Roblox, personnalise ton profil, puis va faire un tour dans Découvrir pour voir ce qui s'y passe.",
            tone: "tip",
          },
        ]),
        pg("profile", "Connecter Roblox & créer ton profil", UserCircle, [
          {
            p: "Ton compte Roblox est au cœur de ton identité sur BloxSpark : il permet aux autres joueurs de te reconnaître et de voir à quoi tu joues vraiment.",
          },
          {
            ul: [
              "Connecte ton compte Roblox pour importer automatiquement ton pseudo, ton avatar et tes jeux favoris.",
              "Choisis une photo de profil claire (ton avatar Roblox fonctionne très bien) et rédige une bio courte qui donne envie d'en savoir plus.",
              "Ajoute tes jeux favoris : ils servent à te proposer des Sparks et des communautés pertinentes.",
              "Renseigne ta langue dans les réglages : toute l'app, y compris ce wiki, s'adapte automatiquement.",
            ],
          },
          {
            note: "Ne publie jamais ton mot de passe, tes coordonnées privées ou des informations qui permettraient de te localiser précisément.",
            tone: "warn",
          },
        ]),
      ]),
      cat("create", "Découvrir & créer", Compass, [
        pg("feed", "Le feed Discover", Video, [
          { p: "Deux onglets se partagent le feed Discover, chacun avec sa propre logique." },
          {
            ul: [
              "Pour toi — un feed personnalisé qui apprend de ce que tu regardes, aimes, commentes et partages",
              "Abonnements — uniquement les vidéos des créateurs que tu suis, dans l'ordre chronologique",
              'Le feed "Pour toi" tient aussi compte de la langue de chaque créateur, pour te montrer en priorité du contenu que tu peux comprendre',
              'Utilise "Pas intéressé" pour affiner tes recommandations, sans jamais fausser tes vraies statistiques (vues, likes, abonnés)',
            ],
          },
          {
            note: "Arrivé en bas de ton feed ? C'est le signal qu'il est temps de publier la prochaine vidéo toi-même !",
            tone: "info",
          },
        ]),
        pg("publish", "Publier une vidéo", Video, [
          {
            p: "Le Creator Studio (accessible depuis Découvrir) te guide en plusieurs étapes pour publier une vidéo propre et bien préparée.",
          },
          {
            ul: [
              "Choisis ton fichier vidéo (jusqu'à 200 Mo), donne-lui un titre clair et ajoute jusqu'à 5 hashtags pertinents.",
              "Choisis qui peut la voir : tout le monde, ou seulement tes Sparks.",
              "Personnalise la miniature en choisissant l'image extraite directement d'un moment fort de ta vidéo.",
              "Utilise l'outil de montage pour découper un extrait, ajouter un son ou du texte directement sur ta vidéo avant de publier.",
            ],
          },
          {
            note: "Une bonne vidéo attire l'attention dès les premières secondes : va droit au but, coupe les longs silences et les intros interminables.",
            tone: "tip",
          },
        ]),
        pg("boost", "Booster une vidéo", Rocket, [
          {
            p: "Le boost dépense des Blox pour augmenter la visibilité d'une de tes vidéos dans le feed, pendant une durée que tu choisis (de 1h à 24h).",
          },
          {
            ul: [
              "Se lance depuis le Creator Studio, sur n'importe laquelle de tes vidéos publiques.",
              "Plus la durée choisie est longue, plus le coût en Blox est élevé.",
              'Un badge "🚀 Boostée" apparaît sur la vidéo tant que le boost est actif.',
            ],
          },
          {
            note: "Le boost augmente uniquement la visibilité — il ne génère jamais de faux likes, vues ou abonnés.",
            tone: "warn",
          },
        ]),
      ]),
      cat("social", "Sparks, Communautés & Messages", Users, [
        pg("sparks", "Sparks : matcher avec d'autres joueurs", Heart, [
          {
            p: "Sparks est la fonctionnalité de rencontre de BloxSpark : swipe, matche et discute avec des joueurs qui partagent tes jeux.",
          },
          {
            ul: [
              "Glisse à droite (ou appuie sur ❤️) pour indiquer ton intérêt, à gauche (✕) pour passer au profil suivant.",
              "Une conversation s'ouvre uniquement si l'intérêt est mutuel.",
              "Utilise les filtres rapides pour affiner le deck : mêmes jeux, même langue, micro activé...",
              "Le pourcentage de compatibilité affiché est calculé à partir de vos jeux, langue, pays et âge en commun.",
            ],
          },
          {
            note: "Tu n'es jamais obligé de continuer une conversation qui te met mal à l'aise — bloque ou signale à tout moment depuis le profil de la personne.",
            tone: "warn",
          },
        ]),
        pg("communities", "Communautés : salons, rôles, classement", Hash, [
          {
            p: "Chaque communauté fonctionne comme un petit serveur, avec des salons de discussion, des rôles et un classement d'activité.",
          },
          {
            ul: [
              "Rejoins une communauté existante depuis l'onglet Communautés, ou crée la tienne pour ton jeu ou ton groupe d'amis.",
              "Les Salons sont organisés par catégorie ; le propriétaire et les modérateurs peuvent en créer de nouveaux.",
              "Le Classement récompense l'activité des 30 derniers jours (messages, participations aux événements...), pas seulement le nombre de membres.",
              "Certaines communautés sont publiques, d'autres réservées aux amis ou sur demande d'adhésion.",
            ],
          },
          {
            note: "Le rôle attribué à un membre détermine sa couleur de pseudo et ses permissions (gérer les salons, les membres, etc.).",
            tone: "info",
          },
        ]),
        pg("messages", "Messages, groupes et notifications", MessageCircle, [
          {
            p: "Retrouve toutes tes conversations privées, tes groupes et tes notifications au même endroit.",
          },
          {
            ul: [
              "Le bouton + en haut à gauche sert à deux choses : ajouter un nouvel ami (recherche par pseudo) ou créer un groupe avec tes Sparks existants.",
              "Team Spark, épinglé en haut de tes messages, rassemble le message de bienvenue et toutes les notifications liées à tes vidéos (likes, commentaires, favoris, republications).",
              '"Activité récente" regroupe séparément tes matchs et likes reçus côté Sparks.',
            ],
          },
          {
            note: "Active ou désactive les notifications par catégorie depuis les réglages de ton compte.",
            tone: "tip",
          },
        ]),
        pg("streaks", "Les flammes : garder une conversation vivante", Flame, [
          {
            p: "Une flamme 🔥 apparaît à côté du nom d'une personne quand vous vous écrivez tous les deux, chaque jour, dans une conversation privée.",
          },
          {
            ul: [
              "La flamme augmente d'un jour dès que vous vous êtes tous les deux écrit au moins une fois dans la même journée.",
              "Si un jour passe sans qu'aucun message ne soit échangé des deux côtés, la flamme devient grise : c'est un avertissement, il vous reste encore un peu de temps.",
              "Si personne n'écrit à temps, la flamme se brise 💔 - mais elle n'est pas perdue tout de suite : l'un(e) de vous deux peut la restaurer dans les 30 heures qui suivent.",
              "Restaurer une flamme brisée est réservé aux membres Spark Plus, avec une limite de 3 restaurations par mois.",
              "Passé les 30 heures sans restauration, la flamme est définitivement perdue et repart de zéro au prochain message.",
            ],
          },
          {
            note: "Les groupes n'ont pas de flamme - elle ne concerne que les conversations privées à deux.",
            tone: "info",
          },
        ]),
      ]),
      cat("economy", "Blox & Boutique", Coins, [
        pg("blox", "Les Blox, la monnaie de BloxSpark", Gem, [
          {
            p: "Les Blox sont la monnaie virtuelle de BloxSpark. Ils servent à booster tes vidéos, acheter des badges, personnaliser ton profil ou faire un cadeau à un créateur.",
          },
          {
            ul: [
              "Achète des Blox dans la boutique en 5 packs, du plus petit (Starter) au plus généreux (Ultimate), chacun avec un bonus croissant.",
              "Gagne des Blox gratuitement chaque jour grâce aux défis de la page Récompenses.",
              "Offre des Blox à un ami ou à un créateur, directement depuis un commentaire ou une conversation privée.",
              "Ton solde de Blox n'expire jamais tant que ton compte reste actif, et ne peut pas être converti en argent réel.",
            ],
          },
          {
            note: "Chaque transaction est enregistrée dans ton historique, consultable depuis Achats & Facturation.",
            tone: "info",
          },
        ]),
        pg("plus", "Spark Plus & la boutique", Crown, [
          {
            p: "Spark Plus est l'abonnement premium de BloxSpark : badge exclusif, effets et thèmes premium, statistiques avancées et support prioritaire.",
          },
          {
            ul: [
              "S'abonne et se gère directement depuis la Boutique, sans engagement - résiliable à tout moment.",
              "La Blox Store propose des badges cosmétiques à afficher sur ton profil, achetés avec tes Blox.",
              "Les paiements sont traités de façon sécurisée par Stripe ; BloxSpark ne stocke jamais tes informations de carte bancaire complètes.",
            ],
          },
          {
            note: "Consulte la page Achats & Facturation pour gérer ton abonnement et retrouver toutes tes factures.",
            tone: "tip",
          },
        ]),
        pg("rewards", "Gagner des Blox gratuitement", Gift, [
          {
            p: "La page Récompenses propose chaque jour 3 défis tirés au hasard parmi un catalogue plus large : aimer une vidéo, commenter, publier, visiter des profils...",
          },
          {
            ul: [
              "Les défis se réinitialisent chaque jour à minuit, selon ton fuseau horaire.",
              "Complète un défi pour recevoir immédiatement ses Blox, avec une petite animation de récompense.",
              "Reviens chaque jour pour faire grimper ta série de jours actifs consécutifs (streak).",
            ],
          },
          {
            note: "Certains défis se comptent une seule fois par cible : aimer une même vidéo deux fois ne compte qu'une fois.",
            tone: "info",
          },
        ]),
      ]),
      cat("safety", "Sécurité & Compte", Shield, [
        pg("verification", "Certification (badge vérifié)", BadgeCheck, [
          {
            p: "Le badge de certification confirme qu'un profil notable ou digne de confiance est authentique.",
          },
          {
            ul: [
              "Il n'y a aucun nombre minimum d'abonnés requis.",
              "Les créateurs actifs qui publient régulièrement du contenu original et de qualité peuvent faire une demande.",
              "Les personnalités, marques et entreprises reconnues peuvent également être certifiées.",
              "Un profil complet, une identité cohérente et un bon historique de sécurité facilitent l'examen de la demande.",
            ],
          },
          { note: "La certification ne s'achète jamais, sous aucune forme.", tone: "warn" },
        ]),
        pg("moderation", "Sécurité, blocage et signalement", ShieldCheck, [
          {
            p: "Ta sécurité est prioritaire sur BloxSpark. Plusieurs outils sont à ta disposition à tout moment.",
          },
          {
            ul: [
              "Bloque un profil pour ne plus voir son contenu et l'empêcher de t'écrire — l'action est réversible.",
              "Signale un contenu ou une personne directement depuis son profil, une vidéo ou une conversation ; l'équipe de modération est notifiée.",
              "Les messages contenant des propos problématiques déclenchent automatiquement une alerte de sécurité auprès des autres participants concernés.",
              "Le support est disponible depuis la page Support si tu as besoin d'aide rapidement.",
            ],
          },
          {
            note: "En cas de danger immédiat, contacte toujours en priorité les services d'urgence de ton pays.",
            tone: "warn",
          },
        ]),
        pg("privacy", "Confidentialité et gestion du compte", Lock, [
          {
            p: "Tu gardes le contrôle sur ce que les autres voient de toi et sur ton compte, à tout moment.",
          },
          {
            ul: [
              "Choisis qui peut te contacter, voir ton âge ou ton activité récente depuis les réglages de confidentialité.",
              "L'historique de visionnage n'est enregistré que si tu l'actives explicitement, et reste privé.",
              "Change de langue, de thème et de nombreuses préférences depuis les Réglages, à tout moment.",
              "La suppression de compte est définitive : demande-la depuis les réglages si tu es certain de vouloir partir.",
            ],
          },
          {
            note: "Retrouve la politique complète de confidentialité et les conditions d'utilisation depuis le pied de page des réglages.",
            tone: "tip",
          },
        ]),
      ]),
    ],
  },

  en: {
    eyebrow: "BloxSpark Academy",
    title: "The complete BloxSpark guide",
    searchPlaceholder: "Search the wiki...",
    categories: [
      cat("start", "Getting started", Rocket, [
        pg("welcome", "Welcome to BloxSpark", Sparkles, [
          {
            p: "BloxSpark is the social network built for Roblox players: share your gaming moments on video, meet other players, join communities and chat with friends, all in one place.",
          },
          {
            ul: [
              "🎥 Discover — a vertical feed of Roblox videos, TikTok-for-gamers style",
              "✨ Sparks — meet and match with other players who share your games",
              "👥 Communities — Discord-style rooms organized by game or topic",
              "💬 Messages — chat with your friends, your Sparks and the BloxSpark team",
              "💰 Blox — the app's virtual currency, earn it free or buy it",
            ],
          },
          {
            note: "The easiest way to start: connect your Roblox account, personalize your profile, then browse Discover to see what's happening.",
            tone: "tip",
          },
        ]),
        pg("profile", "Connect Roblox & build your profile", UserCircle, [
          {
            p: "Your Roblox account is at the heart of your identity on BloxSpark - it lets other players recognize you and see what you actually play.",
          },
          {
            ul: [
              "Connect your Roblox account to automatically import your username, avatar and favorite games.",
              "Pick a clear profile picture (your Roblox avatar works great) and write a short bio that makes people want to know more.",
              "Add your favorite games - they're used to suggest relevant Sparks and communities.",
              "Set your language in settings: the whole app, including this wiki, adapts automatically.",
            ],
          },
          {
            note: "Never post your password, private contact details, or anything that could reveal exactly where you live.",
            tone: "warn",
          },
        ]),
      ]),
      cat("create", "Discover & create", Compass, [
        pg("feed", "The Discover feed", Video, [
          { p: "Two tabs share the Discover feed, each with its own logic." },
          {
            ul: [
              "For You - a personalized feed that learns from what you watch, like, comment on and share",
              "Following - only videos from creators you follow, in chronological order",
              "The For You feed also factors in each creator's language, to prioritize content you can actually understand",
              'Use "Not interested" to fine-tune your recommendations - it never fakes your real stats (views, likes, followers)',
            ],
          },
          {
            note: "Reached the bottom of your feed? That's your cue to post the next video yourself!",
            tone: "info",
          },
        ]),
        pg("publish", "Publishing a video", Video, [
          {
            p: "Creator Studio (accessible from Discover) walks you through several steps to publish a clean, well-prepared video.",
          },
          {
            ul: [
              "Pick your video file (up to 200 MB), give it a clear title and add up to 5 relevant hashtags.",
              "Choose who can see it: everyone, or just your Sparks.",
              "Customize the thumbnail by picking a frame straight from a strong moment in your video.",
              "Use the editing tool to trim a clip, add a sound, or add text directly on your video before publishing.",
            ],
          },
          {
            note: "A good video grabs attention within the first few seconds: get to the point and cut long silences or endless intros.",
            tone: "tip",
          },
        ]),
        pg("boost", "Boosting a video", Rocket, [
          {
            p: "Boosting spends Blox to increase one of your videos' visibility in the feed, for a duration you choose (1h to 24h).",
          },
          {
            ul: [
              "Launched from Creator Studio, on any of your public videos.",
              "The longer the duration you pick, the higher the Blox cost.",
              'A "🚀 Boosted" badge shows on the video for as long as the boost is active.',
            ],
          },
          {
            note: "Boosting only increases visibility - it never fabricates fake likes, views, or followers.",
            tone: "warn",
          },
        ]),
      ]),
      cat("social", "Sparks, Communities & Messages", Users, [
        pg("sparks", "Sparks: matching with other players", Heart, [
          {
            p: "Sparks is BloxSpark's matching feature: swipe, match and chat with players who share your games.",
          },
          {
            ul: [
              "Swipe right (or tap ❤️) to show interest, left (✕) to move to the next profile.",
              "A conversation only opens if the interest is mutual.",
              "Use the quick filters to narrow the deck: same games, same language, mic enabled...",
              "The compatibility percentage shown is calculated from your shared games, language, country and age.",
            ],
          },
          {
            note: "You're never obligated to keep a conversation going if it makes you uncomfortable - block or report at any time from that person's profile.",
            tone: "warn",
          },
        ]),
        pg("communities", "Communities: channels, roles, leaderboard", Hash, [
          {
            p: "Every community works like a small server, with chat channels, roles and an activity leaderboard.",
          },
          {
            ul: [
              "Join an existing community from the Communities tab, or create your own for your game or friend group.",
              "Channels are organized by category; the owner and moderators can create new ones.",
              "The Leaderboard rewards activity over the last 30 days (messages, event participation...), not just member count.",
              "Some communities are public, others are friends-only or require an approved join request.",
            ],
          },
          {
            note: "A member's role determines their username color and permissions (managing channels, members, etc.).",
            tone: "info",
          },
        ]),
        pg("messages", "Messages, groups and notifications", MessageCircle, [
          { p: "Find all your direct conversations, groups and notifications in one place." },
          {
            ul: [
              "The + button top-left does two things: add a new friend (search by username), or create a group with your existing Sparks.",
              "Team Spark, pinned at the top of Messages, gathers your welcome message and every notification about your videos (likes, comments, favorites, reposts).",
              '"Recent activity" separately groups your Sparks matches and likes received.',
            ],
          },
          {
            note: "Turn notifications on or off per category from your account settings.",
            tone: "tip",
          },
        ]),
        pg("streaks", "Streaks: keeping a conversation alive", Flame, [
          {
            p: "A 🔥 flame appears next to someone's name when you both message each other, every day, in a private conversation.",
          },
          {
            ul: [
              "The streak goes up by one day as soon as you've both sent at least one message on the same day.",
              "If a day passes with no message from either side, the flame turns gray - a warning that there's still a little time left.",
              "If nobody messages in time, the flame breaks 💔 - but it's not lost right away: either of you can restore it within 30 hours.",
              "Restoring a broken streak is a Spark Plus perk, limited to 3 restores per month.",
              "After 30 hours with no restore, the streak is gone for good and starts over from zero on the next message.",
            ],
          },
          {
            note: "Groups don't have a streak - it only applies to one-on-one private conversations.",
            tone: "info",
          },
        ]),
      ]),
      cat("economy", "Blox & Shop", Coins, [
        pg("blox", "Blox, BloxSpark's currency", Gem, [
          {
            p: "Blox is BloxSpark's virtual currency. Use it to boost your videos, buy badges, personalize your profile, or send a gift to a creator.",
          },
          {
            ul: [
              "Buy Blox in the shop across 5 packs, from the smallest (Starter) to the most generous (Ultimate), each with an increasing bonus.",
              "Earn Blox for free every day through the challenges on the Rewards page.",
              "Gift Blox to a friend or a creator, directly from a comment or a private conversation.",
              "Your Blox balance never expires as long as your account stays active, and can never be converted to real money.",
            ],
          },
          {
            note: "Every transaction is logged in your history, viewable from Purchases & Billing.",
            tone: "info",
          },
        ]),
        pg("plus", "Spark Plus & the shop", Crown, [
          {
            p: "Spark Plus is BloxSpark's premium subscription: an exclusive badge, premium effects and themes, advanced stats, and priority support.",
          },
          {
            ul: [
              "Subscribe and manage it directly from the Shop, no commitment - cancel any time.",
              "The Blox Store offers cosmetic badges to display on your profile, bought with Blox.",
              "Payments are securely processed by Stripe; BloxSpark never stores your full card details.",
            ],
          },
          {
            note: "Check the Purchases & Billing page to manage your subscription and find every invoice.",
            tone: "tip",
          },
        ]),
        pg("rewards", "Earning Blox for free", Gift, [
          {
            p: "The Rewards page offers 3 randomly-drawn daily challenges from a larger catalog: like a video, comment, publish, visit profiles...",
          },
          {
            ul: [
              "Challenges reset every day at midnight, based on your own timezone.",
              "Complete a challenge to get its Blox instantly, with a small reward animation.",
              "Come back every day to build up your streak of consecutive active days.",
            ],
          },
          {
            note: "Some challenges only count once per target: liking the same video twice only counts once.",
            tone: "info",
          },
        ]),
      ]),
      cat("safety", "Safety & Account", Shield, [
        pg("verification", "Verification (checkmark badge)", BadgeCheck, [
          { p: "The verification badge confirms that a notable or trusted presence is authentic." },
          {
            ul: [
              "There is no minimum follower requirement.",
              "Active creators who regularly publish original, high-quality content can apply.",
              "Recognized public figures, brands and companies can also apply.",
              "A complete profile, a consistent identity and a good safety record help the review.",
            ],
          },
          { note: "Verification is never sold, in any form.", tone: "warn" },
        ]),
        pg("moderation", "Safety, blocking and reporting", ShieldCheck, [
          {
            p: "Your safety comes first on BloxSpark. Several tools are available to you at any time.",
          },
          {
            ul: [
              "Block a profile to stop seeing their content and prevent them from messaging you - reversible any time.",
              "Report content or a person directly from their profile, a video, or a conversation; the moderation team is notified.",
              "Messages containing flagged language automatically trigger a safety alert to the other participants involved.",
              "Support is available from the Support page whenever you need quick help.",
            ],
          },
          {
            note: "In case of immediate danger, always contact your local emergency services first.",
            tone: "warn",
          },
        ]),
        pg("privacy", "Privacy and account management", Lock, [
          {
            p: "You stay in control of what others see about you, and of your account, at all times.",
          },
          {
            ul: [
              "Choose who can message you, see your age, or your recent activity from privacy settings.",
              "Watch history is only recorded if you explicitly enable it, and stays private.",
              "Change your language, theme and many other preferences from Settings, any time.",
              "Account deletion is permanent: request it from settings only once you're sure you want to leave.",
            ],
          },
          {
            note: "The full privacy policy and terms of use are linked at the bottom of Settings.",
            tone: "tip",
          },
        ]),
      ]),
    ],
  },

  es: {
    eyebrow: "Academia BloxSpark",
    title: "La guía completa de BloxSpark",
    searchPlaceholder: "Buscar en el wiki...",
    categories: [
      cat("start", "Primeros pasos", Rocket, [
        pg("welcome", "Bienvenido a BloxSpark", Sparkles, [
          {
            p: "BloxSpark es la red social pensada para jugadores de Roblox: comparte tus momentos de juego en vídeo, conoce a otros jugadores, únete a comunidades y chatea con tus amigos, todo en un mismo lugar.",
          },
          {
            ul: [
              "🎥 Descubrir — un feed vertical de vídeos de Roblox",
              "✨ Sparks — conoce y haz match con otros jugadores que comparten tus juegos",
              "👥 Comunidades — salas al estilo Discord organizadas por juego o tema",
              "💬 Mensajes — chatea con tus amigos, tus Sparks y el equipo de BloxSpark",
              "💰 Blox — la moneda virtual de la app, gánala gratis o cómprala",
            ],
          },
          {
            note: "Lo más sencillo para empezar: conecta tu cuenta de Roblox, personaliza tu perfil y explora Descubrir.",
            tone: "tip",
          },
        ]),
        pg("profile", "Conectar Roblox y crear tu perfil", UserCircle, [
          { p: "Tu cuenta de Roblox es el centro de tu identidad en BloxSpark." },
          {
            ul: [
              "Conecta tu cuenta de Roblox para importar automáticamente tu nombre de usuario, avatar y juegos favoritos.",
              "Elige una foto de perfil clara y escribe una biografía corta.",
              "Añade tus juegos favoritos: se usan para sugerirte Sparks y comunidades relevantes.",
              "Configura tu idioma en los ajustes: toda la app, incluido este wiki, se adapta automáticamente.",
            ],
          },
          {
            note: "Nunca publiques tu contraseña, datos de contacto privados ni información que revele dónde vives.",
            tone: "warn",
          },
        ]),
      ]),
      cat("create", "Descubrir y crear", Compass, [
        pg("feed", "El feed de Descubrir", Video, [
          { p: "Dos pestañas comparten el feed de Descubrir, cada una con su propia lógica." },
          {
            ul: [
              "Para ti — un feed personalizado según lo que ves, das like, comentas y compartes",
              "Siguiendo — solo los vídeos de los creadores que sigues, en orden cronológico",
              "El feed Para ti también tiene en cuenta el idioma de cada creador",
              'Usa "No me interesa" para afinar tus recomendaciones, sin falsear tus estadísticas reales',
            ],
          },
          {
            note: "¿Llegaste al final de tu feed? ¡Es el momento de publicar tu próximo vídeo!",
            tone: "info",
          },
        ]),
        pg("publish", "Publicar un vídeo", Video, [
          {
            p: "El Creator Studio (desde Descubrir) te guía paso a paso para publicar un buen vídeo.",
          },
          {
            ul: [
              "Elige tu archivo de vídeo (hasta 200 MB), añade un título claro y hasta 5 hashtags relevantes.",
              "Elige quién puede verlo: todos, o solo tus Sparks.",
              "Personaliza la miniatura eligiendo un fotograma directamente de un momento destacado del vídeo.",
              "Usa la herramienta de edición para cortar un clip, añadir sonido o texto antes de publicar.",
            ],
          },
          {
            note: "Un buen vídeo capta la atención en los primeros segundos: ve al grano.",
            tone: "tip",
          },
        ]),
        pg("boost", "Impulsar un vídeo", Rocket, [
          {
            p: "Impulsar gasta Blox para aumentar la visibilidad de un vídeo en el feed, durante el tiempo que elijas (de 1h a 24h).",
          },
          {
            ul: [
              "Se activa desde el Creator Studio, en cualquiera de tus vídeos públicos.",
              "Cuanto más larga la duración elegida, mayor el coste en Blox.",
            ],
          },
          {
            note: "Impulsar solo aumenta la visibilidad: nunca genera likes, vistas o seguidores falsos.",
            tone: "warn",
          },
        ]),
      ]),
      cat("social", "Sparks, Comunidades y Mensajes", Users, [
        pg("sparks", "Sparks: hacer match con otros jugadores", Heart, [
          {
            p: "Sparks es la función de citas de BloxSpark: desliza, haz match y chatea con jugadores que comparten tus juegos.",
          },
          {
            ul: [
              "Desliza a la derecha (o toca ❤️) para mostrar interés, a la izquierda (✕) para pasar.",
              "El chat se abre solo si el interés es mutuo.",
              "Usa los filtros rápidos para afinar: mismos juegos, mismo idioma, micrófono activado...",
              "El porcentaje de compatibilidad se calcula según juegos, idioma, país y edad en común.",
            ],
          },
          {
            note: "Nunca estás obligado a seguir una conversación incómoda: bloquea o denuncia en cualquier momento.",
            tone: "warn",
          },
        ]),
        pg("communities", "Comunidades: salas, roles, clasificación", Hash, [
          {
            p: "Cada comunidad funciona como un pequeño servidor, con salas de chat, roles y una clasificación de actividad.",
          },
          {
            ul: [
              "Únete a una comunidad existente o crea la tuya propia.",
              "Las Salas se organizan por categoría; el propietario y los moderadores pueden crear nuevas.",
              "La Clasificación premia la actividad de los últimos 30 días, no solo el número de miembros.",
              "Algunas comunidades son públicas, otras solo para amigos o por solicitud.",
            ],
          },
          {
            note: "El rol de un miembro determina el color de su nombre y sus permisos.",
            tone: "info",
          },
        ]),
        pg("messages", "Mensajes, grupos y notificaciones", MessageCircle, [
          { p: "Encuentra todas tus conversaciones, grupos y notificaciones en un mismo lugar." },
          {
            ul: [
              "El botón + arriba a la izquierda sirve para dos cosas: añadir un nuevo amigo, o crear un grupo con tus Sparks.",
              "Team Spark, fijado arriba de tus mensajes, reúne tu mensaje de bienvenida y las notificaciones de tus vídeos.",
              '"Actividad reciente" agrupa por separado tus matches y me gusta de Sparks.',
            ],
          },
          {
            note: "Activa o desactiva las notificaciones por categoría desde los ajustes.",
            tone: "tip",
          },
        ]),
        pg("streaks", "Rachas: mantener viva una conversación", Flame, [
          {
            p: "Aparece una llama 🔥 junto al nombre de alguien cuando ambos se escriben, cada día, en una conversación privada.",
          },
          {
            ul: [
              "La racha sube un día en cuanto los dos han enviado al menos un mensaje el mismo día.",
              "Si pasa un día sin ningún mensaje de ninguno de los dos lados, la llama se vuelve gris - un aviso de que aún queda algo de tiempo.",
              "Si nadie escribe a tiempo, la llama se rompe 💔 - pero no se pierde de inmediato: cualquiera de los dos puede restaurarla en las próximas 30 horas.",
              "Restaurar una racha rota es una ventaja de Spark Plus, limitada a 3 restauraciones al mes.",
              "Pasadas las 30 horas sin restaurarla, la racha se pierde para siempre y vuelve a empezar de cero con el próximo mensaje.",
            ],
          },
          {
            note: "Los grupos no tienen racha - solo aplica a conversaciones privadas entre dos personas.",
            tone: "info",
          },
        ]),
      ]),
      cat("economy", "Blox y Tienda", Coins, [
        pg("blox", "Blox, la moneda de BloxSpark", Gem, [
          {
            p: "Blox es la moneda virtual de BloxSpark: sirve para impulsar vídeos, comprar insignias, personalizar tu perfil o regalar a un creador.",
          },
          {
            ul: [
              "Compra Blox en la tienda en 5 packs, cada uno con un bono creciente.",
              "Gana Blox gratis cada día con los retos de la página de Recompensas.",
              "Regala Blox a un amigo o creador desde un comentario o una conversación privada.",
              "Tu saldo de Blox nunca caduca y no se puede convertir en dinero real.",
            ],
          },
          {
            note: "Cada transacción queda registrada en tu historial, en Compras y Facturación.",
            tone: "info",
          },
        ]),
        pg("plus", "Spark Plus y la tienda", Crown, [
          {
            p: "Spark Plus es la suscripción premium de BloxSpark: insignia exclusiva, efectos y temas premium, estadísticas avanzadas y soporte prioritario.",
          },
          {
            ul: [
              "Se suscribe y gestiona desde la Tienda, sin permanencia.",
              "La Blox Store ofrece insignias cosméticas compradas con Blox.",
              "Los pagos se procesan de forma segura con Stripe.",
            ],
          },
          {
            note: "Consulta Compras y Facturación para gestionar tu suscripción y facturas.",
            tone: "tip",
          },
        ]),
        pg("rewards", "Ganar Blox gratis", Gift, [
          {
            p: "La página de Recompensas ofrece cada día 3 retos aleatorios: dar like, comentar, publicar, visitar perfiles...",
          },
          {
            ul: [
              "Los retos se reinician cada día a medianoche, según tu zona horaria.",
              "Completa un reto para recibir sus Blox al instante.",
              "Vuelve cada día para aumentar tu racha de días activos.",
            ],
          },
          { note: "Algunos retos solo cuentan una vez por objetivo.", tone: "info" },
        ]),
      ]),
      cat("safety", "Seguridad y cuenta", Shield, [
        pg("verification", "Verificación (insignia verificada)", BadgeCheck, [
          {
            p: "La insignia de verificación confirma que un perfil notable o de confianza es auténtico.",
          },
          {
            ul: [
              "No hay un número mínimo de seguidores requerido.",
              "Los creadores activos con contenido original y de calidad pueden solicitarla.",
              "Personalidades, marcas y empresas reconocidas también pueden solicitarla.",
            ],
          },
          { note: "La verificación nunca se vende, bajo ninguna forma.", tone: "warn" },
        ]),
        pg("moderation", "Seguridad, bloqueo y denuncias", ShieldCheck, [
          { p: "Tu seguridad es lo primero en BloxSpark." },
          {
            ul: [
              "Bloquea un perfil para dejar de ver su contenido e impedir que te escriba.",
              "Denuncia contenido o a una persona desde su perfil, un vídeo o una conversación.",
              "Los mensajes con contenido problemático activan automáticamente una alerta de seguridad.",
            ],
          },
          {
            note: "Ante un peligro inmediato, contacta primero con los servicios de emergencia de tu país.",
            tone: "warn",
          },
        ]),
        pg("privacy", "Privacidad y gestión de la cuenta", Lock, [
          {
            p: "Mantienes el control sobre lo que otros ven de ti y sobre tu cuenta en todo momento.",
          },
          {
            ul: [
              "Elige quién puede escribirte o ver tu actividad reciente desde los ajustes de privacidad.",
              "El historial de visualización solo se guarda si lo activas explícitamente.",
              "Puedes eliminar tu cuenta de forma permanente desde los ajustes.",
            ],
          },
          {
            note: "La política de privacidad completa está en el pie de los ajustes.",
            tone: "tip",
          },
        ]),
      ]),
    ],
  },

  pt: {
    eyebrow: "Academia BloxSpark",
    title: "O guia completo do BloxSpark",
    searchPlaceholder: "Pesquisar no wiki...",
    categories: [
      cat("start", "Primeiros passos", Rocket, [
        pg("welcome", "Bem-vindo(a) ao BloxSpark", Sparkles, [
          {
            p: "BloxSpark é a rede social feita para jogadores de Roblox: compartilhe seus momentos de jogo em vídeo, conheça outros jogadores, entre em comunidades e converse com amigos, tudo em um só lugar.",
          },
          {
            ul: [
              "🎥 Descobrir — um feed vertical de vídeos de Roblox",
              "✨ Sparks — conheça e combine com outros jogadores que compartilham seus jogos",
              "👥 Comunidades — salas estilo Discord organizadas por jogo ou tema",
              "💬 Mensagens — converse com amigos, Sparks e a equipe do BloxSpark",
              "💰 Blox — a moeda virtual do app, ganhe de graça ou compre",
            ],
          },
          {
            note: "O jeito mais fácil de começar: conecte sua conta Roblox, personalize seu perfil e explore o Descobrir.",
            tone: "tip",
          },
        ]),
        pg("profile", "Conectar o Roblox e criar seu perfil", UserCircle, [
          { p: "Sua conta Roblox é o centro da sua identidade no BloxSpark." },
          {
            ul: [
              "Conecte sua conta Roblox para importar automaticamente seu nome de usuário, avatar e jogos favoritos.",
              "Escolha uma foto de perfil clara e escreva uma bio curta.",
              "Adicione seus jogos favoritos: eles ajudam a sugerir Sparks e comunidades relevantes.",
              "Defina seu idioma nas configurações: o app inteiro, incluindo este wiki, se adapta automaticamente.",
            ],
          },
          {
            note: "Nunca publique sua senha, dados de contato privados ou informações que revelem onde você mora.",
            tone: "warn",
          },
        ]),
      ]),
      cat("create", "Descobrir e criar", Compass, [
        pg("feed", "O feed do Descobrir", Video, [
          { p: "Duas abas dividem o feed do Descobrir, cada uma com sua própria lógica." },
          {
            ul: [
              "Para você — um feed personalizado que aprende com o que você assiste, curte, comenta e compartilha",
              "Seguindo — apenas vídeos de criadores que você segue, em ordem cronológica",
              "O feed Para você também considera o idioma de cada criador",
              'Use "Não tenho interesse" para ajustar suas recomendações, sem falsear suas estatísticas reais',
            ],
          },
          {
            note: "Chegou ao fim do seu feed? É hora de publicar o próximo vídeo você mesmo!",
            tone: "info",
          },
        ]),
        pg("publish", "Publicar um vídeo", Video, [
          {
            p: "O Creator Studio (a partir do Descobrir) te guia em várias etapas para publicar um bom vídeo.",
          },
          {
            ul: [
              "Escolha seu arquivo de vídeo (até 200 MB), dê um título claro e até 5 hashtags relevantes.",
              "Escolha quem pode ver: todo mundo, ou apenas seus Sparks.",
              "Personalize a miniatura escolhendo um quadro direto de um momento forte do vídeo.",
              "Use a ferramenta de edição para cortar um trecho, adicionar som ou texto antes de publicar.",
            ],
          },
          {
            note: "Um bom vídeo prende a atenção nos primeiros segundos: vá direto ao ponto.",
            tone: "tip",
          },
        ]),
        pg("boost", "Impulsionar um vídeo", Rocket, [
          {
            p: "Impulsionar gasta Blox para aumentar a visibilidade de um vídeo no feed, pelo tempo que você escolher (1h a 24h).",
          },
          {
            ul: [
              "Ativado a partir do Creator Studio, em qualquer vídeo público seu.",
              "Quanto maior a duração escolhida, maior o custo em Blox.",
            ],
          },
          {
            note: "Impulsionar só aumenta a visibilidade - nunca gera curtidas, visualizações ou seguidores falsos.",
            tone: "warn",
          },
        ]),
      ]),
      cat("social", "Sparks, Comunidades e Mensagens", Users, [
        pg("sparks", "Sparks: combinando com outros jogadores", Heart, [
          {
            p: "Sparks é o recurso de paquera do BloxSpark: deslize, combine e converse com jogadores que compartilham seus jogos.",
          },
          {
            ul: [
              "Deslize para a direita (ou toque em ❤️) para demonstrar interesse, para a esquerda (✕) para pular.",
              "Uma conversa só abre se o interesse for mútuo.",
              "Use os filtros rápidos: mesmos jogos, mesmo idioma, microfone ativado...",
              "A porcentagem de compatibilidade é calculada por jogos, idioma, país e idade em comum.",
            ],
          },
          {
            note: "Você nunca é obrigado a continuar uma conversa desconfortável - bloqueie ou denuncie quando quiser.",
            tone: "warn",
          },
        ]),
        pg("communities", "Comunidades: canais, cargos, ranking", Hash, [
          {
            p: "Cada comunidade funciona como um pequeno servidor, com canais de chat, cargos e um ranking de atividade.",
          },
          {
            ul: [
              "Entre em uma comunidade existente ou crie a sua.",
              "Os Canais são organizados por categoria; o dono e moderadores podem criar novos.",
              "O Ranking recompensa a atividade dos últimos 30 dias, não só o número de membros.",
              "Algumas comunidades são públicas, outras só para amigos ou por solicitação.",
            ],
          },
          { note: "O cargo de um membro define a cor do nome e suas permissões.", tone: "info" },
        ]),
        pg("messages", "Mensagens, grupos e notificações", MessageCircle, [
          { p: "Encontre todas as suas conversas, grupos e notificações em um só lugar." },
          {
            ul: [
              "O botão + no canto superior esquerdo serve para duas coisas: adicionar um novo amigo, ou criar um grupo com seus Sparks.",
              "Team Spark, fixado no topo das mensagens, reúne sua mensagem de boas-vindas e as notificações dos seus vídeos.",
              '"Atividade recente" agrupa separadamente seus matches e curtidas do Sparks.',
            ],
          },
          { note: "Ative ou desative notificações por categoria nas configurações.", tone: "tip" },
        ]),
        pg("streaks", "Sequências: manter uma conversa viva", Flame, [
          {
            p: "Uma chama 🔥 aparece ao lado do nome de alguém quando vocês dois se escrevem, todos os dias, em uma conversa privada.",
          },
          {
            ul: [
              "A sequência sobe um dia assim que vocês dois enviarem pelo menos uma mensagem no mesmo dia.",
              "Se passar um dia sem mensagem de nenhum dos dois lados, a chama fica cinza - um aviso de que ainda resta um pouco de tempo.",
              "Se ninguém escrever a tempo, a chama se apaga 💔 - mas não é perdida na hora: qualquer um de vocês pode restaurá-la em até 30 horas.",
              "Restaurar uma sequência quebrada é um benefício do Spark Plus, limitado a 3 restaurações por mês.",
              "Depois de 30 horas sem restaurar, a sequência é perdida para sempre e recomeça do zero na próxima mensagem.",
            ],
          },
          {
            note: "Grupos não têm sequência - ela só existe em conversas privadas entre duas pessoas.",
            tone: "info",
          },
        ]),
      ]),
      cat("economy", "Blox e Loja", Coins, [
        pg("blox", "Blox, a moeda do BloxSpark", Gem, [
          {
            p: "Blox é a moeda virtual do BloxSpark: usada para impulsionar vídeos, comprar emblemas, personalizar seu perfil ou presentear um criador.",
          },
          {
            ul: [
              "Compre Blox na loja em 5 pacotes, cada um com um bônus crescente.",
              "Ganhe Blox de graça todo dia com os desafios da página Recompensas.",
              "Presenteie Blox a um amigo ou criador direto de um comentário ou conversa privada.",
              "Seu saldo de Blox nunca expira e não pode ser convertido em dinheiro real.",
            ],
          },
          {
            note: "Toda transação fica registrada no seu histórico, em Compras e Faturamento.",
            tone: "info",
          },
        ]),
        pg("plus", "Spark Plus e a loja", Crown, [
          {
            p: "Spark Plus é a assinatura premium do BloxSpark: emblema exclusivo, efeitos e temas premium, estatísticas avançadas e suporte prioritário.",
          },
          {
            ul: [
              "Assine e gerencie direto pela Loja, sem fidelidade.",
              "A Blox Store oferece emblemas cosméticos comprados com Blox.",
              "Pagamentos processados com segurança pelo Stripe.",
            ],
          },
          {
            note: "Veja Compras e Faturamento para gerenciar sua assinatura e faturas.",
            tone: "tip",
          },
        ]),
        pg("rewards", "Ganhando Blox de graça", Gift, [
          {
            p: "A página Recompensas oferece 3 desafios diários sorteados: curtir, comentar, publicar, visitar perfis...",
          },
          {
            ul: [
              "Os desafios reiniciam todo dia à meia-noite, no seu fuso horário.",
              "Complete um desafio para receber os Blox na hora.",
              "Volte todo dia para aumentar sua sequência de dias ativos.",
            ],
          },
          { note: "Alguns desafios contam só uma vez por alvo.", tone: "info" },
        ]),
      ]),
      cat("safety", "Segurança e conta", Shield, [
        pg("verification", "Verificação (selo verificado)", BadgeCheck, [
          { p: "O selo de verificação confirma que um perfil notável ou confiável é autêntico." },
          {
            ul: [
              "Não há número mínimo de seguidores exigido.",
              "Criadores ativos com conteúdo original e de qualidade podem solicitar.",
              "Personalidades, marcas e empresas reconhecidas também podem solicitar.",
            ],
          },
          { note: "A verificação nunca é vendida, de nenhuma forma.", tone: "warn" },
        ]),
        pg("moderation", "Segurança, bloqueio e denúncias", ShieldCheck, [
          { p: "Sua segurança vem em primeiro lugar no BloxSpark." },
          {
            ul: [
              "Bloqueie um perfil para parar de ver o conteúdo dele e impedir que te escreva.",
              "Denuncie conteúdo ou uma pessoa direto do perfil, de um vídeo ou de uma conversa.",
              "Mensagens com conteúdo problemático disparam automaticamente um alerta de segurança.",
            ],
          },
          {
            note: "Em caso de perigo imediato, contate primeiro os serviços de emergência do seu país.",
            tone: "warn",
          },
        ]),
        pg("privacy", "Privacidade e gestão da conta", Lock, [
          {
            p: "Você mantém o controle sobre o que os outros veem e sobre sua conta, a qualquer momento.",
          },
          {
            ul: [
              "Escolha quem pode te escrever ou ver sua atividade recente nas configurações de privacidade.",
              "O histórico de visualização só é salvo se você ativar explicitamente.",
              "Você pode excluir sua conta permanentemente nas configurações.",
            ],
          },
          {
            note: "A política de privacidade completa está no rodapé das configurações.",
            tone: "tip",
          },
        ]),
      ]),
    ],
  },

  de: {
    eyebrow: "BloxSpark Academy",
    title: "Der komplette BloxSpark-Leitfaden",
    searchPlaceholder: "Wiki durchsuchen...",
    categories: [
      cat("start", "Erste Schritte", Rocket, [
        pg("welcome", "Willkommen bei BloxSpark", Sparkles, [
          {
            p: "BloxSpark ist das soziale Netzwerk für Roblox-Spieler: teile deine Spielmomente als Video, lerne andere Spieler kennen, tritt Communitys bei und chatte mit Freunden - alles an einem Ort.",
          },
          {
            ul: [
              "🎥 Entdecken — ein vertikaler Feed mit Roblox-Videos",
              "✨ Sparks — lerne Spieler mit denselben Spielen kennen und matche mit ihnen",
              "👥 Communitys — Discord-artige Räume, organisiert nach Spiel oder Thema",
              "💬 Nachrichten — chatte mit Freunden, Sparks und dem BloxSpark-Team",
              "💰 Blox — die virtuelle Währung der App, kostenlos verdienen oder kaufen",
            ],
          },
          {
            note: "Der einfachste Start: Roblox verbinden, Profil personalisieren, dann bei Entdecken reinschauen.",
            tone: "tip",
          },
        ]),
        pg("profile", "Roblox verbinden & Profil erstellen", UserCircle, [
          { p: "Dein Roblox-Konto steht im Zentrum deiner Identität auf BloxSpark." },
          {
            ul: [
              "Verbinde dein Roblox-Konto, um Benutzername, Avatar und Lieblingsspiele automatisch zu importieren.",
              "Wähle ein klares Profilbild und schreibe eine kurze Bio.",
              "Füge deine Lieblingsspiele hinzu - sie helfen bei passenden Spark- und Community-Vorschlägen.",
              "Stelle deine Sprache in den Einstellungen ein: die ganze App, auch dieses Wiki, passt sich automatisch an.",
            ],
          },
          {
            note: "Veröffentliche niemals dein Passwort, private Kontaktdaten oder Infos, die deinen Wohnort verraten.",
            tone: "warn",
          },
        ]),
      ]),
      cat("create", "Entdecken & erstellen", Compass, [
        pg("feed", "Der Entdecken-Feed", Video, [
          { p: "Zwei Tabs teilen sich den Entdecken-Feed, jeder mit eigener Logik." },
          {
            ul: [
              "Für dich — ein personalisierter Feed, der aus deinem Verhalten lernt",
              "Abonniert — nur Videos von Creatorn, denen du folgst, chronologisch",
              "Der Für-dich-Feed berücksichtigt auch die Sprache jedes Creators",
              'Nutze "Kein Interesse", um Empfehlungen zu verfeinern, ohne echte Statistiken zu verfälschen',
            ],
          },
          {
            note: "Am Ende deines Feeds angekommen? Zeit, selbst das nächste Video zu posten!",
            tone: "info",
          },
        ]),
        pg("publish", "Ein Video veröffentlichen", Video, [
          {
            p: "Creator Studio (über Entdecken erreichbar) führt dich Schritt für Schritt zur Veröffentlichung.",
          },
          {
            ul: [
              "Wähle deine Videodatei (bis 200 MB), gib einen klaren Titel und bis zu 5 passende Hashtags an.",
              "Wähle, wer es sehen darf: alle, oder nur deine Sparks.",
              "Passe das Vorschaubild an, indem du einen Frame direkt aus einem starken Moment deines Videos wählst.",
              "Nutze das Bearbeitungstool, um einen Clip zu schneiden, Ton oder Text vor der Veröffentlichung hinzuzufügen.",
            ],
          },
          {
            note: "Ein gutes Video fesselt in den ersten Sekunden: komm direkt zum Punkt.",
            tone: "tip",
          },
        ]),
        pg("boost", "Ein Video boosten", Rocket, [
          {
            p: "Ein Boost gibt Blox aus, um die Sichtbarkeit eines Videos im Feed für eine gewählte Dauer (1-24 Std.) zu erhöhen.",
          },
          {
            ul: [
              "Startet im Creator Studio, bei jedem öffentlichen Video.",
              "Je länger die gewählte Dauer, desto höher die Blox-Kosten.",
            ],
          },
          {
            note: "Ein Boost erhöht nur die Sichtbarkeit - nie werden Likes, Views oder Follower fingiert.",
            tone: "warn",
          },
        ]),
      ]),
      cat("social", "Sparks, Communitys & Nachrichten", Users, [
        pg("sparks", "Sparks: mit anderen Spielern matchen", Heart, [
          {
            p: "Sparks ist BloxSparks Matching-Funktion: wische, matche und chatte mit Spielern, die deine Spiele teilen.",
          },
          {
            ul: [
              "Nach rechts wischen (oder ❤️) für Interesse, nach links (✕) für Weiter.",
              "Ein Chat öffnet sich nur bei gegenseitigem Interesse.",
              "Nutze Schnellfilter: gleiche Spiele, gleiche Sprache, Mikro aktiv...",
              "Die Kompatibilität wird aus gemeinsamen Spielen, Sprache, Land und Alter berechnet.",
            ],
          },
          {
            note: "Du musst nie ein unangenehmes Gespräch fortsetzen - blockiere oder melde jederzeit.",
            tone: "warn",
          },
        ]),
        pg("communities", "Communitys: Kanäle, Rollen, Rangliste", Hash, [
          {
            p: "Jede Community funktioniert wie ein kleiner Server, mit Chat-Kanälen, Rollen und einer Aktivitäts-Rangliste.",
          },
          {
            ul: [
              "Tritt einer bestehenden Community bei oder gründe deine eigene.",
              "Kanäle sind nach Kategorie organisiert; Owner und Moderatoren können neue erstellen.",
              "Die Rangliste belohnt Aktivität der letzten 30 Tage, nicht nur die Mitgliederzahl.",
              "Manche Communitys sind öffentlich, andere nur für Freunde oder per Beitrittsanfrage.",
            ],
          },
          {
            note: "Die Rolle eines Mitglieds bestimmt Namensfarbe und Berechtigungen.",
            tone: "info",
          },
        ]),
        pg("messages", "Nachrichten, Gruppen und Benachrichtigungen", MessageCircle, [
          { p: "Finde alle deine Chats, Gruppen und Benachrichtigungen an einem Ort." },
          {
            ul: [
              "Der + Button oben links macht zwei Dinge: einen neuen Freund hinzufügen, oder eine Gruppe mit deinen Sparks erstellen.",
              "Team Spark, oben angeheftet, sammelt deine Willkommensnachricht und alle Video-Benachrichtigungen.",
              '"Letzte Aktivität" gruppiert separat deine Sparks-Matches und erhaltenen Likes.',
            ],
          },
          {
            note: "Schalte Benachrichtigungen kategorienweise in den Kontoeinstellungen ein oder aus.",
            tone: "tip",
          },
        ]),
        pg("streaks", "Serien: eine Unterhaltung am Leben halten", Flame, [
          {
            p: "Eine Flamme 🔥 erscheint neben dem Namen von jemandem, wenn ihr euch beide, jeden Tag, in einer privaten Unterhaltung schreibt.",
          },
          {
            ul: [
              "Die Serie steigt um einen Tag, sobald ihr beide am selben Tag mindestens eine Nachricht gesendet habt.",
              "Vergeht ein Tag ohne Nachricht von beiden Seiten, wird die Flamme grau - ein Hinweis, dass noch etwas Zeit bleibt.",
              "Schreibt niemand rechtzeitig, erlischt die Flamme 💔 - verloren ist sie aber nicht sofort: einer von euch beiden kann sie innerhalb von 30 Stunden wiederherstellen.",
              "Eine erloschene Serie wiederherzustellen ist ein Spark-Plus-Vorteil, begrenzt auf 3 Wiederherstellungen pro Monat.",
              "Nach 30 Stunden ohne Wiederherstellung ist die Serie endgültig verloren und beginnt bei der nächsten Nachricht wieder bei null.",
            ],
          },
          {
            note: "Gruppen haben keine Serie - sie gilt nur für private Unterhaltungen zwischen zwei Personen.",
            tone: "info",
          },
        ]),
      ]),
      cat("economy", "Blox & Shop", Coins, [
        pg("blox", "Blox, die Währung von BloxSpark", Gem, [
          {
            p: "Blox ist BloxSparks virtuelle Währung: für Video-Boosts, Abzeichen, Profil-Personalisierung oder Geschenke an Creator.",
          },
          {
            ul: [
              "Kaufe Blox im Shop in 5 Paketen, jedes mit steigendem Bonus.",
              "Verdiene täglich kostenlos Blox über die Herausforderungen auf der Belohnungen-Seite.",
              "Verschenke Blox an Freunde oder Creator direkt aus einem Kommentar oder Chat.",
              "Dein Blox-Guthaben verfällt nie und kann nicht in echtes Geld umgewandelt werden.",
            ],
          },
          {
            note: "Jede Transaktion wird in deinem Verlauf unter Käufe & Abrechnung protokolliert.",
            tone: "info",
          },
        ]),
        pg("plus", "Spark Plus & der Shop", Crown, [
          {
            p: "Spark Plus ist BloxSparks Premium-Abo: exklusives Abzeichen, Premium-Effekte und -Themes, erweiterte Statistiken und priorisierter Support.",
          },
          {
            ul: [
              "Abo direkt im Shop verwalten, ohne Mindestlaufzeit.",
              "Der Blox Store bietet kosmetische Abzeichen, mit Blox gekauft.",
              "Zahlungen werden sicher über Stripe abgewickelt.",
            ],
          },
          { note: "Käufe & Abrechnung zeigt dein Abo und alle Rechnungen.", tone: "tip" },
        ]),
        pg("rewards", "Kostenlos Blox verdienen", Gift, [
          {
            p: "Die Belohnungen-Seite bietet täglich 3 zufällige Herausforderungen: liken, kommentieren, posten, Profile besuchen...",
          },
          {
            ul: [
              "Herausforderungen setzen sich täglich um Mitternacht (deine Zeitzone) zurück.",
              "Schließe eine Herausforderung ab, um sofort Blox zu erhalten.",
              "Komm täglich wieder, um deine Streak zu steigern.",
            ],
          },
          { note: "Manche Herausforderungen zählen nur einmal pro Ziel.", tone: "info" },
        ]),
      ]),
      cat("safety", "Sicherheit & Konto", Shield, [
        pg("verification", "Verifizierung (Häkchen-Abzeichen)", BadgeCheck, [
          {
            p: "Das Verifizierungs-Abzeichen bestätigt die Echtheit einer bekannten oder vertrauenswürdigen Präsenz.",
          },
          {
            ul: [
              "Es gibt keine Mindest-Followerzahl.",
              "Aktive Creator mit regelmäßigem, hochwertigem Original-Content können sich bewerben.",
              "Bekannte Persönlichkeiten, Marken und Unternehmen können sich ebenfalls bewerben.",
            ],
          },
          { note: "Verifizierung wird niemals verkauft, in keiner Form.", tone: "warn" },
        ]),
        pg("moderation", "Sicherheit, Blockieren und Melden", ShieldCheck, [
          { p: "Deine Sicherheit hat bei BloxSpark oberste Priorität." },
          {
            ul: [
              "Blockiere ein Profil, um dessen Inhalte nicht mehr zu sehen und Nachrichten zu verhindern.",
              "Melde Inhalte oder Personen direkt vom Profil, einem Video oder Chat aus.",
              "Nachrichten mit problematischen Inhalten lösen automatisch einen Sicherheitshinweis aus.",
            ],
          },
          {
            note: "Bei akuter Gefahr wende dich immer zuerst an die Notdienste deines Landes.",
            tone: "warn",
          },
        ]),
        pg("privacy", "Datenschutz und Kontoverwaltung", Lock, [
          {
            p: "Du behältst jederzeit die Kontrolle darüber, was andere von dir sehen, und über dein Konto.",
          },
          {
            ul: [
              "Lege in den Datenschutzeinstellungen fest, wer dich kontaktieren oder deine Aktivität sehen darf.",
              "Der Wiedergabeverlauf wird nur gespeichert, wenn du ihn ausdrücklich aktivierst.",
              "Du kannst dein Konto jederzeit dauerhaft in den Einstellungen löschen.",
            ],
          },
          {
            note: "Die vollständige Datenschutzerklärung findest du am Ende der Einstellungen.",
            tone: "tip",
          },
        ]),
      ]),
    ],
  },

  ko: {
    eyebrow: "BloxSpark 아카데미",
    title: "BloxSpark 완벽 가이드",
    searchPlaceholder: "위키 검색...",
    categories: [
      cat("start", "시작하기", Rocket, [
        pg("welcome", "BloxSpark에 오신 걸 환영해요", Sparkles, [
          {
            p: "BloxSpark는 로블록스 플레이어를 위한 소셜 네트워크예요. 게임 순간을 영상으로 공유하고, 다른 플레이어를 만나고, 커뮤니티에 참여하고, 친구와 대화할 수 있는 공간이에요.",
          },
          {
            ul: [
              "🎥 디스커버 — 세로형 로블록스 영상 피드",
              "✨ Sparks — 같은 게임을 즐기는 플레이어와 매칭",
              "👥 커뮤니티 — 게임이나 주제별로 모인 디스코드 스타일 채널",
              "💬 메시지 — 친구, Sparks, BloxSpark 팀과 대화",
              "💰 Blox — 앱의 가상 재화, 무료로 모으거나 구매",
            ],
          },
          {
            note: "가장 쉬운 시작 방법: Roblox 계정을 연결하고 프로필을 꾸민 다음 디스커버를 둘러보세요.",
            tone: "tip",
          },
        ]),
        pg("profile", "Roblox 연결과 프로필 만들기", UserCircle, [
          { p: "Roblox 계정은 BloxSpark에서 나를 나타내는 핵심이에요." },
          {
            ul: [
              "Roblox 계정을 연결하면 사용자 이름, 아바타, 좋아하는 게임이 자동으로 가져와져요.",
              "선명한 프로필 사진과 짧은 소개글을 준비하세요.",
              "좋아하는 게임을 추가하면 관련된 Sparks와 커뮤니티를 추천받아요.",
              "설정에서 언어를 지정하면 이 위키를 포함한 앱 전체가 자동으로 맞춰져요.",
            ],
          },
          {
            note: "비밀번호, 개인 연락처, 정확한 위치를 알 수 있는 정보는 절대 게시하지 마세요.",
            tone: "warn",
          },
        ]),
      ]),
      cat("create", "디스커버 & 제작", Compass, [
        pg("feed", "디스커버 피드", Video, [
          { p: "디스커버 피드는 두 개의 탭으로 나뉘어요." },
          {
            ul: [
              "추천 — 시청, 좋아요, 댓글, 공유 기록을 바탕으로 한 맞춤 피드",
              "팔로잉 — 팔로우한 크리에이터의 영상만 시간순으로",
              "추천 피드는 크리에이터의 언어도 고려해요",
              '"관심 없음"으로 추천을 조정할 수 있고, 실제 통계는 절대 왜곡되지 않아요',
            ],
          },
          { note: "피드 끝에 도달했다면, 이제 직접 다음 영상을 올릴 차례예요!", tone: "info" },
        ]),
        pg("publish", "영상 올리기", Video, [
          {
            p: "크리에이터 스튜디오(디스커버에서 접근)가 영상을 잘 준비해서 올리도록 단계별로 안내해요.",
          },
          {
            ul: [
              "영상 파일(최대 200MB)을 선택하고 명확한 제목과 최대 5개의 해시태그를 추가하세요.",
              "공개 대상을 선택하세요: 전체 공개 또는 내 Sparks에게만.",
              "영상의 인상적인 순간에서 프레임을 골라 썸네일로 지정하세요.",
              "편집 도구로 클립을 자르거나, 소리나 텍스트를 영상에 추가한 뒤 게시하세요.",
            ],
          },
          {
            note: "좋은 영상은 처음 몇 초 안에 시선을 끌어요: 바로 본론으로 들어가세요.",
            tone: "tip",
          },
        ]),
        pg("boost", "영상 부스트하기", Rocket, [
          {
            p: "부스트는 Blox를 사용해서 선택한 시간(1~24시간) 동안 피드에서 영상의 노출을 높여줘요.",
          },
          {
            ul: [
              "크리에이터 스튜디오에서 공개 영상 중 하나에 적용할 수 있어요.",
              "선택한 시간이 길수록 Blox 비용이 늘어나요.",
            ],
          },
          {
            note: "부스트는 노출만 높여줄 뿐, 좋아요·조회수·팔로워를 절대 조작하지 않아요.",
            tone: "warn",
          },
        ]),
      ]),
      cat("social", "Sparks, 커뮤니티 & 메시지", Users, [
        pg("sparks", "Sparks: 다른 플레이어와 매칭", Heart, [
          {
            p: "Sparks는 BloxSpark의 매칭 기능이에요. 스와이프하고, 매칭하고, 같은 게임을 즐기는 플레이어와 대화하세요.",
          },
          {
            ul: [
              "오른쪽으로 스와이프(또는 ❤️)하면 관심 표시, 왼쪽(✕)이면 다음 프로필로.",
              "서로 관심을 표시해야만 대화가 열려요.",
              "빠른 필터로 덱을 좁혀보세요: 같은 게임, 같은 언어, 마이크 사용 여부 등.",
              "표시되는 궁합 비율은 공통 게임, 언어, 국가, 나이를 기준으로 계산돼요.",
            ],
          },
          {
            note: "불편한 대화를 이어갈 의무는 없어요. 언제든 차단하거나 신고하세요.",
            tone: "warn",
          },
        ]),
        pg("communities", "커뮤니티: 채널, 역할, 랭킹", Hash, [
          { p: "각 커뮤니티는 채팅 채널, 역할, 활동 랭킹을 갖춘 작은 서버처럼 작동해요." },
          {
            ul: [
              "기존 커뮤니티에 참여하거나 직접 만들어보세요.",
              "채널은 카테고리별로 정리되며, 운영자와 관리자가 새로 만들 수 있어요.",
              "랭킹은 최근 30일간의 활동을 기준으로 하며, 단순 멤버 수가 아니에요.",
              "일부 커뮤니티는 공개, 일부는 친구 전용이거나 가입 승인이 필요해요.",
            ],
          },
          { note: "멤버의 역할에 따라 이름 색상과 권한이 정해져요.", tone: "info" },
        ]),
        pg("messages", "메시지, 그룹, 알림", MessageCircle, [
          { p: "모든 대화, 그룹, 알림을 한곳에서 확인하세요." },
          {
            ul: [
              "왼쪽 위 + 버튼은 두 가지 역할을 해요: 새 친구 추가(사용자 이름 검색), 또는 내 Sparks로 그룹 만들기.",
              "메시지 맨 위에 고정된 Team Spark는 환영 메시지와 영상 관련 모든 알림(좋아요, 댓글, 즐겨찾기, 리포스트)을 모아 보여줘요.",
              '"최근 활동"은 Sparks 매칭과 받은 좋아요를 별도로 모아 보여줘요.',
            ],
          },
          { note: "계정 설정에서 카테고리별로 알림을 켜고 끌 수 있어요.", tone: "tip" },
        ]),
        pg("streaks", "연속 기록: 대화를 계속 이어가기", Flame, [
          {
            p: "1:1 대화에서 매일 서로 메시지를 주고받으면 상대방 이름 옆에 불꽃 🔥이 나타나요.",
          },
          {
            ul: [
              "같은 날 두 사람 모두 메시지를 한 번씩 보내면 연속 기록이 하루 늘어나요.",
              "하루라도 양쪽 다 메시지를 보내지 않으면 불꽃이 회색으로 바뀌어요 - 아직 시간이 조금 남았다는 신호예요.",
              "제때 메시지를 보내지 않으면 불꽃이 꺼져요 💔 - 하지만 바로 사라지는 건 아니에요: 30시간 안에 둘 중 한 명이 복구할 수 있어요.",
              "끊긴 연속 기록 복구는 Spark Plus 혜택이며, 한 달에 3번까지만 가능해요.",
              "30시간이 지나도록 복구하지 않으면 연속 기록은 완전히 사라지고, 다음 메시지부터 다시 0에서 시작해요.",
            ],
          },
          {
            note: "그룹에는 연속 기록이 없어요 - 1:1 개인 대화에서만 적용돼요.",
            tone: "info",
          },
        ]),
      ]),
      cat("economy", "Blox & 상점", Coins, [
        pg("blox", "BloxSpark의 재화, Blox", Gem, [
          {
            p: "Blox는 BloxSpark의 가상 재화예요. 영상 부스트, 배지 구매, 프로필 꾸미기, 크리에이터에게 선물하기에 사용해요.",
          },
          {
            ul: [
              "상점에서 5가지 패키지로 Blox를 구매할 수 있고, 각각 보너스가 커져요.",
              "리워드 페이지의 도전 과제로 매일 무료로 Blox를 얻을 수 있어요.",
              "댓글이나 개인 메시지에서 바로 친구나 크리에이터에게 Blox를 선물할 수 있어요.",
              "Blox 잔액은 계정이 활성 상태인 한 만료되지 않고, 실제 돈으로 바꿀 수 없어요.",
            ],
          },
          { note: "모든 거래는 구매 및 결제 내역에 기록돼요.", tone: "info" },
        ]),
        pg("plus", "Spark Plus와 상점", Crown, [
          {
            p: "Spark Plus는 BloxSpark의 프리미엄 구독으로, 전용 배지, 프리미엄 효과와 테마, 고급 통계, 우선 지원을 제공해요.",
          },
          {
            ul: [
              "상점에서 바로 구독하고 관리할 수 있으며, 약정 없이 언제든 해지 가능해요.",
              "Blox Store에서는 Blox로 구매하는 꾸미기 배지를 제공해요.",
              "결제는 Stripe를 통해 안전하게 처리돼요.",
            ],
          },
          { note: "구매 및 결제 페이지에서 구독과 모든 영수증을 확인하세요.", tone: "tip" },
        ]),
        pg("rewards", "Blox 무료로 얻기", Gift, [
          {
            p: "리워드 페이지는 매일 좋아요, 댓글, 게시, 프로필 방문 등 더 큰 목록에서 무작위로 3개의 도전 과제를 제공해요.",
          },
          {
            ul: [
              "도전 과제는 각자의 시간대 기준 매일 자정에 초기화돼요.",
              "도전 과제를 완료하면 즉시 Blox와 함께 보상 애니메이션을 받아요.",
              "매일 접속해서 연속 활동 스트릭을 쌓아보세요.",
            ],
          },
          { note: "일부 도전 과제는 같은 대상에 대해 한 번만 집계돼요.", tone: "info" },
        ]),
      ]),
      cat("safety", "안전 & 계정", Shield, [
        pg("verification", "인증(체크마크 배지)", BadgeCheck, [
          { p: "인증 배지는 주목받거나 신뢰할 수 있는 계정이 진짜임을 확인해줘요." },
          {
            ul: [
              "최소 팔로워 수 조건은 없어요.",
              "독창적이고 품질 높은 콘텐츠를 꾸준히 올리는 활동적인 크리에이터가 신청할 수 있어요.",
              "유명인, 브랜드, 기업도 신청할 수 있어요.",
            ],
          },
          { note: "인증은 어떤 형태로도 절대 판매되지 않아요.", tone: "warn" },
        ]),
        pg("moderation", "안전, 차단 및 신고", ShieldCheck, [
          { p: "BloxSpark에서는 안전이 최우선이에요." },
          {
            ul: [
              "프로필을 차단하면 콘텐츠가 보이지 않고 메시지도 받지 않아요.",
              "프로필, 영상, 대화에서 바로 콘텐츠나 사람을 신고할 수 있어요.",
              "문제가 되는 메시지는 관련 참여자에게 자동으로 안전 알림을 보내요.",
            ],
          },
          {
            note: "즉각적인 위험이 있다면 항상 먼저 해당 국가의 긴급 서비스에 연락하세요.",
            tone: "warn",
          },
        ]),
        pg("privacy", "개인정보 보호와 계정 관리", Lock, [
          { p: "다른 사람에게 보이는 정보와 내 계정을 언제든 직접 관리할 수 있어요." },
          {
            ul: [
              "개인정보 설정에서 누가 메시지를 보낼 수 있는지, 최근 활동을 볼 수 있는지 정하세요.",
              "시청 기록은 직접 활성화했을 때만 저장되며 비공개로 유지돼요.",
              "설정에서 언제든 계정을 영구적으로 삭제할 수 있어요.",
            ],
          },
          { note: "전체 개인정보 처리방침은 설정 하단에서 확인할 수 있어요.", tone: "tip" },
        ]),
      ]),
    ],
  },
};

function flattenPages(categories: WikiCategory[]) {
  return categories.flatMap((category) => category.pages.map((page) => ({ category, page })));
}

function WikiPage() {
  const { t, lang } = useI18n();
  const copy = WIKI[lang];
  const flat = useMemo(() => flattenPages(copy.categories), [copy]);
  const [activePageId, setActivePageId] = useState(flat[0]?.page.id ?? "");
  const [query, setQuery] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const activeIndex = flat.findIndex((entry) => entry.page.id === activePageId);
  const active = flat[activeIndex] ?? flat[0];
  const prev = flat[activeIndex - 1];
  const next = flat[activeIndex + 1];

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return flat.filter(
      ({ page }) =>
        page.title.toLowerCase().includes(q) ||
        page.blocks.some(
          (block) =>
            ("p" in block && block.p.toLowerCase().includes(q)) ||
            ("ul" in block && block.ul.some((item) => item.toLowerCase().includes(q))) ||
            ("note" in block && block.note.toLowerCase().includes(q)),
        ),
    );
  }, [flat, query]);

  function selectPage(id: string) {
    setActivePageId(id);
    setMobileNavOpen(false);
    setQuery("");
  }

  const sidebar = (
    <nav className="space-y-5">
      {copy.categories.map((category) => (
        <div key={category.id}>
          <p className="flex items-center gap-1.5 px-2 text-[11px] font-black uppercase tracking-wide text-muted-foreground">
            <category.icon className="h-3.5 w-3.5" /> {category.title}
          </p>
          <div className="mt-1.5 space-y-0.5">
            {category.pages.map((page) => (
              <button
                key={page.id}
                onClick={() => selectPage(page.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl border-l-2 px-2.5 py-2 text-left text-sm font-semibold transition",
                  active?.page.id === page.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-transparent text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                )}
              >
                <page.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{page.title}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl gap-8 px-4 pb-28 pt-6">
      {/* Desktop sidebar */}
      <aside className="sticky top-6 hidden h-[calc(100dvh-3rem)] w-64 shrink-0 overflow-y-auto pr-2 lg:block">
        <p className="flex items-center gap-2 px-2 text-lg font-black">
          <BookOpen className="h-5 w-5 text-primary" /> Wiki
        </p>
        <p className="mb-4 px-2 text-xs text-muted-foreground">{copy.eyebrow}</p>
        {sidebar}
      </aside>

      <main className="min-w-0 flex-1">
        {/* Header row: mobile menu + search */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3.5 py-2.5 text-sm font-bold"
          >
            <Menu className="h-4 w-4" /> {t("menu")}
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-card px-3.5 py-2.5 shadow-sm transition focus-within:border-primary/40 lg:mt-0">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copy.searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query ? (
            <button onClick={() => setQuery("")} aria-label="Clear">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          ) : null}
        </div>

        {searchResults ? (
          <div className="mt-5 space-y-1.5">
            {searchResults.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">{t("noResults")}</p>
            ) : (
              searchResults.map(({ category, page }) => (
                <button
                  key={page.id}
                  onClick={() => selectPage(page.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition hover:border-primary/30 hover:shadow-sm"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <page.icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{page.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {category.title}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        ) : active ? (
          <article className="mt-6">
            <p className="text-xs font-bold uppercase tracking-wide text-primary">
              {active.category.title}
            </p>
            <h1 className="mt-1 flex items-center gap-2.5 text-3xl font-black leading-tight">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <active.page.icon className="h-5 w-5" />
              </span>
              {active.page.title}
            </h1>

            <div className="prose-wiki mt-6 space-y-4">
              {active.page.blocks.map((block, i) =>
                "p" in block ? (
                  <p key={i} className="text-[15px] leading-relaxed text-foreground/90">
                    {block.p}
                  </p>
                ) : "ul" in block ? (
                  <ul key={i} className="space-y-2.5 rounded-2xl border border-border bg-card p-4">
                    {block.ul.map((item, j) => (
                      <li key={j} className="flex gap-2.5 text-sm leading-relaxed">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div
                    key={i}
                    className={cn(
                      "flex items-start gap-2.5 rounded-2xl border p-4 text-sm font-medium leading-relaxed",
                      NOTE_STYLES[block.tone],
                    )}
                  >
                    {(() => {
                      const Icon = NOTE_ICONS[block.tone];
                      return <Icon className="mt-0.5 h-4 w-4 shrink-0" />;
                    })()}
                    <span>{block.note}</span>
                  </div>
                ),
              )}
            </div>

            <div className="mt-10 grid grid-cols-2 gap-3 border-t border-border pt-6">
              {prev ? (
                <button
                  onClick={() => selectPage(prev.page.id)}
                  className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3.5 text-left transition hover:border-primary/30"
                >
                  <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase text-muted-foreground">
                      {t("wikiPrevious")}
                    </span>
                    <span className="block truncate text-sm font-bold">{prev.page.title}</span>
                  </span>
                </button>
              ) : (
                <span />
              )}
              {next ? (
                <button
                  onClick={() => selectPage(next.page.id)}
                  className="flex items-center justify-end gap-2 rounded-2xl border border-border bg-card p-3.5 text-right transition hover:border-primary/30"
                >
                  <span className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase text-muted-foreground">
                      {t("wikiNext")}
                    </span>
                    <span className="block truncate text-sm font-bold">{next.page.title}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ) : (
                <span />
              )}
            </div>
          </article>
        ) : null}
      </main>

      <Sheet open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} title="Wiki">
        {sidebar}
      </Sheet>
    </div>
  );
}
