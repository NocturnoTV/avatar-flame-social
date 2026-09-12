# Bloxspark — Profil, Sparks, Admin et Paramètres

## 1. Profil enrichi

- **Avatar Roblox** : bouton d'upload dédié sur la photo de profil (remplace l'usage de la 1re photo), aperçu immédiat.
- **Bannière image** : possibilité d'envoyer sa propre image de bannière en plus des dégradés existants, avec option « retirer l'image ».
- **Galerie photos** : jusqu'à 9 photos, réorganisation (déplacer à gauche/droite), suppression, photo principale indiquée.
- **Jeux Roblox préférés** : sous la bio, ajout de 5 jeux maximum (nom + lien facultatif), affichés en puces sur le profil et sur les cartes Sparks.
- **Badge certifié** : coche bleue affichée à côté du pseudo partout (profil, Sparks, messages, Découvrir) pour les membres certifiés.

## 2. Sparks réels

- Les cartes utilisent l'avatar, la galerie, les jeux préférés et le badge certifié.
- Nouvel onglet « Matchs » sur la page Sparks : liste des matchs réels avec accès direct à la conversation, plus les « J'aime reçus ».
- Message de match qui ouvre la discussion créée automatiquement.

## 3. Dashboard admin (`/admin`, non listé)

Accessible uniquement aux administrateurs (rôle stocké en base, jamais côté navigateur). `arthur.buchon@outlook.fr` est nommé administrateur.

- **Vue d'ensemble** : nombre de membres, profils complétés, matchs, messages, vidéos, signalements en attente.
- **Membres** : recherche, consultation, attribution/retrait de la certification, attribution du rôle modérateur/admin.
- **Signalements** : liste des signalements avec contexte et marquage traité.
- **Surveillance des conversations** : liste des conversations avec participants et lecture des messages pour modération.
- **Journal d'audit** : chaque action admin (certification, rôle, consultation de conversation) est enregistrée.

Toute personne non admin qui ouvre l'adresse est redirigée, et la base refuse les données côté serveur.

## 4. Paramètres beaucoup plus complets

Sections repensées :

- **Compte** : pseudo (cooldown 7 jours), pseudo Roblox, e-mail, mot de passe, déconnexion.
- **Apparence** : thème clair/sombre, langue.
- **Notifications** : réglages séparés pour matchs, j'aime, messages, abonnés, commentaires, annonces — plus une pause globale.
- **Confidentialité** : visibilité du profil, qui peut m'écrire, affichage de l'âge, de la dernière activité, apparaître dans les Sparks.
- **Sécurité** : membres bloqués, appareils/sessions, déconnexion partout.
- **Mes données (RGPD / international)** : téléchargement immédiat de toutes mes données au format JSON, demande d'export officielle, demande de suppression du compte avec délai légal de 30 jours et annulation possible, rappel des droits (accès, rectification, effacement, portabilité, opposition).
- **À propos** : conditions, confidentialité, règles, version, mention de non-affiliation à Roblox Corporation.

## 5. Détails techniques

- Nouvelles colonnes `profiles` : `avatar_url`, `banner_url`, `verified`, `verified_at`, préférences notifications/confidentialité (JSON), `deletion_requested_at`.
- Nouvelles tables : `roblox_games` (max 5 par utilisateur, contrainte serveur), `user_roles` + type `app_role` + fonction `has_role` (sécurité définie, jamais de rôle stocké sur le profil), `admin_audit_log`, `data_requests`.
- Politiques d'accès : lecture admin sur profils, conversations, messages, signalements via `has_role`; écriture de la certification réservée aux admins (les membres ne peuvent pas se certifier eux-mêmes).
- Attribution du rôle admin à `arthur.buchon@outlook.fr` par correspondance sur l'e-mail vérifié du compte.
- Nouvelle route `/admin` sous la zone connectée, absente de la navigation.
- Export des données via une fonction serveur qui rassemble profil, photos, jeux, matchs, messages, vidéos et signalements.
