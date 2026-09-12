# Bloxspark — réseau social & rencontres pour joueurs Roblox

Application mobile-first, non affiliée à Roblox Corporation (mention visible partout).
Thème noir ou blanc au choix, avec le logo correspondant (blanc sur noir, noir sur blanc).

## Ce que l'utilisateur obtient

**Inscription / connexion**
- Compte par e-mail + mot de passe, et bouton « Continuer avec Google ».
- Étapes d'inscription : nom d'utilisateur Bloxspark, pseudo Roblox, langue, date de naissance.
- Âge minimum 13 ans. Entre 13 et 17 ans : case d'accord parental obligatoire (nom et e-mail du parent enregistrés). Moins de 13 ans : inscription refusée avec explication.
- Choix du thème (noir/blanc) dès l'inscription, modifiable ensuite dans les paramètres.

**Sparks (swipe)**
- Pile de cartes de profils : avatar Roblox, pseudo, âge, langue, bio, décorations.
- Swipe gauche/droite (et boutons), « super spark » limité, match quand c'est réciproque, animation de match menant à la conversation.
- Filtres : langue, tranche d'âge.

**Messages**
- Liste de conversations style TikTok, discussions privées et groupes.
- Texte, émojis, photos, messages vocaux enregistrés directement dans le chat.
- Accusés de lecture, indicateur « en train d'écrire », arrivée des messages en direct.

**Profil**
- Ses photos d'avatar Roblox, bio, badges, décorations (bannière, cadre, couleur d'accent, stickers).
- Icône engrenage vers les paramètres : thème, langue, notifications, blocages, confidentialité, suppression du compte.
- Changement de pseudo limité à une fois tous les 7 jours, avec compte à rebours affiché.

**Notifications**
- Page listant matchs, messages, likes, mentions ; marquage lu / tout lu ; pastille de compteur.

**Pages légales**
- Conditions d'utilisation et Politique de confidentialité longues et professionnelles (données collectées, âge, mineurs et accord parental, modération, signalement, suppression, contact), plus règles de la communauté.
- Mention « non affilié à Roblox Corporation » en pied de page et à l'inscription.

**Navigation**
- Barre fixe en bas sur mobile : Sparks, Messages, Notifications, Profil.
- Sécurité : signalement et blocage d'un profil ou d'un message, masquage immédiat.

## Détails techniques

- Activation de Lovable Cloud : base de données, comptes, stockage des photos et des audios.
- Tables : profils, décorations, swipes, matchs, conversations, participants, messages, signalements, blocages, notifications, préférences. Sécurité au niveau des lignes sur chaque table ; seuls les membres d'une conversation lisent ses messages.
- Journal des changements de pseudo pour appliquer la règle des 7 jours côté serveur.
- Stockage : deux espaces (photos de profil, messages vocaux) avec accès restreint.
- Temps réel pour les messages et les notifications.
- Thème via les jetons de couleur du design system (mode clair/sombre), logos importés comme ressources CDN.
- Pages : `/` (accueil public), `/auth`, `/onboarding`, puis `/sparks`, `/messages`, `/messages/$id`, `/notifications`, `/profil`, `/parametres` protégées ; `/conditions`, `/confidentialite`, `/regles` publiques.

## Ordre de construction

1. Cloud + schéma + politiques de sécurité + stockage
2. Thème, logos, mise en page et barre de navigation
3. Auth + inscription en étapes (âge, accord parental)
4. Sparks et matchs
5. Messagerie (texte, photos, vocal, groupes, temps réel)
6. Profil, décorations, paramètres, règle des 7 jours
7. Notifications, signalement/blocage
8. Pages légales et finitions
