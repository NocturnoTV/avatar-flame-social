import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Database,
  ExternalLink,
  Gamepad2,
  Headphones,
  Key,
  LoaderCircle,
  MessageCircle,
  Paperclip,
  Radio,
  Search,
  Send,
  Server,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LogoWordmark } from "@/components/Logo";
import { StoredImage } from "@/components/Media";
import { Button, Input, Select, Sheet, Textarea } from "@/components/ui-kit";
import { getRobloxStatus } from "@/lib/roblox-status.functions";
import { useI18n, type LangCode } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { errorMessage, cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/support")({
  validateSearch: (search: Record<string, unknown>): { ticket?: string; view?: "status" } => ({
    ...(typeof search["ticket"] === "string" ? { ticket: search["ticket"] } : {}),
    ...(search["view"] === "status" ? { view: "status" as const } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Support - Bloxspark" },
      { name: "description", content: "Help, FAQ, tickets and Bloxspark service status." },
    ],
  }),
  component: SupportPage,
});

// Bespoke local copy for the Roblox live-status widget merged into the
// "status" view (kept local rather than in the global i18n dict, same
// established pattern as shop.billing.tsx's COPY object).
const ROBLOX_COPY = {
  en: {
    official: "Official Roblox status",
    updated: "Last checked",
    incidents: "Active Roblox incidents",
    noIncidents: "No active incident reported by Roblox.",
    reports: "Community reports",
    last24: "Reports during the last 24 hours",
    report: "Report a problem",
    choose: "Affected service",
    details: "What is happening? (optional)",
    send: "Send report",
    sent: "Thanks. Your report helps the community.",
    rate: "You can send one report every five minutes.",
    checking: "Checking Roblox…",
  },
  fr: {
    official: "Statut officiel Roblox",
    updated: "Dernière vérification",
    incidents: "Incidents Roblox en cours",
    noIncidents: "Aucun incident actif signalé par Roblox.",
    reports: "Signalements de la communauté",
    last24: "Signalements durant les dernières 24 heures",
    report: "Signaler un problème",
    choose: "Service concerné",
    details: "Que se passe-t-il ? (facultatif)",
    send: "Envoyer le signalement",
    sent: "Merci. Ton signalement aide la communauté.",
    rate: "Tu peux envoyer un signalement toutes les cinq minutes.",
    checking: "Vérification de Roblox…",
  },
  es: {
    official: "Estado oficial de Roblox",
    updated: "Última comprobación",
    incidents: "Incidentes activos de Roblox",
    noIncidents: "Roblox no informa de incidentes activos.",
    reports: "Informes de la comunidad",
    last24: "Informes de las últimas 24 horas",
    report: "Informar de un problema",
    choose: "Servicio afectado",
    details: "¿Qué ocurre? (opcional)",
    send: "Enviar informe",
    sent: "Gracias. Tu informe ayuda a la comunidad.",
    rate: "Puedes enviar un informe cada cinco minutos.",
    checking: "Comprobando Roblox…",
  },
  pt: {
    official: "Estado oficial do Roblox",
    updated: "Última verificação",
    incidents: "Incidentes ativos do Roblox",
    noIncidents: "Nenhum incidente ativo relatado pelo Roblox.",
    reports: "Relatos da comunidade",
    last24: "Relatos nas últimas 24 horas",
    report: "Relatar um problema",
    choose: "Serviço afetado",
    details: "O que está acontecendo? (opcional)",
    send: "Enviar relato",
    sent: "Obrigado. Seu relato ajuda a comunidade.",
    rate: "Você pode enviar um relato a cada cinco minutos.",
    checking: "Verificando o Roblox…",
  },
  de: {
    official: "Offizieller Roblox-Status",
    updated: "Zuletzt geprüft",
    incidents: "Aktive Roblox-Störungen",
    noIncidents: "Roblox meldet keine aktive Störung.",
    reports: "Community-Meldungen",
    last24: "Meldungen der letzten 24 Stunden",
    report: "Problem melden",
    choose: "Betroffener Dienst",
    details: "Was passiert gerade? (optional)",
    send: "Meldung senden",
    sent: "Danke. Deine Meldung hilft der Community.",
    rate: "Du kannst alle fünf Minuten eine Meldung senden.",
    checking: "Roblox wird geprüft…",
  },
  ko: {
    official: "Roblox 공식 상태",
    updated: "마지막 확인",
    incidents: "진행 중인 Roblox 장애",
    noIncidents: "Roblox에서 보고한 진행 중인 장애가 없습니다.",
    reports: "커뮤니티 제보",
    last24: "최근 24시간 제보",
    report: "문제 신고",
    choose: "문제가 있는 서비스",
    details: "어떤 문제가 있나요? (선택)",
    send: "제보 보내기",
    sent: "감사합니다. 제보가 커뮤니티에 도움이 됩니다.",
    rate: "5분마다 한 번 제보할 수 있습니다.",
    checking: "Roblox 상태 확인 중…",
  },
} as const;

const REPORT_SERVICES = [
  "website",
  "login",
  "game_join",
  "studio",
  "avatar",
  "marketplace",
  "other",
] as const;

const SERVICE_IDS = ["website", "api", "roblox_auth", "payments", "sparks", "storage"] as const;
const SERVICE_ICONS: Record<(typeof SERVICE_IDS)[number], typeof Server> = {
  website: Server,
  api: Database,
  roblox_auth: Key,
  payments: CreditCard,
  sparks: Sparkles,
  storage: Paperclip,
};

