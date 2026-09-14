import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Gamepad2,
  LoaderCircle,
  Radio,
  Send,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getRobloxStatus } from "@/lib/roblox-status.functions";
import { useSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import { Button, Select, Textarea } from "@/components/ui-kit";
import { cn, errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/status")({
  head: () => ({
    meta: [
      { title: "Status - BloxSpark" },
      {
        name: "description",
        content: "Live Roblox and BloxSpark service status with community outage reports.",
      },
    ],
  }),
  component: StatusPage,
});

const COPY = {
  en: {
    eyebrow: "Live service health",
    title: "Is Roblox down?",
    subtitle: "Official Roblox status and real-time reports from the BloxSpark community.",
    operational: "All systems operational",
    disrupted: "Some services are disrupted",
    reports: "Community reports",
    last24: "Reports during the last 24 hours",
    report: "Report a problem",
    choose: "Affected service",
    details: "What is happening? (optional)",
    send: "Send report",
    sent: "Thanks. Your report helps the community.",
    incidents: "Active incidents",
    noIncidents: "No active incident reported by Roblox.",
    bloxspark: "BloxSpark services",
    official: "Official Roblox status",
    updated: "Last checked",
    rate: "You can send one report every five minutes.",
  },
  fr: {
    eyebrow: "État des services en direct",
    title: "Roblox est en panne ?",
    subtitle: "Statut officiel Roblox et signalements en temps réel de la communauté BloxSpark.",
    operational: "Tous les systèmes fonctionnent",
    disrupted: "Certains services sont perturbés",
    reports: "Signalements de la communauté",
    last24: "Signalements durant les dernières 24 heures",
    report: "Signaler un problème",
    choose: "Service concerné",
    details: "Que se passe-t-il ? (facultatif)",
    send: "Envoyer le signalement",
    sent: "Merci. Ton signalement aide la communauté.",
    incidents: "Incidents en cours",
    noIncidents: "Aucun incident actif signalé par Roblox.",
    bloxspark: "Services BloxSpark",
    official: "Statut officiel Roblox",
    updated: "Dernière vérification",
    rate: "Tu peux envoyer un signalement toutes les cinq minutes.",
  },
  es: {
    eyebrow: "Estado en directo",
    title: "¿Roblox está caído?",
    subtitle: "Estado oficial de Roblox e informes en tiempo real de la comunidad BloxSpark.",
    operational: "Todos los sistemas funcionan",
    disrupted: "Algunos servicios tienen problemas",
    reports: "Informes de la comunidad",
    last24: "Informes de las últimas 24 horas",
    report: "Informar de un problema",
    choose: "Servicio afectado",
    details: "¿Qué ocurre? (opcional)",
    send: "Enviar informe",
    sent: "Gracias. Tu informe ayuda a la comunidad.",
    incidents: "Incidentes activos",
    noIncidents: "Roblox no informa de incidentes activos.",
    bloxspark: "Servicios BloxSpark",
    official: "Estado oficial de Roblox",
    updated: "Última comprobación",
    rate: "Puedes enviar un informe cada cinco minutos.",
  },
  pt: {
    eyebrow: "Estado dos serviços ao vivo",
    title: "O Roblox está fora do ar?",
    subtitle: "Estado oficial do Roblox e relatos em tempo real da comunidade BloxSpark.",
    operational: "Todos os sistemas operacionais",
    disrupted: "Alguns serviços estão com problemas",
    reports: "Relatos da comunidade",
    last24: "Relatos nas últimas 24 horas",
    report: "Relatar um problema",
    choose: "Serviço afetado",
    details: "O que está acontecendo? (opcional)",
    send: "Enviar relato",
    sent: "Obrigado. Seu relato ajuda a comunidade.",
    incidents: "Incidentes ativos",
    noIncidents: "Nenhum incidente ativo relatado pelo Roblox.",
    bloxspark: "Serviços BloxSpark",
    official: "Estado oficial do Roblox",
    updated: "Última verificação",
    rate: "Você pode enviar um relato a cada cinco minutos.",
  },
  de: {
    eyebrow: "Live-Servicestatus",
    title: "Ist Roblox ausgefallen?",
    subtitle: "Offizieller Roblox-Status und Echtzeitmeldungen der BloxSpark-Community.",
    operational: "Alle Systeme funktionieren",
    disrupted: "Einige Dienste sind beeinträchtigt",
    reports: "Community-Meldungen",
    last24: "Meldungen der letzten 24 Stunden",
    report: "Problem melden",
    choose: "Betroffener Dienst",
    details: "Was passiert gerade? (optional)",
    send: "Meldung senden",
    sent: "Danke. Deine Meldung hilft der Community.",
    incidents: "Aktive Störungen",
    noIncidents: "Roblox meldet keine aktive Störung.",
    bloxspark: "BloxSpark-Dienste",
    official: "Offizieller Roblox-Status",
    updated: "Zuletzt geprüft",
    rate: "Du kannst alle fünf Minuten eine Meldung senden.",
  },
  ko: {
    eyebrow: "실시간 서비스 상태",
    title: "Roblox에 장애가 있나요?",
    subtitle: "Roblox 공식 상태와 BloxSpark 커뮤니티의 실시간 제보를 확인하세요.",
    operational: "모든 시스템 정상",
    disrupted: "일부 서비스에 문제가 있습니다",
    reports: "커뮤니티 제보",
    last24: "최근 24시간 제보",
    report: "문제 신고",
    choose: "문제가 있는 서비스",
    details: "어떤 문제가 있나요? (선택)",
    send: "제보 보내기",
    sent: "감사합니다. 제보가 커뮤니티에 도움이 됩니다.",
    incidents: "진행 중인 장애",
    noIncidents: "Roblox에서 보고한 진행 중인 장애가 없습니다.",
    bloxspark: "BloxSpark 서비스",
    official: "Roblox 공식 상태",
    updated: "마지막 확인",
    rate: "5분마다 한 번 제보할 수 있습니다.",
  },
} as const;

