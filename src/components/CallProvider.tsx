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
import { supabase } from "@/integrations/supabase/client";
import { StoredImage } from "@/components/Media";
import { useSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { notifyNewMessage } from "@/lib/messages.functions";

// Public STUN only - no TURN server is configured (that requires a paid
// relay service). Calls connect directly between the two devices, which
// works on most home networks but can fail behind strict corporate
// firewalls or symmetric NATs. That's a known, disclosed limitation.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const RING_TIMEOUT_MS = 45_000;

export type CallPeer = { id: string; username: string; avatarUrl: string | null };
type CallPhase = "idle" | "outgoing" | "incoming" | "connecting" | "active";

type CallState = {
  phase: CallPhase;
  peer: CallPeer | null;
  muted: boolean;
  elapsedSeconds: number;
};

type CallContextValue = {
  state: CallState;
  startCall: (conversationId: string, peer: CallPeer) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
};

const IDLE_STATE: CallState = { phase: "idle", peer: null, muted: false, elapsedSeconds: 0 };

const CallContext = createContext<CallContextValue | null>(null);

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within CallProvider");
  return ctx;
}

function playRingtone() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    let stopped = false;
    function beep() {
      if (stopped) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
    beep();
    const interval = setInterval(beep, 1500);
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

  const callChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRingtoneRef = useRef<(() => void) | null>(null);
  const isCallerRef = useRef(false);
  const answeredAtRef = useRef<number | null>(null);
  const callIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);

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

  function reset() {
    stopRing();
    if (timerRef.current) clearInterval(timerRef.current);
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    timerRef.current = null;
    ringTimeoutRef.current = null;
    connectTimeoutRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    localStreamRef.current = null;
    pendingCandidatesRef.current = [];
    if (callChannelRef.current) {
      void supabase.removeChannel(callChannelRef.current);
      callChannelRef.current = null;
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

  function attachTrackHandler(pc: RTCPeerConnection) {
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteAudioRef.current && remoteStream) {
        remoteAudioRef.current.srcObject = remoteStream;
        void remoteAudioRef.current.play().catch(() => {});
      }
    };
  }

  async function drainPendingCandidates(pc: RTCPeerConnection) {
    for (const candidate of pendingCandidatesRef.current) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // Stale/duplicate candidate - safe to ignore.
      }
    }
    pendingCandidatesRef.current = [];
  }

  async function handleRemoteIce(candidate: RTCIceCandidateInit | undefined) {
    if (!candidate) return;
    const pc = pcRef.current;
    if (pc?.remoteDescription) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // Ignore - connection may already be closing.
      }
    } else {
      pendingCandidatesRef.current.push(candidate);
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
      if (stateRef.current.phase === "connecting") {
        toast.error(t("callConnectFailed"));
        void callChannelRef.current?.send({ type: "broadcast", event: "end" });
        void finalizeCall("ended");
      }
    }, 20_000);
  }

  function onConnectionStateChange(pc: RTCPeerConnection) {
    if (pc.connectionState === "connected" && !answeredAtRef.current) {
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
      answeredAtRef.current = Date.now();
      startTimer();
      setState((s) => ({ ...s, phase: "active" }));
    }
  }

  async function beginOffer() {
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    stopRing();
    setState((s) => ({ ...s, phase: "connecting" }));
    armConnectTimeout();
    const stream = localStreamRef.current ?? (await getLocalStream());
    if (!stream) {
      void finalizeCall("ended");
      return;
    }
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    stream.getTracks().forEach((tr) => pc.addTrack(tr, stream));
    attachTrackHandler(pc);
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        void callChannelRef.current?.send({
          type: "broadcast",
          event: "ice",
          payload: { candidate: e.candidate.toJSON() },
        });
      }
    };
    pc.onconnectionstatechange = () => onConnectionStateChange(pc);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    void callChannelRef.current?.send({ type: "broadcast", event: "offer", payload: { sdp: offer } });
  }

  async function handleOffer(sdp: RTCSessionDescriptionInit) {
    armConnectTimeout();
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    const stream = localStreamRef.current;
    if (!stream) {
      declineCall();
      return;
    }
    stream.getTracks().forEach((tr) => pc.addTrack(tr, stream));
    attachTrackHandler(pc);
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        void callChannelRef.current?.send({
          type: "broadcast",
          event: "ice",
          payload: { candidate: e.candidate.toJSON() },
        });
      }
    };
    pc.onconnectionstatechange = () => onConnectionStateChange(pc);
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await drainPendingCandidates(pc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    void callChannelRef.current?.send({ type: "broadcast", event: "answer", payload: { sdp: answer } });
  }

  async function handleAnswer(sdp: RTCSessionDescriptionInit) {
    const pc = pcRef.current;
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await drainPendingCandidates(pc);
  }

  function subscribeCallChannel(callId: string, role: "caller" | "callee") {
    const channel = supabase.channel(`call:${callId}`, { config: { broadcast: { self: false } } });
    channel
      .on("broadcast", { event: "accept" }, () => {
        if (role === "caller") void beginOffer();
      })
      .on("broadcast", { event: "decline" }, () => {
        if (role === "caller") void finalizeCall("declined");
      })
      .on("broadcast", { event: "offer" }, ({ payload }) => {
        if (role === "callee") void handleOffer(payload.sdp);
      })
      .on("broadcast", { event: "answer" }, ({ payload }) => {
        if (role === "caller") void handleAnswer(payload.sdp);
      })
      .on("broadcast", { event: "ice" }, ({ payload }) => {
        void handleRemoteIce(payload.candidate);
      })
      .on("broadcast", { event: "end" }, () => {
        if (stateRef.current.phase === "idle") return;
        toast.message(t("callEnded"));
        // Whichever side hangs up, the caller is the one that logs the call
        // (duration + system message) - the callee just tears down locally.
        if (role === "caller") void finalizeCall("ended");
        else reset();
      })
      .subscribe();
    callChannelRef.current = channel;
  }

  async function startCall(conversationId: string, peer: CallPeer) {
    if (!user) return;
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
    const { data: me } = await supabase
      .from("profiles")
      .select("username,avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    await supabase.from("calls").insert({
      id: callId,
      conversation_id: conversationId,
      caller_id: user.id,
      callee_id: peer.id,
      status: "ringing",
    });
    subscribeCallChannel(callId, "caller");
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
        callerId: user.id,
        callerName: me?.username ?? "?",
        callerAvatar: me?.avatar_url ?? null,
      },
    });
    void supabase.removeChannel(inbox);
    setState({ phase: "outgoing", peer, muted: false, elapsedSeconds: 0 });
    ring();
    ringTimeoutRef.current = setTimeout(() => void finalizeCall("missed"), RING_TIMEOUT_MS);
  }

  async function acceptCall() {
    if (!callIdRef.current) return;
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    stopRing();
    setState((s) => ({ ...s, phase: "connecting" }));
    armConnectTimeout();
    const stream = await getLocalStream();
    if (!stream) {
      declineCall();
      return;
    }
    void callChannelRef.current?.send({ type: "broadcast", event: "accept" });
    await supabase
      .from("calls")
      .update({ status: "accepted", answered_at: new Date().toISOString() })
      .eq("id", callIdRef.current);
  }

  function declineCall() {
    void callChannelRef.current?.send({ type: "broadcast", event: "decline" });
    reset();
  }

  function endCall() {
    void callChannelRef.current?.send({ type: "broadcast", event: "end" });
    if (isCallerRef.current) {
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
        const peer: CallPeer = {
          id: payload.callerId,
          username: payload.callerName,
          avatarUrl: payload.callerAvatar,
        };
        subscribeCallChannel(payload.callId, "callee");
        setState({ phase: "incoming", peer, muted: false, elapsedSeconds: 0 });
        ring();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => reset, []);

  return (
    <CallContext.Provider value={{ state, startCall, acceptCall, declineCall, endCall, toggleMute }}>
      {children}
      <audio ref={remoteAudioRef} autoPlay className="hidden" />
      {state.phase !== "idle" ? (
        <CallOverlay
          state={state}
          onAccept={() => void acceptCall()}
          onDecline={declineCall}
          onEnd={endCall}
          onToggleMute={toggleMute}
        />
      ) : null}
    </CallContext.Provider>
  );
}

