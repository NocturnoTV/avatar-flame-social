import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage } from "@/components/Media";
import { useSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { notifyNewMessage } from "@/lib/messages.functions";

// Public STUN only - no TURN server is configured (that requires a paid
// relay service). Calls connect directly between devices, which works on
// most home networks but can fail behind strict corporate firewalls or
// symmetric NATs. That's a known, disclosed limitation.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const RING_TIMEOUT_MS = 45_000;

export type CallPeer = { id: string; username: string; avatarUrl: string | null };
type CallPhase = "idle" | "outgoing" | "incoming" | "connecting" | "active";

type CallState = {
  phase: CallPhase;
  isGroup: boolean;
  invitedIds: string[];
  connectedIds: string[];
  peersById: Record<string, CallPeer>;
  muted: boolean;
  elapsedSeconds: number;
};

type CallContextValue = {
  state: CallState;
  startCall: (conversationId: string, peers: CallPeer[]) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
};

const IDLE_STATE: CallState = {
  phase: "idle",
  isGroup: false,
  invitedIds: [],
  connectedIds: [],
  peersById: {},
  muted: false,
  elapsedSeconds: 0,
};

const CallContext = createContext<CallContextValue | null>(null);

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within CallProvider");
  return ctx;
}

/** A soft, modern ascending 4-note chime (like a doorbell/notification
 * melody) instead of a flat single-tone beep - looped with a pause between
 * repeats so it reads as a real ringtone, not a siren. */