const TICKET_CATEGORIES: Record<LangCode, [string, string, string, string][]> = {
  en: [
    [
      "general",
      "❓",
      "Questions & General Support",
      "Questions or issues that do not fit another category.",
    ],
    [
      "trust_safety",
      "🛡️",
      "Trust & Safety / Moderation",
      "Report users, harmful content, harassment or inappropriate behavior.",
    ],
    [
      "technical",
      "🐛",
      "Technical Issues & Bugs",
      "Report bugs, errors, crashes or features that are not working.",
    ],
    [
      "billing",
      "💳",
      "Purchases & Billing",
      "Get help with payments, purchases, refunds or billing issues.",
    ],
    ["copyright", "©️", "Copyright & DMCA", "Submit copyright infringement or DMCA requests."],
    ["account", "🔐", "Account & Login", "Get help with login, account access or account issues."],
    ["feedback", "💡", "Feedback & Suggestions", "Share ideas and feedback to improve BloxSpark."],
    [
      "partnerships",
      "🤝",
      "Partnerships & Business",
      "Contact us about partnerships, collaborations or business.",
    ],
    ["legal", "⚖️", "Legal Requests", "Submit legal requests or other legal matters."],
  ],
  fr: [
    [
      "general",
      "❓",
      "Questions et aide générale",
      "Questions ou problèmes qui ne correspondent à aucune autre catégorie.",
    ],
    [
      "trust_safety",
      "🛡️",
      "Sécurité et modération",
      "Signaler un utilisateur, du contenu dangereux, du harcèlement ou un comportement inapproprié.",
    ],
    [
      "technical",
      "🐛",
      "Problèmes techniques et bugs",
      "Signaler un bug, une erreur, un plantage ou une fonction qui ne marche pas.",
    ],
    [
      "billing",
      "💳",
      "Achats et facturation",
      "Obtenir de l'aide pour un paiement, un achat, un remboursement ou une facture.",
    ],
    [
      "copyright",
      "©️",
      "Droits d’auteur et DMCA",
      "Envoyer une demande liée aux droits d’auteur ou au DMCA.",
    ],
    [
      "account",
      "🔐",
      "Compte et connexion",
      "Obtenir de l'aide pour se connecter ou accéder à son compte.",
    ],
    ["feedback", "💡", "Avis et suggestions", "Partager des idées pour améliorer BloxSpark."],
    [
      "partnerships",
      "🤝",
      "Partenariats et entreprises",
      "Nous contacter pour un partenariat, une collaboration ou une demande commerciale.",
    ],
    ["legal", "⚖️", "Demandes juridiques", "Envoyer une demande juridique ou liée au droit."],
  ],
  es: [
    [
      "general",
      "❓",
      "Preguntas y ayuda general",
      "Preguntas o problemas que no encajan en otra categoría.",
    ],
    [
      "trust_safety",
      "🛡️",
      "Seguridad y moderación",
      "Denuncia usuarios, contenido dañino, acoso o conducta inapropiada.",
    ],
    [
      "technical",
      "🐛",
      "Problemas técnicos y errores",
      "Informa de errores, bloqueos o funciones que no funcionan.",
    ],
    [
      "billing",
      "💳",
      "Compras y facturación",
      "Ayuda con pagos, compras, reembolsos o facturación.",
    ],
    ["copyright", "©️", "Copyright y DMCA", "Envía solicitudes de copyright o DMCA."],
    [
      "account",
      "🔐",
      "Cuenta e inicio de sesión",
      "Ayuda para iniciar sesión o acceder a tu cuenta.",
    ],
    ["feedback", "💡", "Opiniones y sugerencias", "Comparte ideas para mejorar BloxSpark."],
    [
      "partnerships",
      "🤝",
      "Alianzas y negocios",
      "Contacta sobre alianzas, colaboraciones o negocios.",
    ],
    ["legal", "⚖️", "Solicitudes legales", "Envía solicitudes u otros asuntos legales."],
  ],
  pt: [
    [
      "general",
      "❓",
      "Perguntas e suporte geral",
      "Perguntas ou problemas que não cabem em outra categoria.",
    ],
    [
      "trust_safety",
      "🛡️",
      "Segurança e moderação",
      "Denuncie usuários, conteúdo nocivo, assédio ou comportamento impróprio.",
    ],
    [
      "technical",
      "🐛",
      "Problemas técnicos e bugs",
      "Relate bugs, erros, falhas ou recursos que não funcionam.",
    ],
    [
      "billing",
      "💳",
      "Compras e faturamento",
      "Ajuda com pagamentos, compras, reembolsos ou cobrança.",
    ],
    [
      "copyright",
      "©️",
      "Direitos autorais e DMCA",
      "Envie solicitações de direitos autorais ou DMCA.",
    ],
    ["account", "🔐", "Conta e login", "Ajuda com login e acesso à conta."],
    ["feedback", "💡", "Feedback e sugestões", "Compartilhe ideias para melhorar o BloxSpark."],
    [
      "partnerships",
      "🤝",
      "Parcerias e negócios",
      "Fale sobre parcerias, colaborações ou negócios.",
    ],
    ["legal", "⚖️", "Solicitações legais", "Envie solicitações ou outros assuntos legais."],
  ],
  de: [
    [
      "general",
      "❓",
      "Fragen und allgemeine Hilfe",
      "Fragen oder Probleme, die in keine andere Kategorie passen.",
    ],
    [
      "trust_safety",
      "🛡️",
      "Sicherheit und Moderation",
      "Melde Nutzer, schädliche Inhalte, Belästigung oder unangemessenes Verhalten.",
    ],
    [
      "technical",
      "🐛",
      "Technische Probleme und Fehler",
      "Melde Fehler, Abstürze oder nicht funktionierende Funktionen.",
    ],
    [
      "billing",
      "💳",
      "Käufe und Abrechnung",
      "Hilfe bei Zahlungen, Käufen, Erstattungen oder Abrechnung.",
    ],
    ["copyright", "©️", "Urheberrecht und DMCA", "Reiche Urheberrechts- oder DMCA-Anfragen ein."],
    ["account", "🔐", "Konto und Anmeldung", "Hilfe bei Anmeldung und Kontozugriff."],
    ["feedback", "💡", "Feedback und Vorschläge", "Teile Ideen zur Verbesserung von BloxSpark."],
    [
      "partnerships",
      "🤝",
      "Partnerschaften und Geschäft",
      "Kontakt für Partnerschaften, Kooperationen oder Geschäftliches.",
    ],
    ["legal", "⚖️", "Rechtliche Anfragen", "Reiche rechtliche Anfragen ein."],
  ],
  ko: [
    ["general", "❓", "질문 및 일반 지원", "다른 카테고리에 해당하지 않는 질문이나 문제입니다."],
    [
      "trust_safety",
      "🛡️",
      "신뢰 및 안전 / 운영",
      "사용자, 유해 콘텐츠, 괴롭힘 또는 부적절한 행동을 신고하세요.",
    ],
    [
      "technical",
      "🐛",
      "기술 문제 및 버그",
      "버그, 오류, 충돌 또는 작동하지 않는 기능을 신고하세요.",
    ],
    ["billing", "💳", "구매 및 결제", "결제, 구매, 환불 또는 청구 관련 도움을 받으세요."],
    ["copyright", "©️", "저작권 및 DMCA", "저작권 침해 또는 DMCA 요청을 제출하세요."],
    ["account", "🔐", "계정 및 로그인", "로그인이나 계정 접근 도움을 받으세요."],
    ["feedback", "💡", "의견 및 제안", "BloxSpark 개선 아이디어를 공유하세요."],
    ["partnerships", "🤝", "파트너십 및 비즈니스", "파트너십, 협업 또는 비즈니스 문의입니다."],
    ["legal", "⚖️", "법적 요청", "법적 요청이나 관련 사안을 제출하세요."],
  ],
};

