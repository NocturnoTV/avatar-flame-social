import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, BookOpen, Camera, ChevronRight, Heart, Lightbulb, ShieldCheck, Sparkles } from "lucide-react";
import { useI18n, type LangCode } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/wiki")({
  head: () => ({ meta: [{ title: "Wiki - BloxSpark" }, { name: "description", content: "Learn how BloxSpark, Sparks, videos and verification work." }] }),
  component: WikiPage,
});

type Section = { title: string; intro: string; points: string[] };
type Copy = { eyebrow: string; title: string; lead: string; start: string; sections: Section[] };

const COPY: Record<LangCode, Copy> = {
  en: { eyebrow: "BloxSpark Academy", title: "Everything you need to make your spark count", lead: "A practical guide to meeting players, building a trusted profile and creating videos people want to watch.", start: "Start exploring", sections: [
    { title: "How Sparks works", intro: "Sparks helps you discover people based on shared games and profile choices.", points: ["Complete your age, languages and favorite games so suggestions stay relevant.", "Swipe right when you want to connect and left when the match is not right.", "A conversation opens after a mutual match. Respect boundaries and use block or report when needed."] },
    { title: "A strong first profile", intro: "Your profile should quickly show who you are and what you like to play.", points: ["Connect Roblox to import your public username, avatar and games.", "Use a clear photo or Roblox avatar, a short bio and accurate favorite games.", "Never publish passwords, private contact details or information that could identify your location."] },
    { title: "Videos people finish", intro: "Good videos earn attention in the first seconds and reward viewers for staying.", points: ["Start with the best moment. Remove long intros and silent waiting.", "Use a clear title, readable captions and up to five accurate hashtags.", "Prefer vertical, well-lit footage with clean audio. Reply to useful comments and keep posting consistently."] },
    { title: "How verification works", intro: "Verification confirms that a notable or trusted presence is authentic.", points: ["There is no follower requirement.", "Active creators who regularly publish original, high-quality content can apply.", "Celebrities, companies, brands and recognized public figures can also apply.", "A complete profile, consistent identity and a good safety record help the review. Verification is never sold."] },
  ] },
  fr: { eyebrow: "Académie BloxSpark", title: "Tout pour faire compter ton Spark", lead: "Un guide pratique pour rencontrer des joueurs, créer un profil fiable et publier des vidéos que les gens veulent regarder.", start: "Commencer à explorer", sections: [
    { title: "Comment fonctionne Sparks", intro: "Sparks te fait découvrir des personnes selon vos jeux communs et les choix de vos profils.", points: ["Complète ton âge, tes langues et tes jeux favoris pour recevoir de bonnes suggestions.", "Glisse à droite pour proposer une connexion et à gauche si le profil ne te correspond pas.", "Une conversation s'ouvre après un match mutuel. Respecte les limites et utilise le blocage ou le signalement si nécessaire."] },
    { title: "Bien débuter", intro: "Ton profil doit montrer rapidement qui tu es et à quoi tu joues.", points: ["Connecte Roblox pour importer ton pseudo public, ton avatar et tes jeux.", "Choisis une photo claire, une bio courte et des jeux favoris exacts.", "Ne publie jamais de mot de passe, de coordonnées privées ou d'information permettant de te localiser."] },
    { title: "Publier de bonnes vidéos", intro: "Une bonne vidéo attire dès les premières secondes et donne envie de rester.", points: ["Commence par le meilleur moment et coupe les longues introductions.", "Ajoute un titre clair, des sous-titres lisibles et cinq hashtags précis au maximum.", "Privilégie le format vertical, une image nette et un son propre. Réponds aux commentaires utiles et publie régulièrement."] },
    { title: "Devenir certifié", intro: "La certification confirme qu'un créateur ou une présence reconnue est authentique.", points: ["Il n'existe aucun critère minimum d'abonnés.", "Les créateurs actifs qui publient régulièrement du contenu original et de qualité peuvent faire une demande.", "Les célébrités, entreprises, marques et personnalités publiques reconnues peuvent aussi être certifiées.", "Un profil complet, une identité cohérente et un bon historique de sécurité facilitent l'examen. La certification ne s'achète pas."] },
  ] },
  es: { eyebrow: "Academia BloxSpark", title: "Haz que tu Spark cuente", lead: "Guía para conocer jugadores, crear un perfil fiable y publicar mejores vídeos.", start: "Empezar a explorar", sections: [
    { title: "Cómo funciona Sparks", intro: "Descubre personas según juegos e intereses compartidos.", points: ["Completa edad, idiomas y juegos favoritos.", "Desliza a la derecha para conectar y a la izquierda para pasar.", "El chat se abre con una coincidencia mutua. Respeta los límites y denuncia si es necesario."] },
    { title: "Empezar bien", intro: "Muestra rápidamente quién eres y a qué juegas.", points: ["Conecta Roblox para importar tu identidad pública.", "Usa una imagen clara, una biografía breve y juegos correctos.", "No publiques contraseñas, datos privados ni tu ubicación."] },
    { title: "Mejores vídeos", intro: "Capta la atención desde los primeros segundos.", points: ["Empieza con el mejor momento y elimina introducciones largas.", "Usa un título claro, subtítulos y hasta cinco hashtags precisos.", "Publica en vertical con imagen y sonido claros y responde a comentarios útiles."] },
    { title: "Verificación", intro: "Confirma que una presencia reconocida o de confianza es auténtica.", points: ["No hay requisito de seguidores.", "Los creadores activos con contenido original y de calidad pueden solicitarla.", "Celebridades, empresas y marcas también pueden solicitarla.", "El perfil completo, la identidad coherente y el buen historial ayudan. No se vende."] },
  ] },
  pt: { eyebrow: "Academia BloxSpark", title: "Faça seu Spark valer", lead: "Guia para conhecer jogadores, criar um perfil confiável e publicar vídeos melhores.", start: "Começar a explorar", sections: [
    { title: "Como o Sparks funciona", intro: "Descubra pessoas por jogos e interesses em comum.", points: ["Complete idade, idiomas e jogos favoritos.", "Deslize para a direita para conectar e para a esquerda para passar.", "A conversa abre após um match mútuo. Respeite limites e denuncie quando necessário."] },
    { title: "Comece bem", intro: "Mostre rapidamente quem você é e o que joga.", points: ["Conecte o Roblox para importar sua identidade pública.", "Use imagem clara, bio curta e jogos corretos.", "Nunca publique senhas, dados privados ou localização."] },
    { title: "Vídeos melhores", intro: "Prenda a atenção nos primeiros segundos.", points: ["Comece pelo melhor momento e corte introduções longas.", "Use título claro, legendas e até cinco hashtags precisas.", "Prefira vídeo vertical, imagem e som limpos e responda comentários úteis."] },
    { title: "Verificação", intro: "Confirma que uma presença reconhecida ou confiável é autêntica.", points: ["Não há requisito de seguidores.", "Criadores ativos com conteúdo original e de qualidade podem solicitar.", "Celebridades, empresas e marcas também podem solicitar.", "Perfil completo, identidade consistente e bom histórico ajudam. A verificação não é vendida."] },
  ] },
  de: { eyebrow: "BloxSpark Academy", title: "Mach deinen Spark bedeutend", lead: "Ein Leitfaden für Kontakte, ein vertrauenswürdiges Profil und bessere Videos.", start: "Jetzt entdecken", sections: [
    { title: "So funktioniert Sparks", intro: "Entdecke Menschen über gemeinsame Spiele und Interessen.", points: ["Vervollständige Alter, Sprachen und Lieblingsspiele.", "Wische rechts zum Verbinden und links zum Überspringen.", "Ein Chat öffnet sich bei einem gegenseitigen Match. Respektiere Grenzen und melde Probleme."] },
    { title: "Gut starten", intro: "Zeige schnell, wer du bist und was du spielst.", points: ["Verbinde Roblox für deine öffentliche Identität.", "Nutze ein klares Bild, eine kurze Bio und korrekte Spiele.", "Veröffentliche nie Passwörter, private Daten oder deinen Standort."] },
    { title: "Bessere Videos", intro: "Gewinne Aufmerksamkeit in den ersten Sekunden.", points: ["Beginne mit dem besten Moment und kürze lange Intros.", "Nutze klare Titel, Untertitel und höchstens fünf passende Hashtags.", "Filme vertikal mit sauberem Bild und Ton und antworte auf hilfreiche Kommentare."] },
    { title: "Verifizierung", intro: "Bestätigt die Echtheit einer bekannten oder vertrauenswürdigen Präsenz.", points: ["Es gibt keine Mindestzahl an Followern.", "Aktive Creator mit hochwertigen Originalinhalten können sich bewerben.", "Prominente, Unternehmen und Marken können sich ebenfalls bewerben.", "Ein vollständiges Profil und guter Sicherheitsverlauf helfen. Verifizierung wird nicht verkauft."] },
  ] },
  ko: { eyebrow: "BloxSpark 아카데미", title: "Spark를 더 가치 있게 만드는 방법", lead: "플레이어를 만나고 신뢰할 수 있는 프로필과 좋은 영상을 만드는 실용 가이드입니다.", start: "둘러보기", sections: [
    { title: "Sparks 이용 방법", intro: "공통 게임과 관심사를 바탕으로 사람을 추천합니다.", points: ["나이, 언어, 좋아하는 게임을 정확히 입력하세요.", "연결하려면 오른쪽, 넘기려면 왼쪽으로 스와이프하세요.", "서로 선택하면 대화가 열립니다. 경계를 존중하고 필요하면 차단하거나 신고하세요."] },
    { title: "좋은 시작", intro: "내가 누구이고 무엇을 플레이하는지 빠르게 보여 주세요.", points: ["Roblox를 연결해 공개 신원을 가져오세요.", "선명한 이미지, 짧은 소개와 정확한 게임을 사용하세요.", "비밀번호, 개인정보나 위치는 게시하지 마세요."] },
    { title: "좋은 영상 만들기", intro: "첫 몇 초 안에 관심을 사로잡으세요.", points: ["가장 좋은 장면부터 시작하고 긴 인트로를 줄이세요.", "명확한 제목, 자막과 최대 5개의 정확한 해시태그를 쓰세요.", "세로 영상, 선명한 화면과 소리를 사용하고 유용한 댓글에 답하세요."] },
    { title: "인증 받기", intro: "유명하거나 신뢰받는 계정의 진위를 확인합니다.", points: ["팔로워 수 조건은 없습니다.", "독창적이고 품질 높은 콘텐츠를 꾸준히 올리는 활동적인 크리에이터가 신청할 수 있습니다.", "유명인, 기업과 브랜드도 신청할 수 있습니다.", "완성된 프로필과 좋은 안전 기록이 도움이 됩니다. 인증은 판매하지 않습니다."] },
  ] },
};