function CallOverlay({
  state,
  onAccept,
  onDecline,
  onEnd,
  onToggleMute,
}: {
  state: CallState;
  onAccept: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
}) {
  const { t } = useI18n();
  const { peer, phase, muted, elapsedSeconds } = state;
  if (!peer) return null;
  const mm = Math.floor(elapsedSeconds / 60);
  const ss = String(elapsedSeconds % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-between bg-gradient-to-b from-[#1a0b2e] to-black px-6 py-14 text-white">
      <div className="flex flex-col items-center gap-3 pt-10">
        <span className="text-sm font-semibold uppercase tracking-wide text-white/60">
          {phase === "incoming"
            ? t("incomingCall")
            : phase === "outgoing"
              ? t("callingLabel")
              : phase === "connecting"
                ? t("connectingCall")
                : `${mm}:${ss}`}
        </span>
        <StoredImage
          path={peer.avatarUrl}
          alt={peer.username}
          className="h-28 w-28 rounded-full object-cover ring-4 ring-white/10"
          fallback={peer.username[0]?.toUpperCase() ?? "?"}
        />
        <p className="text-2xl font-black">{peer.username}</p>
      </div>

      <div className="flex items-center gap-8 pb-6">
        {phase === "incoming" ? (
          <>
            <button
              onClick={onDecline}
              aria-label={t("declineRequest")}
              className="grid h-16 w-16 place-items-center rounded-full bg-red-500 shadow-lg active:scale-95"
            >
              <PhoneOff className="h-7 w-7" />
            </button>
            <button
              onClick={onAccept}
              aria-label={t("acceptRequest")}
              className="grid h-16 w-16 place-items-center rounded-full bg-green-500 shadow-lg active:scale-95"
            >
              <Phone className="h-7 w-7" />
            </button>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