const FAQ_FALLBACK: Record<LangCode, { category: string; question: string; answer: string }[]> = {
  en: [
    {
      category: "Account",
      question: "How do I link my Roblox account?",
      answer:
        'Go to Settings → Roblox account, then tap "Connect my Roblox account" and authorize Bloxspark.',
    },
    {
      category: "Account",
      question: "How do I edit my profile?",
      answer: "From the Profile tab, tap your photo or banner to edit everything directly.",
    },
    {
      category: "Roblox",
      question: "Why doesn't the Roblox login work?",
      answer:
        "Make sure pop-ups aren't blocked so the Roblox window can open, then try again. If it still fails, create a ticket.",
    },
    {
      category: "Sparks",
      question: "How does Sparks work?",
      answer:
        "Sparks suggests players who share your favorite games, age range and country. Swipe right to Like, left to Pass.",
    },
    {
      category: "Sparks",
      question: "Can I undo a Like?",
      answer: "Not yet - think it through before you swipe!",
    },
    {
      category: "Payments",
      question: "How does Bloxspark Premium work?",
      answer:
        "Bloxspark Premium (Spark Plus) unlocks profile customization and chat bubble themes, among other perks.",
    },
    {
      category: "Security",
      question: "How do I report a user?",
      answer:
        'From their profile or a conversation, open the "..." menu, then "Report". Our Trust & Safety team reviews every report.',
    },
    {
      category: "Security",
      question: "How do I block someone?",
      answer: 'From the "..." menu on a conversation or profile, select "Block".',
    },
  ],
  fr: [
    {
      category: "Compte",
      question: "Comment lier mon compte Roblox ?",
      answer:
        'Va dans Réglages → Compte Roblox, puis clique sur "Connecter mon compte Roblox" et autorise Bloxspark.',
    },
    {
      category: "Compte",
      question: "Comment modifier mon profil ?",
      answer:
        "Depuis l'onglet Profil, clique sur ta photo ou ta bannière pour tout modifier directement.",
    },
    {
      category: "Roblox",
      question: "Pourquoi la connexion Roblox ne fonctionne pas ?",
      answer:
        "Vérifie que tu autorises bien la fenêtre Roblox à s'ouvrir (pas de bloqueur de pop-up), puis réessaie. Si le problème persiste, crée un ticket.",
    },
    {
      category: "Sparks",
      question: "Comment fonctionne Sparks ?",
      answer:
        "Sparks te propose des joueurs qui partagent tes jeux favoris, ta tranche d'âge et ton pays. Swipe à droite pour Like, à gauche pour Passer.",
    },
    {
      category: "Sparks",
      question: "Comment annuler un Like ?",
      answer: "Ce n'est pas possible pour l'instant - réfléchis bien avant de swiper !",
    },
    {
      category: "Paiements",
      question: "Comment fonctionne Bloxspark Premium ?",
      answer:
        "Bloxspark Premium (Spark Plus) débloque la personnalisation de profil et des bulles de discussion, entre autres avantages.",
    },
    {
      category: "Sécurité",
      question: "Comment signaler un utilisateur ?",
      answer:
        'Depuis son profil ou une conversation, ouvre le menu "..." puis "Signaler". Notre équipe Trust & Safety traite chaque signalement.',
    },
    {
      category: "Sécurité",
      question: "Comment bloquer quelqu'un ?",
      answer: 'Depuis le menu "..." d\'une conversation ou d\'un profil, sélectionne "Bloquer".',
    },
  ],
  es: [
    {
      category: "Cuenta",
      question: "¿Cómo vinculo mi cuenta de Roblox?",
      answer:
        'Ve a Ajustes → Cuenta de Roblox, luego toca "Conectar mi cuenta de Roblox" y autoriza Bloxspark.',
    },
    {
      category: "Cuenta",
      question: "¿Cómo edito mi perfil?",
      answer: "Desde la pestaña Perfil, toca tu foto o tu banner para editar todo directamente.",
    },
    {
      category: "Roblox",
      question: "¿Por qué no funciona el inicio de sesión con Roblox?",
      answer:
        "Asegúrate de que los pop-ups no estén bloqueados para que la ventana de Roblox pueda abrirse, luego vuelve a intentarlo. Si persiste, crea un ticket.",
    },
    {
      category: "Sparks",
      question: "¿Cómo funciona Sparks?",
      answer:
        "Sparks te sugiere jugadores que comparten tus juegos favoritos, tu rango de edad y tu país. Desliza a la derecha para Like, a la izquierda para Pasar.",
    },
    {
      category: "Sparks",
      question: "¿Puedo deshacer un Like?",
      answer: "Todavía no - ¡piénsalo bien antes de deslizar!",
    },
    {
      category: "Pagos",
      question: "¿Cómo funciona Bloxspark Premium?",
      answer:
        "Bloxspark Premium (Spark Plus) desbloquea la personalización de perfil y temas de burbujas de chat, entre otras ventajas.",
    },
    {
      category: "Seguridad",
      question: "¿Cómo reporto a un usuario?",
      answer:
        'Desde su perfil o una conversación, abre el menú "..." y luego "Reportar". Nuestro equipo de Confianza y Seguridad revisa cada reporte.',
    },
    {
      category: "Seguridad",
      question: "¿Cómo bloqueo a alguien?",
      answer: 'Desde el menú "..." de una conversación o perfil, selecciona "Bloquear".',
    },
  ],
  pt: [
    {
      category: "Conta",
      question: "Como vincular minha conta Roblox?",
      answer:
        'Vá em Configurações → Conta Roblox e toque em "Conectar minha conta Roblox" para autorizar o Bloxspark.',
    },
    {
      category: "Conta",
      question: "Como edito meu perfil?",
      answer: "Na aba Perfil, toque na sua foto ou banner para editar tudo diretamente.",
    },
    {
      category: "Roblox",
      question: "Por que o login com Roblox não funciona?",
      answer:
        "Verifique se os pop-ups não estão bloqueados para que a janela do Roblox possa abrir e tente novamente. Se persistir, crie um ticket.",
    },
    {
      category: "Sparks",
      question: "Como funciona o Sparks?",
      answer:
        "O Sparks sugere jogadores que compartilham seus jogos favoritos, faixa etária e país. Deslize para a direita para curtir, para a esquerda para passar.",
    },
    {
      category: "Sparks",
      question: "Posso desfazer uma curtida?",
      answer: "Ainda não - pense bem antes de deslizar!",
    },
    {
      category: "Pagamentos",
      question: "Como funciona o Bloxspark Premium?",
      answer:
        "O Bloxspark Premium (Spark Plus) libera a personalização de perfil e temas de bolhas de chat, entre outras vantagens.",
    },
    {
      category: "Segurança",
      question: "Como denuncio um usuário?",
      answer:
        'No perfil dele ou em uma conversa, abra o menu "..." e depois "Denunciar". Nossa equipe de Confiança e Segurança analisa cada denúncia.',
    },
    {
      category: "Segurança",
      question: "Como bloqueio alguém?",
      answer: 'No menu "..." de uma conversa ou perfil, selecione "Bloquear".',
    },
  ],
  de: [
    {
      category: "Konto",
      question: "Wie verknüpfe ich mein Roblox-Konto?",
      answer:
        'Gehe zu Einstellungen → Roblox-Konto, tippe auf "Mein Roblox-Konto verbinden" und autorisiere Bloxspark.',
    },
    {
      category: "Konto",
      question: "Wie bearbeite ich mein Profil?",
      answer: "Tippe im Tab Profil auf dein Foto oder Banner, um alles direkt zu bearbeiten.",
    },
    {
      category: "Roblox",
      question: "Warum funktioniert der Roblox-Login nicht?",
      answer:
        "Stelle sicher, dass Pop-ups nicht blockiert werden, damit sich das Roblox-Fenster öffnen kann, und versuche es erneut. Bei weiteren Problemen erstelle ein Ticket.",
    },
    {
      category: "Sparks",
      question: "Wie funktioniert Sparks?",
      answer:
        "Sparks schlägt Spieler vor, die deine Lieblingsspiele, Altersgruppe und dein Land teilen. Wische nach rechts für Like, nach links für Weiter.",
    },
    {
      category: "Sparks",
      question: "Kann ich einen Like rückgängig machen?",
      answer: "Noch nicht - überlege gut, bevor du wischst!",
    },
    {
      category: "Zahlungen",
      question: "Wie funktioniert Bloxspark Premium?",
      answer:
        "Bloxspark Premium (Spark Plus) schaltet unter anderem Profilanpassung und Chat-Bubble-Designs frei.",
    },
    {
      category: "Sicherheit",
      question: "Wie melde ich einen Nutzer?",
      answer:
        'Öffne im Profil oder einer Unterhaltung das "..."-Menü und dann "Melden". Unser Trust & Safety-Team prüft jede Meldung.',
    },
    {
      category: "Sicherheit",
      question: "Wie blockiere ich jemanden?",
      answer: 'Wähle im "..."-Menü einer Unterhaltung oder eines Profils "Blockieren".',
    },
  ],
  ko: [
    {
      category: "계정",
      question: "Roblox 계정을 어떻게 연결하나요?",
      answer:
        '설정 → Roblox 계정으로 이동한 다음 "내 Roblox 계정 연결"을 눌러 Bloxspark를 승인하세요.',
    },
    {
      category: "계정",
      question: "프로필은 어떻게 수정하나요?",
      answer: "프로필 탭에서 사진이나 배너를 눌러 바로 수정할 수 있습니다.",
    },
    {
      category: "Roblox",
      question: "Roblox 로그인이 안 되는 이유는 무엇인가요?",
      answer:
        "팝업 차단이 되어 있지 않은지 확인한 후 다시 시도해 주세요. 계속되면 티켓을 생성해 주세요.",
    },
    {
      category: "Sparks",
      question: "Sparks는 어떻게 작동하나요?",
      answer:
        "Sparks는 좋아하는 게임, 나이대, 국가가 비슷한 플레이어를 추천합니다. 오른쪽으로 스와이프하면 좋아요, 왼쪽이면 패스입니다.",
    },
    {
      category: "Sparks",
      question: "좋아요를 취소할 수 있나요?",
      answer: "아직은 불가능합니다 - 스와이프하기 전에 신중히 생각하세요!",
    },
    {
      category: "결제",
      question: "Bloxspark 프리미엄은 어떻게 작동하나요?",
      answer:
        "Bloxspark 프리미엄(Spark Plus)은 프로필 커스터마이징과 채팅 버블 테마 등을 제공합니다.",
    },
    {
      category: "보안",
      question: "사용자를 어떻게 신고하나요?",
      answer:
        '프로필이나 대화방에서 "..." 메뉴를 열고 "신고"를 선택하세요. 저희 신뢰 및 안전팀이 모든 신고를 검토합니다.',
    },
    {
      category: "보안",
      question: "누군가를 어떻게 차단하나요?",
      answer: '대화방이나 프로필의 "..." 메뉴에서 "차단"을 선택하세요.',
    },
  ],
};

