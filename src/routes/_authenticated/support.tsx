import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bell,
  BookOpen,
  ChevronDown,
  CreditCard,
  Database,
  Headphones,
  Key,
  MessageCircle,
  Paperclip,
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
import { Button, Input, Select, Textarea } from "@/components/ui-kit";
import { useI18n, type LangCode } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { errorMessage, cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: "Support - Bloxspark" },
      { name: "description", content: "Help, FAQ, tickets and Bloxspark service status." },
    ],
  }),
  component: SupportPage,
});

const SERVICE_IDS = ["website", "api", "roblox_auth", "payments", "sparks", "storage"] as const;
const SERVICE_ICONS: Record<(typeof SERVICE_IDS)[number], typeof Server> = {
  website: Server,
  api: Database,
  roblox_auth: Key,
  payments: CreditCard,
  sparks: Sparkles,
  storage: Paperclip,
};

const FAQ_FALLBACK: Record<LangCode, { category: string; question: string; answer: string }[]> = {
  en: [
    {
      category: "Account",
      question: "How do I link my Roblox account?",
      answer: 'Go to Settings → Roblox account, then tap "Connect my Roblox account" and authorize Bloxspark.',
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
      answer: "Bloxspark Premium (Spark Plus) unlocks profile customization and chat bubble themes, among other perks.",
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
        "Va dans Réglages → Compte Roblox, puis clique sur \"Connecter mon compte Roblox\" et autorise Bloxspark.",
    },
    {
      category: "Compte",
      question: "Comment modifier mon profil ?",
      answer: "Depuis l'onglet Profil, clique sur ta photo ou ta bannière pour tout modifier directement.",
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
        "Depuis son profil ou une conversation, ouvre le menu \"...\" puis \"Signaler\". Notre équipe Trust & Safety traite chaque signalement.",
    },
    {
      category: "Sécurité",
      question: "Comment bloquer quelqu'un ?",
      answer: "Depuis le menu \"...\" d'une conversation ou d'un profil, sélectionne \"Bloquer\".",
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
      answer: "Bloxspark Premium (Spark Plus) desbloquea la personalización de perfil y temas de burbujas de chat, entre otras ventajas.",
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
      answer: "O Bloxspark Premium (Spark Plus) libera a personalização de perfil e temas de bolhas de chat, entre outras vantagens.",
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
      answer: "Bloxspark Premium (Spark Plus) schaltet unter anderem Profilanpassung und Chat-Bubble-Designs frei.",
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
      answer: '설정 → Roblox 계정으로 이동한 다음 "내 Roblox 계정 연결"을 눌러 Bloxspark를 승인하세요.',
    },
    {
      category: "계정",
      question: "프로필은 어떻게 수정하나요?",
      answer: "프로필 탭에서 사진이나 배너를 눌러 바로 수정할 수 있습니다.",
    },
    {
      category: "Roblox",
      question: "Roblox 로그인이 안 되는 이유는 무엇인가요?",
      answer: "팝업 차단이 되어 있지 않은지 확인한 후 다시 시도해 주세요. 계속되면 티켓을 생성해 주세요.",
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
      answer: "Bloxspark 프리미엄(Spark Plus)은 프로필 커스터마이징과 채팅 버블 테마 등을 제공합니다.",
    },
    {
      category: "보안",
      question: "사용자를 어떻게 신고하나요?",
      answer: '프로필이나 대화방에서 "..." 메뉴를 열고 "신고"를 선택하세요. 저희 신뢰 및 안전팀이 모든 신고를 검토합니다.',
    },
    {
      category: "보안",
      question: "누군가를 어떻게 차단하나요?",
      answer: '대화방이나 프로필의 "..." 메뉴에서 "차단"을 선택하세요.',
    },
  ],
};

