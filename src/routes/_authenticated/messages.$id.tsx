import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, Mic, Send, Square } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui-kit";
import { StoredAudio, StoredImage } from "@/components/Media";
import { uploadFile } from "@/lib/media";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

const EMOJIS = [
  "😀",
  "😂",
  "🥰",
  "😎",
  "😭",
  "🔥",
  "✨",
  "💖",
  "👀",
  "🎮",
  "🧱",
  "🚀",
  "👍",
  "🙏",
  "💀",
  "🤝",
];

export const Route = createFileRoute("/_authenticated/messages/$id")({
  head: () => ({
    meta: [
      { title: "Discussion — Bloxspark" },
      {
        name: "description",
        content: "Discussion privée Bloxspark avec messages vocaux et photos.",
      },
      { property: "og:title", content: "Discussion — Bloxspark" },
      { property: "og:description", content: "Messages texte, photos et vocaux." },
    ],
  }),
  component: Conversation,
});

type Message = {
  id: string;
  sender_id: string;
  content: string | null;
  kind: "text" | "image" | "voice";
  media_url: string | null;
  created_at: string;
};

function Conversation() {
  const { id } = Route.useParams();
  const { t } = useI18n();
  const { user } = useSession();
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const header = useQuery({
    queryKey: ["conversation", id],
    queryFn: async () => {
      const { data: convo } = await supabase
        .from("conversations")
        .select("id,is_group,name")
        .eq("id", id)
        .maybeSingle();
      const { data: members } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", id);
      const otherIds = (members ?? []).map((m) => m.user_id).filter((uid) => uid !== user?.id);
      const allIds = [
        ...new Set([...(members ?? []).map((m) => m.user_id), user?.id].filter(Boolean)),
      ] as string[];
      const { data: people } = await supabase
        .from("profiles")
        .select("id,username,avatar_url")
        .in("id", allIds.length > 0 ? allIds : ["00000000-0000-0000-0000-000000000000"]);
      const byId: Record<string, { username: string; avatar_url: string | null }> = {};
      for (const p of (people ?? []) as {
        id: string;
        username: string;
        avatar_url: string | null;
      }[]) {
        byId[p.id] = { username: p.username, avatar_url: p.avatar_url };
      }
      const others = otherIds.map((uid) => byId[uid]?.username ?? "?");

      return {
        title: convo?.is_group ? convo.name : (others[0] ?? "?"),
        isGroup: !!convo?.is_group,
        members: others.length + 1,
        people: byId,
        otherId: otherIds[0] ?? null,
      };
    },
  });

  const messages = useQuery({
    queryKey: ["messages", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id,sender_id,content,kind,media_url,created_at")
        .eq("conversation_id", id)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`messages-${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${id}`,
        },
        () => {
          void messages.refetch();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data]);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", id)
      .eq("user_id", user.id);
  }, [id, user, messages.data]);

  async function send(kind: "text" | "image" | "voice", payload?: string) {
    if (!user) return;
    if (kind === "text" && !text.trim()) return;
    const { error } = await supabase.from("messages").insert({
      conversation_id: id,
      sender_id: user.id,
      kind,
      content: kind === "text" ? text.trim() : null,
      media_url: payload ?? null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    if (kind === "text") setText("");
    void messages.refetch();
  }

  async function pickImage(file: File) {
    if (!user) return;
    try {
      const path = await uploadFile(
        "profile-photos",
        user.id,
        file,
        file.name.split(".").pop() ?? "jpg",
      );
      await send("image", path);
    } catch {
      toast.error(t("errorGeneric"));
    }
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        if (!user) return;
        const file = new File([blob], "voice.webm", { type: "audio/webm" });
        const path = await uploadFile("voice-messages", user.id, file, "webm");
        await send("voice", path);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast.error(t("micDenied"));
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-5rem)] w-full max-w-md flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Link to="/messages" aria-label={t("back")}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {header.data?.isGroup || !header.data?.otherId ? (
          <div className="spark-gradient flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white">
            👥
          </div>
        ) : (
          <Link to="/users/$id" params={{ id: header.data.otherId }}>
            <StoredImage
              path={header.data.people[header.data.otherId]?.avatar_url}
              alt={header.data.title ?? ""}
              className="h-9 w-9 rounded-full"
              fallback={header.data.title?.[0]?.toUpperCase() ?? "?"}
            />
          </Link>
        )}
        <div>
          <p className="font-semibold leading-tight">{header.data?.title}</p>
          {header.data?.isGroup ? (
            <p className="text-xs text-muted-foreground">
              {header.data.members} {t("members")}
            </p>
          ) : null}
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {(messages.data ?? []).map((m) => {
          const mine = m.sender_id === user?.id;
          const sender = header.data?.people?.[m.sender_id];
          return (
            <div
              key={m.id}
              className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}
            >
              {!mine ? (
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-border bg-surface-2">
                  <StoredImage
                    path={sender?.avatar_url ?? null}
                    alt={sender?.username ?? ""}
                    className="h-full w-full"
                    fallback="🎮"
                  />
                </div>
              ) : null}
              <div
                className={cn(
                  "max-w-[78%] rounded-3xl px-4 py-2.5 text-sm",
                  mine ? "spark-gradient text-white" : "bg-surface-2 text-foreground",
                )}
              >
                {!mine && header.data?.isGroup ? (
                  <p className="mb-0.5 text-xs font-bold text-muted-foreground">
                    {sender?.username ?? "?"}
                  </p>
                ) : null}
                {m.kind === "text" ? (
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                ) : null}
                {m.kind === "image" ? (
                  <StoredImage path={m.media_url} alt="" className="h-48 w-48 rounded-2xl" />
                ) : null}
                {m.kind === "voice" ? <StoredAudio path={m.media_url} /> : null}
              </div>
              {mine ? (
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-border bg-surface-2">
                  <StoredImage
                    path={sender?.avatar_url ?? null}
                    alt=""
                    className="h-full w-full"
                    fallback="🙂"
                  />
                </div>
              ) : null}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {showEmoji ? (
        <div className="grid grid-cols-8 gap-1 border-t border-border p-2 text-2xl">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setText((v) => v + e)}
              className="rounded-lg p-1 hover:bg-surface-2"
            >
              {e}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-2 border-t border-border px-3 py-3">
        <button onClick={() => setShowEmoji((v) => !v)} className="text-xl" aria-label="emoji">
          😀
        </button>
        <button onClick={() => fileRef.current?.click()} aria-label={t("addPhoto")}>
          <ImagePlus className="h-5 w-5 text-muted-foreground" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void pickImage(file);
            e.target.value = "";
          }}
        />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send("text");
          }}
          placeholder={t("typeMessage")}
          className="h-11 flex-1 rounded-full border border-border bg-surface-2 px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={toggleRecording}
          className={cn(
            "rounded-full p-2",
            recording ? "bg-destructive text-white" : "text-muted-foreground",
          )}
          aria-label={t("recordVoice")}
        >
          {recording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
        <Button size="icon" onClick={() => send("text")} aria-label={t("send")}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
