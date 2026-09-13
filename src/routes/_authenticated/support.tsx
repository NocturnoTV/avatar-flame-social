import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, LifeBuoy, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button, Input, Label, Select, Textarea } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({ meta: [{ title: "Support — Bloxspark" }] }),
  component: SupportPage,
});

function SupportPage() {
  const { t, lang } = useI18n();
  const { user } = useSession();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("low");
  const [sending, setSending] = useState(false);

  const reports = useQuery({
    queryKey: ["my-support-reports", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("bug_reports")
        .select("id,title,status,created_at")
        .eq("reporter_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  async function submit() {
    if (!user || !title.trim() || description.trim().length < 10) return;
    setSending(true);
    const { error } = await supabase.from("bug_reports").insert({
      reporter_id: user.id,
      title: title.trim(),
      description: description.trim(),
      severity,
      page_url: window.location.href,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTitle("");
    setDescription("");
    setSeverity("low");
    toast.success(t("supportRequestSent"));
    void reports.refetch();
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-28 pt-5">
      <header className="flex items-center gap-3">
        <Link to="/home" aria-label={t("back")}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-black">{t("support")}</h1>
          <p className="text-sm text-muted-foreground">{t("supportSubtitle")}</p>
        </div>
      </header>

      <section className="mt-6 rounded-[2rem] border border-primary/20 bg-gradient-to-br from-blue-600 to-blue-400 p-6 text-white shadow-xl shadow-blue-500/15">
        <LifeBuoy className="h-9 w-9" />
        <h2 className="mt-4 text-xl font-black">{t("howCanWeHelp")}</h2>
        <p className="mt-1 text-sm text-white/80">{t("supportResponseHint")}</p>
      </section>

      <section className="mt-5 space-y-4 rounded-3xl border border-border bg-card p-5">
        <div>
          <Label>{t("supportSubject")}</Label>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div>
          <Label>{t("supportDetails")}</Label>
          <Textarea
            rows={6}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t("supportDetailsHint")}
          />
        </div>
        <div>
          <Label>{t("priority")}</Label>
          <Select value={severity} onChange={(event) => setSeverity(event.target.value)}>
            <option value="low">{t("priorityLow")}</option>
            <option value="medium">{t("priorityMedium")}</option>
            <option value="high">{t("priorityHigh")}</option>
            <option value="critical">{t("priorityCritical")}</option>
          </Select>
        </div>
        <Button
          className="w-full"
          disabled={sending || !title.trim() || description.trim().length < 10}
          onClick={() => void submit()}
        >
          <Send className="h-4 w-4" /> {sending ? t("sending") : t("sendSupportRequest")}
        </Button>
      </section>

      {reports.data?.length ? (
        <section className="mt-6">
          <h2 className="mb-3 font-black">{t("myRequests")}</h2>
          <div className="space-y-2">
            {reports.data.map((report) => (
              <article
                key={report.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{report.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      `supportStatus${report.status
                        .split("_")
                        .map((part) => part[0]?.toUpperCase() + part.slice(1))
                        .join("")}`,
                    )}{" "}
                    · {new Date(report.created_at).toLocaleDateString(lang)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
