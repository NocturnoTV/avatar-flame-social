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
import { useSession } from "@/lib/session";
import { errorMessage, cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: "Support — Bloxspark" },
      { name: "description", content: "Aide, FAQ, tickets et statut des services Bloxspark." },
    ],
  }),
  component: SupportPage,
});

const CATEGORIES = [
  { id: "account", label: "Compte" },
  { id: "roblox", label: "Roblox" },
  { id: "payment", label: "Achat" },
  { id: "sparks", label: "Sparks" },
  { id: "report", label: "Signaler un problème" },
  { id: "bug", label: "Bug" },
  { id: "copyright", label: "Droits d'auteur / DMCA" },
  { id: "other", label: "Autre" },
] as const;

const SERVICES: { id: string; label: string; icon: typeof Server }[] = [
  { id: "website", label: "Site web", icon: Server },
  { id: "api", label: "API", icon: Database },
  { id: "roblox_auth", label: "Authentification Roblox", icon: Key },
  { id: "payments", label: "Paiements (Stripe)", icon: CreditCard },
  { id: "sparks", label: "Sparks", icon: Sparkles },
  { id: "storage", label: "Stockage de fichiers", icon: Paperclip },
];

const STATUS_LABEL: Record<string, string> = {
  operational: "Opérationnel",
  degraded: "Perturbations",
  outage: "Incident",
  maintenance: "Maintenance",
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

const FAQ_FALLBACK: { category: string; question: string; answer: string }[] = [
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
    answer: "Ce n'est pas possible pour l'instant — réfléchis bien avant de swiper !",
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
];

function SupportPage() {
  const { user } = useSession();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [view, setView] = useState<"home" | "newTicket" | "myTickets">("home");
  const [openFaq, setOpenFaq] = useState<string | null>(null);

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
      toast.error("Ajoute un sujet et une description d'au moins 10 caractères.");
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
      toast.error(errorMessage(error, "Une erreur est survenue."));
      return;
    }
    setTitle("");
    setDescription("");
    toast.success("Ticket envoyé. Notre équipe te répondra bientôt.");
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
    const source =
      (faq.data?.length ?? 0) > 0
        ? faq.data!.map((f) => ({ id: f.id, category: "", question: f.question, answer: f.answer }))
        : FAQ_FALLBACK.map((f, i) => ({ id: `fallback-${i}`, ...f }));
    let filtered = source;
    if (category) {
      const keywords: Record<string, string[]> = {
        account: ["compte", "profil", "mot de passe"],
        roblox: ["roblox"],
        payment: ["paiement", "premium", "facture", "abonnement"],
        sparks: ["sparks", "spark", "like", "match"],
        report: ["signaler", "bloquer", "sécurité"],
        bug: ["bug"],
        copyright: ["droit", "dmca", "auteur"],
        other: [],
      };
      const words = keywords[category] ?? [];
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
  }, [faq.data, search, category]);

  const filteredTickets = (tickets.data ?? []).filter(
    (t) => ticketFilter === "all" || t.status === ticketFilter,
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4">
      <header className="flex items-center justify-between">
        <LogoWordmark className="h-6 w-auto" />
        <div className="flex items-center gap-2">
          <Link
            to="/notifications"
            aria-label="Notifications"
            className="relative grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-surface-2"
          >
            <Bell className="h-5 w-5" />
            {unread.data ? (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {unread.data > 9 ? "9+" : unread.data}
              </span>
            ) : null}
          </Link>
          <Link to="/profile" aria-label="Profil">
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
              <h1 className="text-2xl font-black">Support</h1>
              <p className="text-sm text-muted-foreground">Nous sommes là pour vous aider.</p>
            </div>
          </div>
          <p className="hidden shrink-0 -rotate-2 text-xs font-semibold text-[#C084FC] sm:block">
            Une communauté toujours à vos côtés. ♡
          </p>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Obtenez de l'aide, consultez nos guides ou contactez notre équipe.
        </p>
      </div>

      {view !== "home" ? (
        <button
          onClick={() => setView("home")}
          className="mt-4 text-sm font-semibold text-primary"
        >
          ← Retour au centre d'aide
        </button>
      ) : null}

      {view === "home" ? (
        <>
          <label className="mt-4 flex h-12 items-center gap-2 rounded-2xl border border-border bg-surface px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une réponse..."
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
              title="Créer un ticket"
              description="Obtenez de l'aide de notre équipe."
              onClick={() => {
                if (category) setTicketCategory(category);
                setView("newTicket");
              }}
            />
            <FeatureCard
              icon={BookOpen}
              title="Consulter la FAQ"
              description="Trouvez rapidement des réponses."
              onClick={() => document.getElementById("faq-section")?.scrollIntoView({ behavior: "smooth" })}
            />
            <FeatureCard
              icon={Server}
              title="Statut des services"
              description="État de nos services en temps réel."
              badge={allOperational ? "🟢" : undefined}
              onClick={() => document.getElementById("status-section")?.scrollIntoView({ behavior: "smooth" })}
            />
            <FeatureCard
              icon={Users}
              title="Communauté"
              description="Obtenez de l'aide entre joueurs."
              onClick={() => toast("Lien Discord bientôt disponible.")}
            />
          </div>

          <section id="status-section" className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <span className={cn("h-2.5 w-2.5 rounded-full", allOperational ? "bg-[#22C55E]" : "bg-[#F59E0B]")} />
                État des services
              </h2>
            </div>
            <p className={cn("mt-1 text-sm font-semibold", allOperational ? "text-[#22C55E]" : "text-[#F59E0B]")}>
              {allOperational ? "Tous les systèmes opérationnels" : overall?.message || "Perturbations en cours"}
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
                  Historique
                </p>
                <div className="space-y-2">
                  {incidents.data!.map((incident) => (
                    <div key={incident.id} className="rounded-2xl border border-border bg-card p-3 text-sm">
                      <p className="text-xs text-muted-foreground">
                        {new Date(incident.started_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                      <p className="mt-0.5 font-semibold">
                        {incident.status === "resolved" ? "🟢 Résolu" : "🟠 En cours"} — {incident.title}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section id="faq-section" className="mt-8">
            <h2 className="text-lg font-bold">Articles populaires</h2>
            <div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
              {filteredFaq.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Aucun résultat.</p>
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
              <span className="text-xs font-semibold text-muted-foreground">contact@bloxspark.com</span>
            </a>
            <button
              onClick={() => setView("myTickets")}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center"
            >
              <BookOpen className="h-5 w-5 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground">Mes tickets</span>
            </button>
            <button
              onClick={() => toast("Lien Discord bientôt disponible.")}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center"
            >
              <Users className="h-5 w-5 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground">Discord</span>
            </button>
          </section>
        </>
      ) : null}

      {view === "newTicket" ? (
        <section className="mt-4 space-y-4 rounded-3xl border border-border bg-card p-5">
          <h2 className="text-lg font-black">Nouveau ticket</h2>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sujet
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Décrivez brièvement votre problème"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Catégorie
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
              Priorité
            </label>
            <Select value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="low">Basse</option>
              <option value="medium">Moyenne</option>
              <option value="high">Haute</option>
              <option value="critical">Critique</option>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Description
            </label>
            <Textarea
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Expliquez votre problème en détail..."
            />
          </div>
          <Button
            className="w-full"
            disabled={sending || !title.trim() || description.trim().length < 10}
            onClick={() => void submitTicket()}
          >
            <Send className="h-4 w-4" /> {sending ? "Envoi..." : "Envoyer le ticket"}
          </Button>
        </section>
      ) : null}

      {view === "myTickets" ? (
        <section className="mt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black">Mes tickets</h2>
            <button
              onClick={() => setView("newTicket")}
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
            >
              + Nouveau ticket
            </button>
          </div>

          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {(
              [
                ["all", "Tous"],
                ["pending", "Ouverts"],
                ["in_progress", "En cours"],
                ["resolved", "Résolus"],
                ["wont_fix", "Fermés"],
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
              <p className="py-10 text-center text-sm text-muted-foreground">Aucun ticket.</p>
            ) : (
              filteredTickets.map((t) => (
                <div key={t.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                        t.status === "pending" && "bg-primary/10 text-primary",
                        t.status === "in_progress" && "bg-[#F59E0B]/10 text-[#F59E0B]",
                        t.status === "resolved" && "bg-[#22C55E]/10 text-[#22C55E]",
                        t.status === "wont_fix" && "bg-surface-2 text-muted-foreground",
                      )}
                    >
                      {t.status === "pending"
                        ? "Ouvert"
                        : t.status === "in_progress"
                          ? "En cours"
                          : t.status === "resolved"
                            ? "Résolu"
                            : "Fermé"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {CATEGORIES.find((c) => c.id === t.category)?.label ?? t.category}
                    </span>
                  </div>
                  <p className="mt-2 font-bold">{t.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleString("fr-FR")}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card p-5">
            <Headphones className="h-8 w-8 text-primary" />
            <p className="mt-3 font-black">Besoin d'une aide immédiate ?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Notre équipe est disponible pour vous aider.
            </p>
            <Button className="mt-4 w-full" onClick={() => setView("newTicket")}>
              Créer un nouveau ticket →
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