function SupportPage() {
  const { t, lang } = useI18n();
  const { user } = useSession();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [view, setView] = useState<"home" | "newTicket" | "myTickets">("home");
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const CATEGORIES = [
    { id: "account", label: t("supportCatAccount") },
    { id: "roblox", label: t("supportCatRoblox") },
    { id: "payment", label: t("supportCatPayment") },
    { id: "sparks", label: t("supportCatSparks") },
    { id: "report", label: t("supportCatReport") },
    { id: "bug", label: t("supportCatBug") },
    { id: "copyright", label: t("supportCatCopyright") },
    { id: "other", label: t("supportCatOther") },
  ] as const;

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
  const [ticketCategory, setTicketCategory] = useState<string>("bug");
  const [severity, setSeverity] = useState("low");
  const [sending, setSending] = useState(false);
  const [ticketFilter, setTicketFilter] = useState<"all" | "pending" | "in_progress" | "resolved" | "wont_fix">(
    "all",
  );

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

  const tickets = useQuery({
    queryKey: ["support-my-tickets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("bug_reports")
        .select("id,title,description,category,severity,status,created_at")
        .eq("reporter_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

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
      severity,
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

  const filteredFaq = useMemo(() => {
    const localFaq = FAQ_FALLBACK[lang] ?? FAQ_FALLBACK.en;
    const source =
      (faq.data?.length ?? 0) > 0
        ? faq.data!.map((f) => ({ id: f.id, category: "", question: f.question, answer: f.answer }))
        : localFaq.map((f, i) => ({ id: `fallback-${i}`, ...f }));
    let filtered = source;
    if (category) {
      const keywordsByCategory: Record<string, string[]> = {
        account: ["compte", "account", "cuenta", "conta", "konto", "계정", "profil", "profile", "perfil"],
        roblox: ["roblox"],
        payment: ["premium", "paiement", "payment", "pago", "pagamento", "zahlung", "결제"],
        sparks: ["sparks", "spark", "like", "match"],
        report: ["signaler", "report", "reportar", "denunciar", "melde", "신고", "bloquer", "block", "차단"],
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
            to="/notifications"
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
                {c.label}
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
              onClick={() => document.getElementById("faq-section")?.scrollIntoView({ behavior: "smooth" })}
            />
            <FeatureCard
              icon={Server}
              title={t("supportStatusCardTitle")}
              description={t("supportStatusCardDesc")}
              badge={allOperational ? "🟢" : undefined}
              onClick={() => document.getElementById("status-section")?.scrollIntoView({ behavior: "smooth" })}
            />
            <FeatureCard
              icon={Users}
              title={t("supportCommunityCardTitle")}
              description={t("supportCommunityCardDesc")}
              onClick={() => toast(t("supportDiscordSoon"))}
            />
          </div>

          <section id="status-section" className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <span className={cn("h-2.5 w-2.5 rounded-full", allOperational ? "bg-[#22C55E]" : "bg-[#F59E0B]")} />
                {t("supportServicesTitle")}
              </h2>
            </div>
            <p className={cn("mt-1 text-sm font-semibold", allOperational ? "text-[#22C55E]" : "text-[#F59E0B]")}>
              {allOperational ? t("supportAllOperational") : overall?.message || t("supportDegradedOngoing")}
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
                    <div key={incident.id} className="rounded-2xl border border-border bg-card p-3 text-sm">
                      <p className="text-xs text-muted-foreground">
                        {new Date(incident.started_at).toLocaleDateString(lang, {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                      <p className="mt-0.5 font-semibold">
                        {incident.status === "resolved" ? `🟢 ${t("supportStatusResolved")}` : `🟠 ${t("supportStatusInProgress")}`} -{" "}
                        {incident.title}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section id="faq-section" className="mt-8">
            <h2 className="text-lg font-bold">{t("supportPopularArticles")}</h2>
            <div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
              {filteredFaq.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">{t("supportNoResults")}</p>
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
                      <p className="bx-pop px-4 pb-4 text-sm leading-relaxed text-muted-foreground">{f.answer}</p>
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
              <span className="text-xs font-semibold text-muted-foreground">contact@bloxspark.com</span>
            </a>
            <button
              onClick={() => setView("myTickets")}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center"
            >
              <BookOpen className="h-5 w-5 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground">{t("supportMyTicketsCard")}</span>
            </button>
            <button
              onClick={() => toast(t("supportDiscordSoon"))}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center"
            >
              <Users className="h-5 w-5 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground">{t("supportDiscordCard")}</span>
            </button>
          </section>
        </>
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
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("priority")}
            </label>
            <Select value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="low">{t("priorityLow")}</option>
              <option value="medium">{t("priorityMedium")}</option>
              <option value="high">{t("priorityHigh")}</option>
              <option value="critical">{t("priorityCritical")}</option>
            </Select>
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
              <p className="py-10 text-center text-sm text-muted-foreground">{t("supportNoTickets")}</p>
            ) : (
              filteredTickets.map((ticket) => (
                <div key={ticket.id} className="rounded-2xl border border-border bg-card p-4">
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
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{ticket.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(ticket.created_at).toLocaleString(lang)}
                  </p>
                </div>
              ))
            )}
          </div>

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