function playRingtone() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    let stopped = false;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    function chime() {
      if (stopped) return;
      const start = ctx.currentTime;
      notes.forEach((freq, i) => {
        const t0 = start + i * 0.13;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(0.16, t0 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.6);
      });
    }
    chime();
    const interval = setInterval(chime, 2200);
    return () => {
      stopped = true;
      clearInterval(interval);
      void ctx.close();
    };
  } catch {
    return () => {};
  }
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const { t } = useI18n();
  const [state, setState] = useState<CallState>(IDLE_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;

  const roomRef = useRef<RealtimeChannel | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRingtoneRef = useRef<(() => void) | null>(null);
  const isCallerRef = useRef(false);
  const answeredAtRef = useRef<number | null>(null);
  const callIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const myIdRef = useRef<string | null>(null);
  myIdRef.current = user?.id ?? null;

  function ring() {
    stopRingtoneRef.current?.();
    stopRingtoneRef.current = playRingtone();
  }
  function stopRing() {
    stopRingtoneRef.current?.();
    stopRingtoneRef.current = null;
  }

  function startTimer() {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setState((s) => ({ ...s, elapsedSeconds: s.elapsedSeconds + 1 }));
    }, 1000);
  }

  function teardownPeer(peerId: string) {
    pcsRef.current.get(peerId)?.close();
    pcsRef.current.delete(peerId);
    pendingCandidatesRef.current.delete(peerId);
    const audioEl = audioElsRef.current.get(peerId);
    if (audioEl) audioEl.srcObject = null;
    setState((s) => ({ ...s, connectedIds: s.connectedIds.filter((id) => id !== peerId) }));
  }

  function reset() {
    stopRing();
    if (timerRef.current) clearInterval(timerRef.current);
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    timerRef.current = null;
    ringTimeoutRef.current = null;
    connectTimeoutRef.current = null;
    for (const pc of pcsRef.current.values()) pc.close();
    pcsRef.current.clear();
    pendingCandidatesRef.current.clear();
    audioElsRef.current.clear();
    localStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    localStreamRef.current = null;
    if (roomRef.current) {
      void roomRef.current.untrack();
      void supabase.removeChannel(roomRef.current);
      roomRef.current = null;
    }
    answeredAtRef.current = null;
    callIdRef.current = null;
    conversationIdRef.current = null;
    setState(IDLE_STATE);
  }

  async function finalizeCall(finalStatus: "ended" | "declined" | "missed") {
    const callId = callIdRef.current;
    const conversationId = conversationIdRef.current;
    const wasCaller = isCallerRef.current;
    const answeredAt = answeredAtRef.current;
    if (callId && wasCaller) {
      const durationSeconds = answeredAt ? Math.round((Date.now() - answeredAt) / 1000) : null;
      await supabase
        .from("calls")
        .update({
          status: finalStatus,
          ended_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
        })
        .eq("id", callId);
      if (conversationId && user) {
        if (finalStatus === "ended" && durationSeconds) {
          const mm = Math.floor(durationSeconds / 60);
          const ss = String(durationSeconds % 60).padStart(2, "0");
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            sender_id: user.id,
            kind: "system",
            content: `sys:call:${mm}:${ss}`,
          });
        } else if (finalStatus === "missed") {
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            sender_id: user.id,
            kind: "system",
            content: "sys:missedcall:",
          });
          void notifyNewMessage({ data: { conversationId, kind: "missed_call", content: null } });
        } else if (finalStatus === "declined") {
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            sender_id: user.id,
            kind: "system",
            content: "sys:calldeclined:",
          });
        }
      }
    }
    reset();
  }

  async function drainPendingCandidates(peerId: string, pc: RTCPeerConnection) {
    const queued = pendingCandidatesRef.current.get(peerId) ?? [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // Stale/duplicate candidate - safe to ignore.
      }
    }
    pendingCandidatesRef.current.delete(peerId);
  }

  async function handleRemoteIce(peerId: string, candidate: RTCIceCandidateInit | undefined) {
    if (!candidate) return;
    const pc = pcsRef.current.get(peerId);
    if (pc?.remoteDescription) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // Ignore - connection may already be closing.
      }
    } else {
      const queued = pendingCandidatesRef.current.get(peerId) ?? [];
      queued.push(candidate);
      pendingCandidatesRef.current.set(peerId, queued);
    }
  }

  async function getLocalStream() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      return stream;
    } catch {
      toast.error(t("micPermissionDenied"));
      return null;
    }
  }

  function armConnectTimeout() {
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    connectTimeoutRef.current = setTimeout(() => {
      if (stateRef.current.phase === "connecting" && stateRef.current.connectedIds.length === 0) {
        toast.error(t("callConnectFailed"));
        void finalizeCall("ended");
      }
    }, 20_000);
  }

  function makePeerConnection(peerId: string, room: RealtimeChannel): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcsRef.current.set(peerId, pc);
    const stream = localStreamRef.current;
    stream?.getTracks().forEach((tr) => pc.addTrack(tr, stream));
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      const audioEl = audioElsRef.current.get(peerId);
      if (audioEl && remoteStream) {
        audioEl.srcObject = remoteStream;
        void audioEl.play().catch(() => {});
      }
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        void room.send({
          type: "broadcast",
          event: "ice",
          payload: { to: peerId, from: myIdRef.current, candidate: e.candidate.toJSON() },
        });
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        if (!answeredAtRef.current) {
          answeredAtRef.current = Date.now();
          startTimer();
        }
        stopRing();
        setState((s) => ({
          ...s,
          phase: "active",
          connectedIds: s.connectedIds.includes(peerId) ? s.connectedIds : [...s.connectedIds, peerId],
        }));
      } else if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        teardownPeer(peerId);
      }
    };
    return pc;
  }

  async function connectToPeer(peerId: string, room: RealtimeChannel) {
    if (pcsRef.current.has(peerId) || !myIdRef.current) return;
    const pc = makePeerConnection(peerId, room);
    const shouldInitiate = myIdRef.current < peerId;
    if (shouldInitiate) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      void room.send({
        type: "broadcast",
        event: "offer",
        payload: { to: peerId, from: myIdRef.current, sdp: offer },
      });
    }
  }

  async function handleOffer(peerId: string, sdp: RTCSessionDescriptionInit, room: RealtimeChannel) {
    if (!localStreamRef.current) return;
    let pc = pcsRef.current.get(peerId);
    if (!pc) pc = makePeerConnection(peerId, room);
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await drainPendingCandidates(peerId, pc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    void room.send({
      type: "broadcast",
      event: "answer",
      payload: { to: peerId, from: myIdRef.current, sdp: answer },
    });
  }

  async function handleAnswer(peerId: string, sdp: RTCSessionDescriptionInit) {
    const pc = pcsRef.current.get(peerId);
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await drainPendingCandidates(peerId, pc);
  }

  /** One shared broadcast+presence channel per call - works identically for
   * a 1:1 call (a 2-person mesh) and a group call (an N-person mesh): every
   * participant tracks their own presence, and on every presence sync each
   * client connects to any peer it doesn't already have a connection to,
   * with the lower user id always sending the offer to avoid glare. */
  function subscribeRoom(callId: string, myId: string) {
    const room = supabase.channel(`call:${callId}`, {
      config: { broadcast: { self: false }, presence: { key: myId } },
    });
    room
      .on("broadcast", { event: "offer" }, ({ payload }) => {
        if (payload.to !== myIdRef.current) return;
        void handleOffer(payload.from, payload.sdp, room);
      })
      .on("broadcast", { event: "answer" }, ({ payload }) => {
        if (payload.to !== myIdRef.current) return;
        void handleAnswer(payload.from, payload.sdp);
      })
      .on("broadcast", { event: "ice" }, ({ payload }) => {
        if (payload.to !== myIdRef.current) return;
        void handleRemoteIce(payload.from, payload.candidate);
      })
      .on("broadcast", { event: "declined" }, ({ payload }) => {
        if (isCallerRef.current) toast.message(t("peerDeclinedCall", { username: payload.username }));
      })
      .on("presence", { event: "sync" }, () => {
        const presenceState = room.presenceState<{ username: string; avatarUrl: string | null }>();
        const others = Object.keys(presenceState).filter((id) => id !== myIdRef.current);
        setState((s) => {
          const peersById = { ...s.peersById };
          for (const id of others) {
            const meta = presenceState[id]?.[0];
            if (meta) peersById[id] = { id, username: meta.username, avatarUrl: meta.avatarUrl };
          }
          return { ...s, peersById };
        });
        for (const id of others) void connectToPeer(id, room);
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        if (key === myIdRef.current) return;
        teardownPeer(key);
        const remaining = Object.keys(room.presenceState()).filter((id) => id !== myIdRef.current);
        if (remaining.length === 0) {
          toast.message(t("callEnded"));
          if (isCallerRef.current) void finalizeCall("ended");
          else reset();
        }
      })
      .subscribe();
    roomRef.current = room;
    return room;
  }

  async function startCall(conversationId: string, peers: CallPeer[]) {
    if (!user || peers.length === 0) return;
    if (stateRef.current.phase !== "idle") {
      toast.error(t("callAlreadyActive"));
      return;
    }
    const stream = await getLocalStream();
    if (!stream) return;
    const callId = crypto.randomUUID();
    callIdRef.current = callId;
    conversationIdRef.current = conversationId;
    isCallerRef.current = true;
    const isGroup = peers.length > 1;
    const { data: me } = await supabase
      .from("profiles")
      .select("username,avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    await supabase.from("calls").insert({
      id: callId,
      conversation_id: conversationId,
      caller_id: user.id,
      callee_id: isGroup ? null : (peers[0]?.id ?? null),
      is_group: isGroup,
      status: "ringing",
    });
    await supabase
      .from("call_participants")
      .insert(peers.map((p) => ({ call_id: callId, user_id: p.id, status: "invited" as const })));

    const room = subscribeRoom(callId, user.id);
    void room.track({ username: me?.username ?? "?", avatarUrl: me?.avatar_url ?? null });

    await Promise.all(
      peers.map(async (peer) => {
        const inbox = supabase.channel(`calls:${peer.id}`, { config: { broadcast: { self: false } } });
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 4000);
          inbox.subscribe((status) => {
            if (status === "SUBSCRIBED") {
              clearTimeout(timeout);
              resolve();
            }
          });
        });
        void inbox.send({
          type: "broadcast",
          event: "invite",
          payload: {
            callId,
            conversationId,
            isGroup,
            callerId: user.id,
            callerName: me?.username ?? "?",
            callerAvatar: me?.avatar_url ?? null,
            peers: peers.map((p) => ({ id: p.id, username: p.username, avatarUrl: p.avatarUrl })),
          },
        });
        void supabase.removeChannel(inbox);
      }),
    );

    const peersById: Record<string, CallPeer> = {};
    for (const p of peers) peersById[p.id] = p;
    setState({
      phase: "outgoing",
      isGroup,
      invitedIds: peers.map((p) => p.id),
      connectedIds: [],
      peersById,
      muted: false,
      elapsedSeconds: 0,
    });
    ring();
    ringTimeoutRef.current = setTimeout(() => {
      if (stateRef.current.connectedIds.length === 0) void finalizeCall("missed");
    }, RING_TIMEOUT_MS);
  }

  async function acceptCall() {
    const callId = callIdRef.current;
    const myId = myIdRef.current;
    if (!callId || !myId) return;
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    stopRing();
    setState((s) => ({ ...s, phase: "connecting" }));
    armConnectTimeout();
    const stream = await getLocalStream();
    if (!stream) {
      declineCall();
      return;
    }
    await supabase
      .from("call_participants")
      .update({ status: "joined", joined_at: new Date().toISOString() })
      .eq("call_id", callId)
      .eq("user_id", myId);
    await supabase
      .from("calls")
      .update({ status: "accepted", answered_at: new Date().toISOString() })
      .eq("id", callId);
    const { data: me } = await supabase
      .from("profiles")
      .select("username,avatar_url")
      .eq("id", myId)
      .maybeSingle();
    const room = subscribeRoom(callId, myId);
    void room.track({ username: me?.username ?? "?", avatarUrl: me?.avatar_url ?? null });
  }

  function declineCall() {
    const callId = callIdRef.current;
    const myId = myIdRef.current;
    if (callId && myId) {
      void supabase
        .from("call_participants")
        .update({ status: "declined" })
        .eq("call_id", callId)
        .eq("user_id", myId);
      // invitedIds[0] is always the caller for an incoming invite (see the
      // invite handler below) - that's who needs to hear about the decline.
      const callerId = stateRef.current.invitedIds[0];
      const peer = callerId ? stateRef.current.peersById[callerId] : undefined;
      void (async () => {
        const { data: me } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", myId)
          .maybeSingle();
        if (peer) {
          const inbox = supabase.channel(`calls:${peer.id}`, { config: { broadcast: { self: false } } });
          inbox.subscribe((status) => {
            if (status === "SUBSCRIBED") {
              void inbox.send({
                type: "broadcast",
                event: "declined",
                payload: { callId, username: me?.username ?? "?" },
              });
              void supabase.removeChannel(inbox);
            }
          });
        }
      })();
    }
    reset();
  }

  function endCall() {
    const remainingOthers = roomRef.current
      ? Object.keys(roomRef.current.presenceState()).filter((id) => id !== myIdRef.current)
      : [];
    if (isCallerRef.current || remainingOthers.length === 0) {
      void finalizeCall("ended");
    } else {
      reset();
    }
  }

  function toggleMute() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !stateRef.current.muted;
    stream.getAudioTracks().forEach((tr) => {
      tr.enabled = !next;
    });
    setState((s) => ({ ...s, muted: next }));
  }

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`calls:${user.id}`, { config: { broadcast: { self: false } } });
    channel
      .on("broadcast", { event: "invite" }, ({ payload }) => {
        if (stateRef.current.phase !== "idle") return; // Busy - caller's ring will time out as missed.
        callIdRef.current = payload.callId;
        conversationIdRef.current = payload.conversationId;
        isCallerRef.current = false;
        const invitedPeers: CallPeer[] = [
          { id: payload.callerId, username: payload.callerName, avatarUrl: payload.callerAvatar },
          ...((payload.peers as CallPeer[] | undefined) ?? []).filter(
            (p) => p.id !== user.id && p.id !== payload.callerId,
          ),
        ];
        const peersById: Record<string, CallPeer> = {};
        for (const p of invitedPeers) peersById[p.id] = p;
        setState({
          phase: "incoming",
          isGroup: !!payload.isGroup,
          invitedIds: invitedPeers.map((p) => p.id),
          connectedIds: [],
          peersById,
          muted: false,
          elapsedSeconds: 0,
        });
        ring();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => reset, []);

  const allKnownPeerIds = [...new Set([...state.invitedIds, ...state.connectedIds])];

  return (
    <CallContext.Provider value={{ state, startCall, acceptCall, declineCall, endCall, toggleMute }}>
      {children}
      {allKnownPeerIds.map((peerId) => (
        <audio
          key={peerId}
          ref={(el) => {
            if (el) audioElsRef.current.set(peerId, el);
            else audioElsRef.current.delete(peerId);
          }}
          autoPlay
          className="hidden"
        />
      ))}
      {state.phase === "incoming" ? (
        <IncomingCallBubble
          state={state}
          onAccept={() => void acceptCall()}
          onDecline={declineCall}
        />
      ) : state.phase !== "idle" ? (
        <CallOverlay
          state={state}
          onEnd={endCall}
          onToggleMute={toggleMute}
        />
      ) : null}
    </CallContext.Provider>
  );
}