const SERVICES = [
  "website",
  "login",
  "game_join",
  "studio",
  "avatar",
  "marketplace",
  "other",
] as const;

function StatusPage() {
  const { user } = useSession();
  const { lang } = useI18n();
  const copy = COPY[lang as keyof typeof COPY] ?? COPY.en;
  const [service, setService] = useState<(typeof SERVICES)[number]>("game_join");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const roblox = useQuery({
    queryKey: ["roblox-live-status"],
    queryFn: () => getRobloxStatus(),
    refetchInterval: 60000,
  });
  const bloxspark = useQuery({
    queryKey: ["public-service-status"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_status")
        .select("id,status,message,updated_at")
        .neq("id", "default");
      return data ?? [];
    },
    refetchInterval: 60000,
  });
  const reports = useQuery({
    queryKey: ["status-report-series"],
    queryFn: async () => {
      const { data } = await supabase.rpc("status_report_series");
      return data ?? [];
    },
    refetchInterval: 30000,
  });
  const totalReports = (reports.data ?? []).reduce(
    (sum, point) => sum + Number(point.report_count),
    0,
  );
  const maxReports = Math.max(
    1,
    ...(reports.data ?? []).map((point) => Number(point.report_count)),
  );
  const isHealthy = roblox.data?.indicator === "none" && totalReports < 10;

  async function submitReport() {
    if (!user || sending) return;
    setSending(true);
    const { error } = await supabase
      .from("status_reports")
      .insert({ user_id: user.id, service, details: details.trim() || null });
    setSending(false);
    if (error) {
      toast.error(errorMessage(error, copy.rate));
      return;
    }
    setDetails("");
    toast.success(copy.sent);
    void reports.refetch();
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-28 pt-5">
      <section className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-br from-violet-950 via-purple-900 to-fuchsia-900 p-6 text-white shadow-[0_25px_80px_-35px_rgba(147,51,234,.9)] sm:p-8">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-fuchsia-400/25 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-black uppercase tracking-[.22em] text-purple-200">
            {copy.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-black sm:text-5xl">{copy.title}</h1>
          <p className="mt-3 max-w-2xl text-sm text-purple-100/75 sm:text-base">{copy.subtitle}</p>
          <div
            className={cn(
              "mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black backdrop-blur",
              isHealthy
                ? "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/30"
                : "bg-amber-400/15 text-amber-100 ring-1 ring-amber-300/30",
            )}
          >
            {isHealthy ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
            {isHealthy ? copy.operational : copy.disrupted}
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
        <section className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-primary">
                {copy.official}
              </p>
              <h2 className="mt-1 text-xl font-black">
                {roblox.data?.description ?? "Checking Roblox…"}
              </h2>
            </div>
            {roblox.isLoading ? (
              <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <Radio className="h-5 w-5 text-emerald-500" />
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {copy.updated}:{" "}
            {roblox.data ? new Date(roblox.data.updatedAt).toLocaleString(lang) : "…"}
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {(roblox.data?.components ?? []).slice(0, 12).map((component) => (
              <div
                key={component.id}
                className="flex items-center justify-between rounded-2xl bg-surface px-3 py-2.5"
              >
                <span className="truncate text-sm font-semibold">{component.name}</span>
                <span
                  className={cn(
                    "ml-2 h-2.5 w-2.5 shrink-0 rounded-full",
                    component.status === "operational" ? "bg-emerald-500" : "bg-amber-500",
                  )}
                />
              </div>
            ))}
          </div>
          <a
            href="https://status.roblox.com/"
            target="_blank"
            rel="noreferrer noopener"
            className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-primary"
          >
            status.roblox.com <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </section>
        <section className="rounded-3xl border border-border bg-card p-5">
          <p className="text-xs font-black uppercase tracking-wide text-primary">{copy.reports}</p>
          <p className="mt-2 text-4xl font-black">{totalReports}</p>
          <p className="text-sm text-muted-foreground">{copy.last24}</p>
          <div className="mt-5 flex h-28 items-end gap-1">
            {(reports.data ?? []).map((point) => (
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
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-black">
            <Gamepad2 className="h-5 w-5 text-primary" /> {copy.incidents}
          </h2>
          {(roblox.data?.incidents ?? []).length ? (
            <div className="mt-3 space-y-2">
              {roblox.data!.incidents.map((incident) => (
                <div
                  key={incident.id}
                  className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3"
                >
                  <p className="font-bold">{incident.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {incident.status} · {incident.impact}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl bg-emerald-500/5 p-4 text-sm text-emerald-600">
              {copy.noIncidents}
            </p>
          )}
        </section>
        <section className="rounded-3xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-black">
            <ShieldCheck className="h-5 w-5 text-primary" /> {copy.bloxspark}
          </h2>
          <div className="mt-3 space-y-2">
            {(bloxspark.data ?? []).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-2xl bg-surface px-3 py-3"
              >
                <div>
                  <p className="text-sm font-bold capitalize">{item.id.replace("_", " ")}</p>
                  {item.message ? (
                    <p className="text-xs text-muted-foreground">{item.message}</p>
                  ) : null}
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-1 text-[10px] font-black uppercase",
                    item.status === "operational"
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-amber-500/10 text-amber-500",
                  )}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-[2rem] border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-xl font-black">
          <Activity className="h-6 w-6 text-primary" /> {copy.report}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{copy.rate}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-muted-foreground">
            {copy.choose}
            <Select
              value={service}
              onChange={(event) => setService(event.target.value as typeof service)}
              className="mt-2"
            >
              {SERVICES.map((item) => (
                <option key={item} value={item}>
                  {item.replace("_", " ")}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-xs font-bold text-muted-foreground">
            {copy.details}
            <Textarea
              value={details}
              maxLength={500}
              onChange={(event) => setDetails(event.target.value)}
              rows={3}
              className="mt-2"
            />
          </label>
        </div>
        <Button
          className="mt-4 w-full sm:w-auto"
          disabled={sending}
          onClick={() => void submitReport()}
        >
          {sending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {copy.send}
        </Button>
      </section>
    </main>
  );
}
