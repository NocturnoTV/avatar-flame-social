-- Three RDC 2026 (Roblox Developers Conference) news articles, researched
-- from Roblox's own newsroom post and the DevForum recap, sitting right
-- before the existing general RDC 2026 summary (position 10).
insert into news (title, subtitle, body, url, tone, position, published) values
(
  'Roblox Wallet and Roblox Card land at RDC 2026',
  'A real payment system built for creators',
  E'One of the biggest surprises at RDC 2026 was on the money side, not the game side: Roblox announced Roblox Wallet and a companion Roblox Card.\n\nUntil now, turning Robux earnings into real, spendable money meant going through the Developer Exchange program and waiting for a payout to a bank account. Roblox Wallet is built to close that gap - a place where creators can hold their earnings and move them more directly, with the Roblox Card acting as a way to actually spend that balance day-to-day, similar to how a debit card works.\n\nRoblox has not given a full rollout timeline or said which countries will get access first, but the direction is clear: as more creators treat Roblox as a full-time job, the platform wants payouts to feel less like a once-a-month bank transfer and more like a normal paycheck.\n\nFor the millions of small experience creators on the platform, this could matter more than any single new engine feature - it is about finally getting paid like a real business.',
  'https://about.roblox.com/newsroom/2026/09/rdc-2026-the-world-needs-more-play',
  'from-emerald-500 to-teal-400',
  7,
  true
),
(
  'Roblox''s AI Build tool is already behind 9,000 published games',
  'Public alpha expands to Singapore and Serbia',
  E'Roblox used RDC 2026 to share real numbers on its AI-powered Build tool, and they are bigger than most people expected: creators have already published around 9,000 games using it since launch.\n\nThe most striking detail is who is building with it - Roblox says 71% of those games came from first-time Roblox Studio users. In other words, the tool is not just making experienced developers faster, it is turning complete beginners into published creators, something the platform has struggled to do at scale for years.\n\nBuild is now expanding into public alpha in two new regions, Singapore and Serbia, growing the pool of people who can try prompt-to-game creation directly. Roblox also confirmed that a Scene Generator - which turns a text prompt or reference image into a working scene - will power prompt-to-scene creation in both Build and the classic Roblox Studio later this year, with more manual control available for people who want to fine-tune what the AI produces.\n\nFor a platform whose whole economy depends on a steady supply of new games, lowering the skill floor to "just describe what you want" is a bigger long-term bet than any single feature announced this year.',
  'https://devforum.roblox.com/t/rdc26-what-we-announced/4865880',
  'from-fuchsia-500 to-purple-500',
  8,
  true
),
(
  'Play anywhere: browser support, offline mode and standalone apps',
  'Roblox wants to stop asking you to install anything',
  E'A recurring theme across RDC 2026 was friction - specifically, removing every extra step between "I want to play this" and actually playing it.\n\nStarting at the end of 2026, Roblox games will be playable directly inside a web browser, no separate app install required. From mid-2027, an offline mode is planned so games can be played without an internet connection at all - useful for spotty wifi, flights, or just not wanting to wait on a download.\n\nOn top of that, creators will soon be able to publish their experiences as standalone apps across mobile, PC and consoles, letting a popular Roblox game live on a phone''s home screen or a console''s store front like any other title, instead of only existing inside the main Roblox app.\n\nAlongside these access changes, Roblox also announced a Friends chat tab that follows players across every game instead of resetting each time, voice typing support, and a notification system built for asynchronous multiplayer - so a friend can know you played without both needing to be online at once.\n\nTaken together, it is less one big feature and more a statement of intent: Roblox wants to be reachable from anywhere, with or without the Roblox app itself.',
  'https://www.pcgamesn.com/roblox/rdc-2026',
  'from-sky-500 to-blue-500',
  9,
  true
);