/** Compact, non-intrusive top-center pill for an incoming call - unlike the
 * old full-screen takeover, this lets you see and keep using the app while
 * deciding whether to answer, closer to a native OS call banner. */
function IncomingCallBubble({
  state,
  onAccept,
  onDecline,
}: {
  state: CallState;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { t } = useI18n();
  const first = state.peersById[state.invitedIds[0] ?? ""];
  if (!first) return null;
  const label =
    state.isGroup && state.invitedIds.length > 1
      ? t("incomingGroupCall", { name: first.username, count: state.invitedIds.length - 1 })
      : first.username;

  return (
    <div className="fixed inset-x-0 top-3 z-[200] flex justify-center px-3">
      <div className="bx-pop flex items-center gap-3 rounded-full border border-border bg-card/95 py-2 pl-2 pr-3 shadow-lg shadow-black/10 backdrop-blur-xl">
        <StoredImage
          path={first.avatarUrl}
          alt={first.username}
          className="h-9 w-9 shrink-0 rounded-full object-cover"
          fallback={first.username[0]?.toUpperCase() ?? "?"}
        />
        <div className="min-w-0">
          <p className="truncate text-xs font-black leading-tight">{label}</p>
          <p className="text-[10px] text-muted-foreground">{t("incomingCall")}</p>
        </div>
        <button
          onClick={onDecline}
          aria-label={t("declineCall")}
          className="ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-500 text-white active:scale-95"
        >
          <PhoneOff className="h-4 w-4" />
        </button>
        <button
          onClick={onAccept}
          aria-label={t("answerCall")}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green-500 text-white active:scale-95"
        >
          <Phone className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function CallOverlay({
  state,
  onEnd,
  onToggleMute,
}: {
  state: CallState;
  onEnd: () => void;
  onToggleMute: () => void;
}) {
  const { t } = useI18n();
  const { phase, muted, elapsedSeconds, invitedIds, connectedIds, peersById, isGroup } = state;
  const displayIds = connectedIds.length ? connectedIds : invitedIds;
  const first = peersById[displayIds[0] ?? ""];
  if (!first) return null;
  const mm = Math.floor(elapsedSeconds / 60);
  const ss = String(elapsedSeconds % 60).padStart(2, "0");
  const label =
    isGroup && displayIds.length > 1
      ? t("incomingGroupCall", { name: first.username, count: displayIds.length - 1 })
      : first.username;

  return (
    <div className="fixed inset-0 z-[190] flex flex-col items-center justify-between bg-gradient-to-b from-[#1a0b2e] to-black px-6 py-14 text-white">
      <div className="flex flex-col items-center gap-3 pt-10">
        <span className="text-sm font-semibold uppercase tracking-wide text-white/60">
          {phase === "outgoing"
            ? t("callingLabel")
            : phase === "connecting"
              ? t("connectingCall")
              : `${mm}:${ss}`}
        </span>
        {isGroup ? (
          <div className="flex -space-x-3">
            {displayIds.slice(0, 4).map((id) => {
              const p = peersById[id];
              if (!p) return null;
              return (
                <StoredImage
                  key={id}
                  path={p.avatarUrl}
                  alt={p.username}
                  className="h-16 w-16 rounded-full object-cover ring-4 ring-black"
                  fallback={p.username[0]?.toUpperCase() ?? "?"}
                />
              );
            })}
          </div>
        ) : (
          <StoredImage
            path={first.avatarUrl}
            alt={first.username}
            className="h-28 w-28 rounded-full object-cover ring-4 ring-white/10"
            fallback={first.username[0]?.toUpperCase() ?? "?"}
          />
        )}
        <p className="text-2xl font-black">{label}</p>
      </div>

      <div className="flex items-center gap-8 pb-6">
        <button
          onClick={onToggleMute}
          aria-label="Mute"
          className={cn(
            "grid h-14 w-14 place-items-center rounded-full transition active:scale-95",
            muted ? "bg-white text-black" : "bg-white/15 text-white",
          )}
        >
          {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>
        <button
          onClick={onEnd}
          aria-label={t("callEnded")}
          className="grid h-16 w-16 place-items-center rounded-full bg-red-500 shadow-lg active:scale-95"
        >
          <PhoneOff className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
}