function SupportPage() {
  const { ticket: linkedTicketId, view: initialView } = Route.useSearch();
  const { t, lang } = useI18n();
  const { user } = useSession();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [view, setView] = useState<"home" | "status" | "newTicket" | "myTickets">("home");
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const robloxCopy = ROBLOX_COPY[lang as keyof typeof ROBLOX_COPY] ?? ROBLOX_COPY.en;
  const [reportService, setReportService] = useState<(typeof REPORT_SERVICES)[number]>("game_join");
  const [reportDetails, setReportDetails] = useState("");
  const [sendingReport, setSendingReport] = useState(false);

  const CATEGORIES = TICKET_CATEGORIES[lang].map(([id, emoji, label, description]) => ({
    id,
    emoji,
    label,
    description,
  }));

  const SERVICES = SERVICE_IDS.map((id) => ({
    id,
    icon: SERVICE_ICONS[id],
    label: t(
      {
        website: "supportSvcWebsite",
        api: "supportSvcApi",
        roblox_auth: "supportSvcRobloxAuth",
        payments: "supportSvcPayments",
        sparks: "supportSvcSparks",
        storage: "supportSvcStorage",
      }[id] as Parameters<typeof t>[0],
    ),
  }));

  const STATUS_LABEL: Record<string, string> = {
    operational: t("statusOperational"),
    degraded: t("statusDegraded"),
    outage: t("statusOutage"),
    maintenance: t("statusMaintenance"),
  };
  const STATUS_DOT: Record<string, string> = {
    operational: "bg-[#22C55E]",
    degraded: "bg-[#F59E0B]",
    outage: "bg-[#EF4444]",
    maintenance: "bg-primary",
  };
  const STATUS_TEXT: Record<string, string> = {
    operational: "text-[#22C55E]",
    degraded: "text-[#F59E0B]",
    outage: "text-[#EF4444]",
    maintenance: "text-primary",
  };

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ticketCategory, setTicketCategory] = useState<string>("general");
  const [sending, setSending] = useState(false);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [ticketReply, setTicketReply] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    if (!linkedTicketId) return;
    setView("myTickets");
    setOpenTicketId(linkedTicketId);
  }, [linkedTicketId]);

  useEffect(() => {
    if (initialView === "status") setView("status");
  }, [initialView]);
  const [ticketFilter, setTicketFilter] = useState<
    "all" | "pending" | "in_progress" | "resolved" | "wont_fix"
  >("all");

  const myProfile = useQuery({
    queryKey: ["support-my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username,avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const unread = useQuery({
    queryKey: ["support-unread-notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("read", false);
      return count ?? 0;
    },
  });

  const faq = useQuery({
    queryKey: ["support-faq"],
    queryFn: async () => {
      const { data } = await supabase
        .from("faq_entries")
        .select("id,question,answer,position")
        .order("position");
      return data ?? [];
    },
  });

  const statuses = useQuery({
    queryKey: ["support-status"],
    queryFn: async () => {
      const { data } = await supabase.from("service_status").select("id,status,message,updated_at");
      return data ?? [];
    },
  });

  const incidents = useQuery({
    queryKey: ["support-incidents"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_incidents")
        .select("id,title,status,started_at,resolved_at")
        .order("started_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const roblox = useQuery({
    queryKey: ["roblox-live-status"],
    queryFn: () => getRobloxStatus(),
    refetchInterval: 60000,
  });

  const reportSeries = useQuery({
    queryKey: ["status-report-series"],
    queryFn: async () => {
      const { data } = await supabase.rpc("status_report_series");
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const tickets = useQuery({
    queryKey: ["support-my-tickets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("bug_reports")
        .select("id,title,description,category,severity,status,created_at,last_activity_at")
        .eq("reporter_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const ticketMessages = useQuery({
    queryKey: ["support-ticket-messages", openTicketId],
    enabled: !!openTicketId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_ticket_messages")
        .select("id,author_id,body,is_staff,created_at")
        .eq("ticket_id", openTicketId!)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function replyToTicket() {
    if (!user || !openTicketId || !ticketReply.trim() || sendingReply) return;
    setSendingReply(true);
    const { error } = await supabase.from("support_ticket_messages").insert({
      ticket_id: openTicketId,
      author_id: user.id,
      body: ticketReply.trim(),
      is_staff: false,
    });
    setSendingReply(false);
    if (error) {
      toast.error(errorMessage(error, t("errorGeneric")));
      return;
    }
    setTicketReply("");
    await Promise.all([ticketMessages.refetch(), tickets.refetch()]);
  }

  async function submitTicket() {
    if (!user || !title.trim() || description.trim().length < 10) {
      toast.error(t("supportTicketValidation"));
      return;
    }
    setSending(true);
    const { error } = await supabase.from("bug_reports").insert({
      reporter_id: user.id,
      title: title.trim(),
      description: description.trim(),
      category: ticketCategory,
      page_url: window.location.href,
    });
    setSending(false);
    if (error) {
      toast.error(errorMessage(error, t("errorGeneric")));
      return;
    }
    setTitle("");
    setDescription("");
    toast.success(t("supportTicketSent"));
    void tickets.refetch();
    setView("myTickets");
  }

  const overall = statuses.data?.find((s) => s.id === "default");
  const perService = SERVICES.map((s) => ({
    ...s,
    status: statuses.data?.find((row) => row.id === s.id)?.status ?? "operational",
  }));
  const allOperational = perService.every((s) => s.status === "operational");

  const totalReports = (reportSeries.data ?? []).reduce(
    (sum, point) => sum + Number(point.report_count),
    0,
  );
  const maxReports = Math.max(
    1,
    ...(reportSeries.data ?? []).map((point) => Number(point.report_count)),
  );
  const robloxHealthy = roblox.data?.indicator === "none";

  async function submitReport() {
    if (!user || sendingReport) return;
    setSendingReport(true);
    const { error } = await supabase
      .from("status_reports")
      .insert({ user_id: user.id, service: reportService, details: reportDetails.trim() || null });
    setSendingReport(false);
    if (error) {
      toast.error(errorMessage(error, robloxCopy.rate));
      return;
    }
    setReportDetails("");
    toast.success(robloxCopy.sent);
    void reportSeries.refetch();
  }

  const filteredFaq = useMemo(() => {
    const localFaq = FAQ_FALLBACK[lang] ?? FAQ_FALLBACK.en;
    const source =
      (faq.data?.length ?? 0) > 0
        ? faq.data!.map((f) => ({ id: f.id, category: "", question: f.question, answer: f.answer }))
        : localFaq.map((f, i) => ({ id: `fallback-${i}`, ...f }));
    let filtered = source;
    if (category) {
      const keywordsByCategory: Record<string, string[]> = {
        account: [
          "compte",
          "account",
          "cuenta",
          "conta",
          "konto",
          "계정",
          "profil",
          "profile",
          "perfil",
        ],
        roblox: ["roblox"],
        payment: ["premium", "paiement", "payment", "pago", "pagamento", "zahlung", "결제"],
        sparks: ["sparks", "spark", "like", "match"],
        report: [
          "signaler",
          "report",
          "reportar",
          "denunciar",
          "melde",
          "신고",
          "bloquer",
          "block",
          "차단",
        ],
        bug: ["bug", "error", "fehler", "버그"],
        copyright: ["droit", "copyright", "dmca", "auteur", "urheberrecht", "저작권"],
        other: [],
      };
      const words = keywordsByCategory[category] ?? [];
      if (words.length) {
        filtered = filtered.filter((f) =>
          words.some(
            (w) =>
              f.question.toLowerCase().includes(w) ||
              f.answer.toLowerCase().includes(w) ||
              f.category.toLowerCase().includes(w),
          ),
        );
      }
    }
    if (!search.trim()) return filtered;
    const q = search.trim().toLowerCase();
    return filtered.filter(
      (f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q),
    );
  }, [faq.data, search, category, lang]);

  const filteredTickets = (tickets.data ?? []).filter(
    (ticket) => ticketFilter === "all" || ticket.status === ticketFilter,
  );

  const ticketStatusLabel = (status: string) =>
    status === "pending"
      ? t("supportStatusPending")
      : status === "in_progress"
        ? t("supportStatusInProgress")
        : status === "resolved"
          ? t("supportStatusResolved")
          : t("supportStatusWontFix");

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4">
      <header className="flex items-center justify-between">
        <LogoWordmark className="h-6 w-auto" />
        <div className="flex items-center gap-2">
          <Link
            to="/messages"
            aria-label={t("notifications")}
            className="relative grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-surface-2"
          >
            <Bell className="h-5 w-5" />
            {unread.data ? (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {unread.data > 9 ? "9+" : unread.data}
              </span>
            ) : null}
          </Link>
          <Link to="/profile" aria-label={t("profile")}>
            <StoredImage
              path={myProfile.data?.avatar_url}
              alt=""
              className="h-9 w-9 rounded-full object-cover ring-1 ring-primary/60"
              fallback={myProfile.data?.username?.[0]?.toUpperCase() ?? "?"}
            />
          </Link>
        </div>
      </header>

      <div className="mt-2 border-t border-border pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="spark-gradient grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-[0_0_16px_rgba(168,85,247,.5)]">
              <Headphones className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black">{t("support")}</h1>
              <p className="text-sm text-muted-foreground">{t("supportHeroLine")}</p>
            </div>
          </div>
          <p className="hidden shrink-0 -rotate-2 text-xs font-semibold text-[#C084FC] sm:block">
            {t("supportTagline")}
          </p>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t("supportIntro")}</p>
      </div>

      {view !== "home" ? (
        <button onClick={() => setView("home")} className="mt-4 text-sm font-semibold text-primary">
          {t("supportBackHome")}
        </button>
      ) : null}

      {view === "home" ? (
        <>
          <label className="mt-4 flex h-12 items-center gap-2 rounded-2xl border border-border bg-surface px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("supportSearchPlaceholder")}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>

          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory((cur) => (cur === c.id ? null : c.id))}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
                  category === c.id
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground",
                )}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <FeatureCard
              icon={MessageCircle}
              title={t("supportTicketCardTitle")}
              description={t("supportTicketCardDesc")}
              onClick={() => {
                if (category) setTicketCategory(category);
                setView("newTicket");
              }}
            />
            <FeatureCard
              icon={BookOpen}
              title={t("supportFaqCardTitle")}
              description={t("supportFaqCardDesc")}
              onClick={() =>
                document.getElementById("faq-section")?.scrollIntoView({ behavior: "smooth" })
              }
            />
            <FeatureCard
              icon={Server}
              title={t("supportStatusCardTitle")}
              description={t("supportStatusCardDesc")}
              badge={allOperational ? "🟢" : undefined}
              onClick={() => setView("status")}
            />
            <FeatureCard
              icon={Users}
              title={t("supportCommunityCardTitle")}
              description={t("supportCommunityCardDesc")}
              onClick={() => toast(t("supportDiscordSoon"))}
            />
          </div>

          <section id="faq-section" className="mt-8">
            <h2 className="text-lg font-bold">{t("supportPopularArticles")}</h2>
            <div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
              {filteredFaq.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  {t("supportNoResults")}
                </p>
              ) : (
                filteredFaq.map((f) => (
                  <div key={f.id}>
                    <button
                      onClick={() => setOpenFaq((cur) => (cur === f.id ? null : f.id))}
                      className="flex w-full items-center gap-3 p-4 text-left"
                    >
                      <span className="min-w-0 flex-1 text-sm font-semibold">{f.question}</span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          openFaq === f.id && "rotate-180",
                        )}
                      />
                    </button>
                    {openFaq === f.id ? (
                      <p className="bx-pop px-4 pb-4 text-sm leading-relaxed text-muted-foreground">
                        {f.answer}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="mt-8 grid gap-3 sm:grid-cols-3">
            <a
              href="mailto:contact@bloxspark.com"
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center"
            >
              <Send className="h-5 w-5 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground">
                contact@bloxspark.com
              </span>
            </a>
            <button
              onClick={() => setView("myTickets")}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center"
            >
              <BookOpen className="h-5 w-5 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground">
                {t("supportMyTicketsCard")}
              </span>
            </button>
            <button
              onClick={() => toast(t("supportDiscordSoon"))}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center"
            >
              <Users className="h-5 w-5 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground">
                {t("supportDiscordCard")}
              </span>
            </button>
          </section>
        </>
      ) : null}

      {view === "status" ? (
        <section className="mt-4">
          <div className="rounded-3xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-primary">
                  {robloxCopy.official}
                </p>
                <h2 className="mt-1 truncate text-lg font-black">
                  {roblox.data?.description ?? robloxCopy.checking}
                </h2>
              </div>
              {roblox.isLoading ? (
                <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-primary" />
              ) : robloxHealthy ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[#22C55E]" />
              ) : (
                <AlertTriangle className="h-5 w-5 shrink-0 text-[#F59E0B]" />
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {robloxCopy.updated}:{" "}
              {roblox.data ? new Date(roblox.data.updatedAt).toLocaleString(lang) : "…"}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(roblox.data?.components ?? []).slice(0, 12).map((component) => (
                <div
                  key={component.id}
                  className="flex items-center justify-between rounded-2xl bg-surface px-3 py-2.5"
                >
                  <span className="truncate text-sm font-semibold">{component.name}</span>
                  <span
                    className={cn(
                      "ml-2 h-2.5 w-2.5 shrink-0 rounded-full",
                      component.status === "operational" ? "bg-[#22C55E]" : "bg-[#F59E0B]",
                    )}
                  />
                </div>
              ))}
            </div>
            <a
              href="https://status.roblox.com/"
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary"
            >
              status.roblox.com <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="mt-3">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Gamepad2 className="h-4 w-4 text-primary" /> {robloxCopy.incidents}
            </h3>
            {(roblox.data?.incidents ?? []).length ? (
              <div className="mt-2 space-y-2">
                {roblox.data!.incidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="rounded-2xl border border-[#F59E0B]/20 bg-[#F59E0B]/5 p-3 text-sm"
                  >
                    <p className="font-bold">{incident.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {incident.status} · {incident.impact}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 rounded-2xl bg-[#22C55E]/5 p-3 text-sm text-[#22C55E]">
                {robloxCopy.noIncidents}
              </p>
            )}
          </div>

          <div className="mt-4 rounded-3xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-bold">
              <Radio className="h-4 w-4 text-primary" /> {robloxCopy.reports}
            </p>
            <p className="mt-1 text-3xl font-black">{totalReports}</p>
            <p className="text-xs text-muted-foreground">{robloxCopy.last24}</p>
            <div className="mt-4 flex h-20 items-end gap-1">
              {(reportSeries.data ?? []).map((point) => (
                <div
                  key={point.bucket}
                  title={`${point.report_count}`}
                  className="min-w-1 flex-1 rounded-t-md bg-gradient-to-t from-violet-700 to-fuchsia-400"
                  style={{
                    height: `${Math.max(6, (Number(point.report_count) / maxReports) * 100)}%`,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-3xl border border-border bg-card p-4">
            <h3 className="text-sm font-bold">{robloxCopy.report}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{robloxCopy.rate}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-muted-foreground">
                {robloxCopy.choose}
                <Select
                  value={reportService}
                  onChange={(event) => setReportService(event.target.value as typeof reportService)}
                  className="mt-2"
                >
                  {REPORT_SERVICES.map((item) => (
                    <option key={item} value={item}>
                      {item.replace("_", " ")}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="text-xs font-bold text-muted-foreground">
                {robloxCopy.details}
                <Textarea
                  value={reportDetails}
                  maxLength={500}
                  onChange={(event) => setReportDetails(event.target.value)}
                  rows={3}
                  className="mt-2"
                />
              </label>
            </div>
            <Button
              className="mt-3 w-full sm:w-auto"
              disabled={sendingReport}
              onClick={() => void submitReport()}
            >
              {sendingReport ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {robloxCopy.send}
            </Button>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  allOperational ? "bg-[#22C55E]" : "bg-[#F59E0B]",
                )}
              />
              {t("supportServicesTitle")}
            </h2>
          </div>
          <p
            className={cn(
              "mt-1 text-sm font-semibold",
              allOperational ? "text-[#22C55E]" : "text-[#F59E0B]",
            )}
          >
            {allOperational
              ? t("supportAllOperational")
              : overall?.message || t("supportDegradedOngoing")}
          </p>
          <div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
            {perService.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3.5">
                <s.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-sm font-semibold">{s.label}</span>
                <span
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
                    s.status === "operational" && "bg-[#22C55E]/10",
                    s.status === "degraded" && "bg-[#F59E0B]/10",
                    s.status === "outage" && "bg-[#EF4444]/10",
                    STATUS_TEXT[s.status],
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[s.status])} />
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
              </div>
            ))}
          </div>

          {(incidents.data ?? []).length > 0 ? (
            <div className="mt-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {t("supportHistory")}
              </p>
              <div className="space-y-2">
                {incidents.data!.map((incident) => (
                  <div
                    key={incident.id}
                    className="rounded-2xl border border-border bg-card p-3 text-sm"
                  >
                    <p className="text-xs text-muted-foreground">
                      {new Date(incident.started_at).toLocaleDateString(lang, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    <p className="mt-0.5 font-semibold">
                      {incident.status === "resolved"
                        ? `🟢 ${t("supportStatusResolved")}`
                        : `🟠 ${t("supportStatusInProgress")}`}{" "}
                      - {incident.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {view === "newTicket" ? (
        <section className="mt-4 space-y-4 rounded-3xl border border-border bg-card p-5">
          <h2 className="text-lg font-black">{t("supportNewTicket")}</h2>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("supportSubject")}
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("supportTicketSubjectPlaceholder")}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("supportCategory")}
            </label>
            <Select value={ticketCategory} onChange={(e) => setTicketCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </Select>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {CATEGORIES.find((item) => item.id === ticketCategory)?.description}
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("supportDetails")}
            </label>
            <Textarea
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("supportDescriptionPlaceholder")}
            />
          </div>
          <Button
            className="w-full"
            disabled={sending || !title.trim() || description.trim().length < 10}
            onClick={() => void submitTicket()}
          >
            <Send className="h-4 w-4" /> {sending ? t("sending") : t("sendSupportRequest")}
          </Button>
        </section>
      ) : null}

      {view === "myTickets" ? (
        <section className="mt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black">{t("myRequests")}</h2>
            <button
              onClick={() => setView("newTicket")}
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
            >
              + {t("supportNewTicket")}
            </button>
          </div>

          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {(
              [
                ["all", t("filterAll")],
                ["pending", t("supportStatusPending")],
                ["in_progress", t("supportStatusInProgress")],
                ["resolved", t("supportStatusResolved")],
                ["wont_fix", t("supportStatusWontFix")],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTicketFilter(id)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
                  ticketFilter === id
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            {filteredTickets.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {t("supportNoTickets")}
              </p>
            ) : (
              filteredTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setOpenTicketId(ticket.id)}
                  className="w-full rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                        ticket.status === "pending" && "bg-primary/10 text-primary",
                        ticket.status === "in_progress" && "bg-[#F59E0B]/10 text-[#F59E0B]",
                        ticket.status === "resolved" && "bg-[#22C55E]/10 text-[#22C55E]",
                        ticket.status === "wont_fix" && "bg-surface-2 text-muted-foreground",
                      )}
                    >
                      {ticketStatusLabel(ticket.status)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {CATEGORIES.find((c) => c.id === ticket.category)?.label ?? ticket.category}
                    </span>
                  </div>
                  <p className="mt-2 font-bold">{ticket.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {ticket.description}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(ticket.created_at).toLocaleString(lang)}
                  </p>
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-primary">
                    <MessageCircle className="h-3.5 w-3.5" /> Open conversation
                  </p>
                </button>
              ))
            )}
          </div>

          <Sheet
            open={!!openTicketId}
            onClose={() => setOpenTicketId(null)}
            title={
              tickets.data?.find((ticket) => ticket.id === openTicketId)?.title ?? t("support")
            }
          >
            {(() => {
              const ticket = tickets.data?.find((item) => item.id === openTicketId);
              if (!ticket) return null;
              const closed = ["resolved", "wont_fix"].includes(ticket.status);
              return (
                <div className="flex min-h-[60dvh] flex-col gap-4">
                  <div className="rounded-2xl border border-border bg-surface p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase text-primary">
                        {ticketStatusLabel(ticket.status)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        #{ticket.id.slice(0, 8)}
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
                      {ticket.description}
                    </p>
                  </div>
                  <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl bg-surface p-3">
                    {(ticketMessages.data ?? []).length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">
                        Your conversation with BloxSpark Support will appear here.
                      </p>
                    ) : (
                      (ticketMessages.data ?? []).map((message) => (
                        <div
                          key={message.id}
                          className={cn("flex", message.is_staff ? "justify-start" : "justify-end")}
                        >
                          <div
                            className={cn(
                              "max-w-[86%] rounded-2xl px-3.5 py-2.5",
                              message.is_staff
                                ? "rounded-bl-md border border-primary/20 bg-card"
                                : "rounded-br-md bg-primary text-primary-foreground",
                            )}
                          >
                            <p className="text-[11px] font-black">
                              {message.is_staff ? "BloxSpark Support" : t("you")}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm">{message.body}</p>
                            <p
                              className={cn(
                                "mt-1 text-[10px]",
                                message.is_staff
                                  ? "text-muted-foreground"
                                  : "text-primary-foreground/70",
                              )}
                            >
                              {new Date(message.created_at).toLocaleString(lang)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {closed ? (
                    <p className="rounded-2xl bg-surface p-3 text-center text-sm text-muted-foreground">
                      This ticket is closed.
                    </p>
                  ) : (
                    <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2">
                      <Textarea
                        rows={2}
                        value={ticketReply}
                        onChange={(event) => setTicketReply(event.target.value)}
                        placeholder={t("supportResponseHint")}
                        className="min-h-12 border-0 bg-transparent"
                      />
                      <Button
                        size="icon"
                        disabled={!ticketReply.trim() || sendingReply}
                        onClick={() => void replyToTicket()}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })()}
          </Sheet>

          <div className="mt-6 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card p-5">
            <Headphones className="h-8 w-8 text-primary" />
            <p className="mt-3 font-black">{t("supportUrgentTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("supportUrgentText")}</p>
            <Button className="mt-4 w-full" onClick={() => setView("newTicket")}>
              {t("supportCreateNewTicket")}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  badge,
  onClick,
}: {
  icon: typeof Shield;
  title: string;
  description: string;
  badge?: string | undefined;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/40"
    >
      <span className="flex w-full items-center justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        {badge ? <span>{badge}</span> : null}
      </span>
      <span className="font-bold">{title}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  );
}