const icons = [Sparkles, BookOpen, Camera, BadgeCheck];

function WikiPage() {
  const { lang } = useI18n();
  const copy = COPY[lang];
  return <main className="mx-auto max-w-4xl px-4 pb-28 pt-6 text-foreground">
    <section className="relative overflow-hidden rounded-[2.5rem] border border-primary/25 bg-gradient-to-br from-primary/20 via-card to-card p-7 sm:p-10">
      <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
      <p className="text-xs font-black uppercase tracking-[0.25em] text-primary">{copy.eyebrow}</p>
      <h1 className="mt-3 max-w-2xl text-4xl font-black leading-tight sm:text-5xl">{copy.title}</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">{copy.lead}</p>
      <Link to="/discover" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-lg shadow-primary/25">{copy.start}<ChevronRight className="h-4 w-4" /></Link>
    </section>
    <div className="mt-6 grid gap-4 sm:grid-cols-2">{copy.sections.map((section, index) => { const Icon = icons[index] ?? Lightbulb; return <article key={section.title} className="rounded-[2rem] border border-border bg-card p-6 shadow-sm"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-6 w-6" /></span><h2 className="mt-4 text-xl font-black">{section.title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.intro}</p><ul className="mt-4 space-y-3">{section.points.map((point) => <li key={point} className="flex gap-3 text-sm leading-relaxed"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{point}</span></li>)}</ul></article>; })}</div>
    <section className="mt-6 rounded-[2rem] border border-primary/20 bg-primary/10 p-6 text-center"><Heart className="mx-auto h-7 w-7 text-primary" /><p className="mt-3 font-black">BloxSpark is better when everyone creates, connects and plays safely.</p></section>
  </main>;
}
