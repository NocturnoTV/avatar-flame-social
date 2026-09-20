-- The dedicated News page (/news) reads from news_articles, a separate,
-- richer table from the simple "news" table Home's news strip uses - and
-- news_articles was completely empty, so /news showed nothing at all.
-- Seed it with the same RDC 2026 coverage already on Home, in English and
-- French (the two languages the page's own language filter supports).
insert into news_articles (title, slug, excerpt, content, category, source, source_url, status, featured, published_at, reading_time_minutes, key_points, tags, language) values
(
  'RDC 2026: Everything Roblox Announced',
  'rdc-2026-everything-announced',
  'Standalone apps, browser play, offline mode, AI-powered Build tools and new financial tools for creators - the full recap.',
  E'At the 2026 Roblox Developers Conference, Roblox announced several major changes designed to make the platform easier to access, play, and create on.\n\nThe new Roblox Everywhere initiative will allow developers to release their experiences as standalone apps on mobile devices, PCs, and consoles. By the end of 2026, players will also be able to launch Roblox experiences directly through a browser without installing the Roblox app. Offline solo play is planned for mid-2027.\n\nFor creators, Roblox introduced new AI-powered tools, including Scene Generator, which can transform text prompts and reference images into functional game environments. New engine features will also make it easier to develop 2D, puzzle, and turn-based games.\n\nOther announcements included improved Friends chat, voice typing, the expansion of the Moments video-discovery platform, and new financial tools called Roblox Wallet and Roblox Card.\n\nThese updates show Roblox''s ambition to become a broader gaming and creation platform that can reach players anywhere.',
  'events', 'Roblox Newsroom', 'https://about.roblox.com/newsroom/2026/09/rdc-2026-the-world-needs-more-play',
  'published', true, now(), 3,
  array['Standalone apps on mobile, PC and consoles','Browser play by end of 2026, offline mode mid-2027','AI Scene Generator for Build and Studio','Roblox Wallet and Roblox Card announced'],
  array['RDC26','Roblox','announcements'], 'en'
),
(
  'RDC 2026 : tout ce que Roblox a annoncé',
  'rdc-2026-tout-ce-qui-a-ete-annonce',
  'Applications autonomes, jeu dans le navigateur, mode hors-ligne, outils IA et nouveaux outils financiers pour les créateurs : le récap complet.',
  E'Lors de la conférence des développeurs Roblox 2026, Roblox a annoncé plusieurs changements majeurs pour rendre la plateforme plus facile d''accès, à jouer et à créer.\n\nLa nouvelle initiative Roblox Everywhere permettra aux développeurs de publier leurs expériences sous forme d''applications autonomes sur mobile, PC et consoles. D''ici fin 2026, les joueurs pourront aussi lancer des expériences Roblox directement depuis un navigateur, sans installer l''application. Un mode solo hors-ligne est prévu pour mi-2027.\n\nPour les créateurs, Roblox a présenté de nouveaux outils basés sur l''IA, dont Scene Generator, capable de transformer un texte ou une image de référence en environnement de jeu fonctionnel. De nouvelles fonctionnalités du moteur faciliteront aussi le développement de jeux 2D, de puzzles et au tour par tour.\n\nAutres annonces : un chat entre amis amélioré, la saisie vocale, l''extension de la plateforme de découverte vidéo Moments, ainsi que de nouveaux outils financiers baptisés Roblox Wallet et Roblox Card.\n\nCes annonces montrent l''ambition de Roblox de devenir une plateforme de jeu et de création plus large, accessible à tous, partout.',
  'events', 'Roblox Newsroom', 'https://about.roblox.com/newsroom/2026/09/rdc-2026-the-world-needs-more-play',
  'published', true, now(), 3,
  array['Applications autonomes sur mobile, PC et consoles','Jeu dans le navigateur fin 2026, hors-ligne mi-2027','Scene Generator IA pour Build et Studio','Roblox Wallet et Roblox Card annoncés'],
  array['RDC26','Roblox','annonces'], 'fr'
),
(
  'Roblox Wallet and Roblox Card Land at RDC 2026',
  'roblox-wallet-and-card-rdc-2026',
  'A real payment system built for creators - moving Robux earnings closer to a normal paycheck.',
  E'One of the biggest surprises at RDC 2026 was on the money side, not the game side: Roblox announced Roblox Wallet and a companion Roblox Card.\n\nUntil now, turning Robux earnings into real, spendable money meant going through the Developer Exchange program and waiting for a payout to a bank account. Roblox Wallet is built to close that gap - a place where creators can hold their earnings and move them more directly, with the Roblox Card acting as a way to actually spend that balance day-to-day, similar to how a debit card works.\n\nRoblox has not given a full rollout timeline or said which countries will get access first, but the direction is clear: as more creators treat Roblox as a full-time job, the platform wants payouts to feel less like a once-a-month bank transfer and more like a normal paycheck.',
  'updates', 'Roblox Newsroom', 'https://about.roblox.com/newsroom/2026/09/rdc-2026-the-world-needs-more-play',
  'published', false, now(), 2,
  array['Roblox Wallet holds creator earnings','Roblox Card spends that balance like a debit card','No rollout timeline yet'],
  array['RDC26','Roblox Wallet','creators'], 'en'
),
(
  'Roblox Wallet et Roblox Card dévoilés à la RDC 2026',
  'roblox-wallet-et-card-rdc-2026',
  'Un vrai système de paiement pensé pour les créateurs - se rapprocher d''un vrai salaire.',
  E'L''une des plus grandes surprises de la RDC 2026 concernait l''argent, pas le jeu : Roblox a annoncé Roblox Wallet et une carte associée, la Roblox Card.\n\nJusqu''ici, transformer des gains en Robux en argent réel dépensable passait par le programme Developer Exchange et une attente pour un virement bancaire. Roblox Wallet est conçu pour combler cet écart : un endroit où les créateurs peuvent conserver leurs gains et les faire circuler plus directement, la Roblox Card permettant de dépenser ce solde au quotidien, un peu comme une carte de débit.\n\nRoblox n''a pas encore donné de calendrier de déploiement complet ni précisé quels pays seront les premiers servis, mais la direction est claire : à mesure que de plus en plus de créateurs vivent de Roblox à plein temps, la plateforme veut que les paiements ressemblent moins à un virement mensuel qu''à un vrai salaire.',
  'updates', 'Roblox Newsroom', 'https://about.roblox.com/newsroom/2026/09/rdc-2026-the-world-needs-more-play',
  'published', false, now(), 2,
  array['Roblox Wallet conserve les gains des créateurs','Roblox Card dépense ce solde comme une carte de débit','Pas encore de calendrier de déploiement'],
  array['RDC26','Roblox Wallet','créateurs'], 'fr'
),
(
  'Roblox''s AI Build Tool Is Already Behind 9,000 Published Games',
  'ai-build-tool-9000-games-rdc-2026',
  'Public alpha expands to Singapore and Serbia - and 71% of games came from first-time Studio users.',
  E'Roblox used RDC 2026 to share real numbers on its AI-powered Build tool, and they are bigger than most people expected: creators have already published around 9,000 games using it since launch.\n\nThe most striking detail is who is building with it - Roblox says 71% of those games came from first-time Roblox Studio users. In other words, the tool is not just making experienced developers faster, it is turning complete beginners into published creators.\n\nBuild is now expanding into public alpha in two new regions, Singapore and Serbia. Roblox also confirmed that a Scene Generator - which turns a text prompt or reference image into a working scene - will power prompt-to-scene creation in both Build and the classic Roblox Studio later this year, with more manual control available for people who want to fine-tune what the AI produces.',
  'development', 'Roblox DevForum', 'https://devforum.roblox.com/t/rdc26-what-we-announced/4865880',
  'published', false, now(), 3,
  array['~9,000 games published with AI Build','71% from first-time Studio users','Expanding to Singapore and Serbia','Scene Generator coming to Build and Studio'],
  array['RDC26','AI','Roblox Studio'], 'en'
),
(
  'L''outil IA Build de Roblox a déjà permis 9 000 jeux publiés',
  'outil-ia-build-9000-jeux-rdc-2026',
  'Alpha publique étendue à Singapour et en Serbie - et 71% des jeux viennent de nouveaux venus sur Studio.',
  E'Roblox a profité de la RDC 2026 pour partager de vrais chiffres sur son outil de création assisté par IA, Build, et ils sont plus impressionnants que prévu : environ 9 000 jeux ont déjà été publiés grâce à lui depuis son lancement.\n\nLe détail le plus frappant concerne qui l''utilise : Roblox indique que 71% de ces jeux viennent de personnes qui n''avaient jamais utilisé Roblox Studio auparavant. Autrement dit, l''outil ne rend pas seulement les développeurs expérimentés plus rapides, il transforme de vrais débutants en créateurs publiés.\n\nBuild s''étend maintenant en alpha publique dans deux nouvelles régions, Singapour et la Serbie. Roblox a aussi confirmé qu''un Scene Generator - capable de transformer un texte ou une image de référence en scène fonctionnelle - alimentera la création "prompt vers scène" dans Build et dans Roblox Studio classique plus tard cette année, avec plus de contrôle manuel pour affiner le résultat.',
  'development', 'Roblox DevForum', 'https://devforum.roblox.com/t/rdc26-what-we-announced/4865880',
  'published', false, now(), 3,
  array['~9 000 jeux publiés avec Build IA','71% viennent de nouveaux utilisateurs de Studio','Extension à Singapour et en Serbie','Scene Generator bientôt dans Build et Studio'],
  array['RDC26','IA','Roblox Studio'], 'fr'
),
(
  'Play Anywhere: Browser Support, Offline Mode and Standalone Apps',
  'play-anywhere-browser-offline-apps-rdc-2026',
  'Roblox wants to stop asking you to install anything.',
  E'A recurring theme across RDC 2026 was friction - specifically, removing every extra step between "I want to play this" and actually playing it.\n\nStarting at the end of 2026, Roblox games will be playable directly inside a web browser, no separate app install required. From mid-2027, an offline mode is planned so games can be played without an internet connection at all.\n\nOn top of that, creators will soon be able to publish their experiences as standalone apps across mobile, PC and consoles, letting a popular Roblox game live on a phone''s home screen or a console''s storefront like any other title.\n\nAlongside these access changes, Roblox also announced a Friends chat tab that follows players across every game, voice typing support, and a notification system built for asynchronous multiplayer.',
  'updates', 'PCGamesN', 'https://www.pcgamesn.com/roblox/rdc-2026',
  'published', false, now(), 3,
  array['Browser play by end of 2026','Offline mode planned for mid-2027','Standalone apps on mobile, PC and consoles','Persistent Friends chat and voice typing'],
  array['RDC26','Roblox','access'], 'en'
),
(
  'Jouer partout : navigateur, mode hors-ligne et applications autonomes',
  'jouer-partout-navigateur-hors-ligne-rdc-2026',
  'Roblox veut arrêter de vous demander d''installer quoi que ce soit.',
  E'Un thème récurrent de la RDC 2026 était la friction - plus précisément, supprimer chaque étape entre "je veux jouer à ça" et le fait de vraiment y jouer.\n\nDès fin 2026, les jeux Roblox seront jouables directement dans un navigateur web, sans installation d''application séparée. À partir de mi-2027, un mode hors-ligne est prévu pour jouer sans connexion internet du tout.\n\nEn plus de cela, les créateurs pourront bientôt publier leurs expériences sous forme d''applications autonomes sur mobile, PC et consoles, permettant à un jeu Roblox populaire de vivre sur l''écran d''accueil d''un téléphone ou la vitrine d''une console comme n''importe quel autre titre.\n\nEn parallèle de ces changements d''accès, Roblox a aussi annoncé un onglet de chat entre amis qui suit les joueurs dans tous les jeux, la saisie vocale, et un système de notifications pensé pour le multijoueur asynchrone.',
  'updates', 'PCGamesN', 'https://www.pcgamesn.com/roblox/rdc-2026',
  'published', false, now(), 3,
  array['Jeu dans le navigateur dès fin 2026','Mode hors-ligne prévu pour mi-2027','Applications autonomes sur mobile, PC et consoles','Chat entre amis persistant et saisie vocale'],
  array['RDC26','Roblox','accès'], 'fr'
);
