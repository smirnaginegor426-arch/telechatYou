import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import { trpc } from "@/providers/trpc";

type CallKind = "audio" | "video";
type IcePayload = {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
};

type Props = {
  chatId: number;
  myId: number;
  peerId?: number;
  peerName: string;
  enabled: boolean;
};

function callError(error: unknown): string {
  if (error instanceof Error && error.message) {
    if (/permission|notallowed|denied/i.test(error.name + " " + error.message)) {
      return "Разреши доступ к микрофону и камере в настройках браузера.";
    }
    if (/notfound|devicesnotfound/i.test(error.name + " " + error.message)) {
      return "Не найден микрофон или камера.";
    }
    return error.message;
  }
  return "Не удалось подключить звонок. Попробуй ещё раз.";
}

export function CallWidget({ chatId, myId, peerId, peerName, enabled }: Props) {
  const utils = trpc.useUtils();
  const [activeCallId, setActiveCallId] = useState<number | null>(null);
  const activeCallIdRef = useRef<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localCandidatesRef = useRef<IcePayload[]>([]);
  const pendingRemoteCandidatesRef = useRef<IcePayload[]>([]);
  const appliedAnswerRef = useRef<string | null>(null);
  const [rtcReady, setRtcReady] = useState(false);
  const [lastSignalId, setLastSignalId] = useState(0);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const stateQuery = trpc.calls.state.useQuery(
    { chatId, callId: activeCallId ?? undefined },
    {
      enabled: enabled && chatId > 0 && myId > 0 && !!peerId && peerId !== myId,
      refetchInterval: 1200,
      refetchIntervalInBackground: false,
      retry: false,
    },
  );
  const activeCall = stateQuery.data ?? null;
  const signalsQuery = trpc.calls.signals.useQuery(
    { chatId, callId: activeCallId ?? 0, afterId: lastSignalId },
    {
      enabled: enabled && activeCallId !== null && rtcReady,
      refetchInterval: 900,
      refetchIntervalInBackground: false,
      retry: false,
    },
  );
  const startMutation = trpc.calls.start.useMutation();
  const acceptMutation = trpc.calls.accept.useMutation();
  const addIceMutation = trpc.calls.addIce.useMutation();
  const endMutation = trpc.calls.end.useMutation();

  const setCallId = useCallback((id: number | null) => {
    activeCallIdRef.current = id;
    setActiveCallId(id);
  }, []);

  const cleanupMedia = useCallback(() => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    localCandidatesRef.current = [];
    pendingRemoteCandidatesRef.current = [];
    appliedAnswerRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setRtcReady(false);
    setConnectionState("closed");
  }, []);

  const sendBufferedCandidates = useCallback(async (callId: number) => {
    const queued = localCandidatesRef.current.splice(0);
    for (const candidate of queued) {
      try {
        await addIceMutation.mutateAsync({ chatId, callId, candidate });
      } catch (e) {
        setError(callError(e));
      }
    }
  }, [addIceMutation, chatId]);

  const flushRemoteCandidates = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc?.remoteDescription) return;
    const queued = pendingRemoteCandidatesRef.current.splice(0);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // A duplicate or late ICE candidate is harmless; later candidates still apply.
      }
    }
  }, []);

  const createPeerConnection = useCallback((stream: MediaStream) => {
    const pc = new RTCPeerConnection({
      // STUN works for many networks. A TURN relay is still needed for some
      // strict NAT, carrier and corporate networks.
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
      ],
    });
    peerConnectionRef.current = pc;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      const candidate = event.candidate.toJSON() as IcePayload;
      const callId = activeCallIdRef.current;
      if (!callId) {
        localCandidatesRef.current.push(candidate);
        return;
      }
      void addIceMutation.mutateAsync({ chatId, callId, candidate }).catch((e) => setError(callError(e)));
    };
    pc.ontrack = (event) => {
      const incoming = event.streams[0] ?? new MediaStream([event.track]);
      setRemoteStream(incoming);
    };
    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      if (pc.connectionState === "failed") {
        setError("Не удалось установить соединение. В некоторых сетях для звонков нужен TURN-сервер.");
      }
    };
    setConnectionState(pc.connectionState);
    setRtcReady(true);
    return pc;
  }, [addIceMutation, chatId]);

  useEffect(() => {
    if (activeCall && activeCallId === null) {
      setCallId(activeCall.id);
    }
    if (activeCall?.status === "ringing") {
      setVisible(true);
    }
    if (activeCall && ["ended", "rejected", "missed"].includes(activeCall.status)) {
      setVisible(true);
      cleanupMedia();
      setBusy(false);
    }
  }, [activeCall, activeCallId, cleanupMedia, setCallId]);

  useEffect(() => {
    setLastSignalId(0);
    pendingRemoteCandidatesRef.current = [];
  }, [activeCallId]);

  useEffect(() => {
    const pc = peerConnectionRef.current;
    const session = activeCall;
    if (
      !pc ||
      !session ||
      session.callerId !== myId ||
      session.status !== "accepted" ||
      !session.answerSdp ||
      appliedAnswerRef.current === session.answerSdp
    ) return;

    appliedAnswerRef.current = session.answerSdp;
    void pc.setRemoteDescription({ type: "answer", sdp: session.answerSdp })
      .then(flushRemoteCandidates)
      .catch((e) => setError(callError(e)));
  }, [activeCall, flushRemoteCandidates, myId]);

  useEffect(() => {
    if (!rtcReady || !signalsQuery.data?.length) return;
    const pc = peerConnectionRef.current;
    if (!pc) return;
    let highest = lastSignalId;
    for (const signal of signalsQuery.data) {
      if (signal.id <= highest) continue;
      highest = signal.id;
      const candidate = signal.candidate as IcePayload;
      if (pc.remoteDescription) {
        void pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {
          // Ignore stale candidates after a reconnect or a rejected call.
        });
      } else {
        pendingRemoteCandidatesRef.current.push(candidate);
      }
    }
    if (highest > lastSignalId) setLastSignalId(highest);
  }, [signalsQuery.data, rtcReady, lastSignalId]);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream, visible]);
  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
  }, [remoteStream, visible, activeCall?.callType]);

  useEffect(() => {
    localStream?.getAudioTracks().forEach((track) => { track.enabled = micEnabled; });
  }, [localStream, micEnabled]);
  useEffect(() => {
    localStream?.getVideoTracks().forEach((track) => { track.enabled = cameraEnabled; });
  }, [localStream, cameraEnabled]);

  const startCall = async (kind: CallKind) => {
    if (busy || !enabled) return;
    setVisible(true);
    setBusy(true);
    setError("");
    setMicEnabled(true);
    setCameraEnabled(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Звонки доступны в защищённом контексте HTTPS или в приложении TeleChat You.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: kind === "video" ? { facingMode: "user" } : false,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      const pc = createPeerConnection(stream);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (!offer.sdp) throw new Error("Браузер не создал описание звонка.");
      const result = await startMutation.mutateAsync({ chatId, callType: kind, offerSdp: offer.sdp });
      setCallId(result.callId);
      await sendBufferedCandidates(result.callId);
      setBusy(false);
    } catch (e) {
      cleanupMedia();
      setCallId(null);
      setBusy(false);
      setVisible(false);
      setError(callError(e));
    }
  };

  const acceptCall = async () => {
    const session = activeCall;
    if (!session || session.calleeId !== myId || !session.offerSdp || busy) return;
    setBusy(true);
    setError("");
    setCallId(session.id);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Звонки доступны в защищённом контексте HTTPS или в приложении TeleChat You.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: session.callType === "video" ? { facingMode: "user" } : false,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      const pc = createPeerConnection(stream);
      await pc.setRemoteDescription({ type: "offer", sdp: session.offerSdp });
      await flushRemoteCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (!answer.sdp) throw new Error("Браузер не создал ответ на звонок.");
      await acceptMutation.mutateAsync({ chatId, callId: session.id, answerSdp: answer.sdp });
      await sendBufferedCandidates(session.id);
      setBusy(false);
    } catch (e) {
      setBusy(false);
      setError(callError(e));
      cleanupMedia();
    }
  };

  const endCall = async (action: "reject" | "end" = "end") => {
    const callId = activeCallIdRef.current ?? activeCall?.id;
    if (callId) {
      try {
        await endMutation.mutateAsync({ chatId, callId, action });
      } catch (e) {
        setError(callError(e));
      }
    }
    cleanupMedia();
    setBusy(false);
    if (action === "end" || action === "reject") {
      setVisible(true);
      void utils.calls.state.invalidate({ chatId, callId });
      void utils.calls.incoming.invalidate();
    }
  };

  const closePanel = () => {
    cleanupMedia();
    setCallId(null);
    setVisible(false);
    setBusy(false);
    setError("");
    setMicEnabled(true);
    setCameraEnabled(true);
  };

  if (!enabled || !peerId || peerId === myId) return null;

  const incoming = !!activeCall && activeCall.calleeId === myId && activeCall.status === "ringing";
  const terminal = !!activeCall && ["ended", "rejected", "missed"].includes(activeCall.status);
  const callKind = activeCall?.callType ?? "audio";
  const connected = connectionState === "connected";
  const headline = terminal
    ? activeCall?.status === "missed" ? "Нет ответа" : activeCall?.status === "rejected" ? "Звонок отклонён" : "Звонок завершён"
    : incoming
      ? callKind === "video" ? "Входящий видеозвонок" : "Входящий аудиозвонок"
      : activeCall?.status === "accepted"
        ? connected ? "На связи" : "Соединяем…"
        : busy ? "Подключаем…" : callKind === "video" ? "Видеозвонок" : "Аудиозвонок";

  return (
    <>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          title="Аудиозвонок"
          aria-label="Начать аудиозвонок"
          onClick={() => void startCall("audio")}
          disabled={busy || !!activeCall}
          className="tcy-press tcy-glass-surface flex h-9 w-9 shrink-0 items-center justify-center rounded-full tcy-dim disabled:opacity-40"
        >
          <Phone size={17} />
        </button>
        <button
          type="button"
          title="Видеозвонок"
          aria-label="Начать видеозвонок"
          onClick={() => void startCall("video")}
          disabled={busy || !!activeCall}
          className="tcy-press tcy-glass-surface flex h-9 w-9 shrink-0 items-center justify-center rounded-full tcy-dim disabled:opacity-40"
        >
          <Video size={17} />
        </button>
      </div>

      {visible && (
        <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/60 p-3 sm:p-5">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Звонок TeleChat You"
            className="relative w-full max-w-[420px] overflow-hidden rounded-[28px] border tcy-line tcy-card shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b tcy-line px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-extrabold tcy-text">{peerName}</div>
                <div className="mt-0.5 text-[12px] tcy-dim">{headline}</div>
              </div>
              {!incoming && (
                <button type="button" onClick={closePanel} title="Свернуть звонок" aria-label="Свернуть окно звонка" className="flex h-9 w-9 items-center justify-center rounded-full tcy-glass-surface tcy-dim">
                  <X size={17} />
                </button>
              )}
            </div>

            {callKind === "video" && !terminal && (
              <div className="relative aspect-[4/3] max-h-[46vh] overflow-hidden bg-black/80">
                <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
                <video ref={localVideoRef} autoPlay muted playsInline className="absolute bottom-3 right-3 h-[92px] w-[72px] rounded-[14px] border border-white/30 bg-black/40 object-cover shadow-lg sm:h-[120px] sm:w-[92px]" />
                {!remoteStream && <div className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold text-white/70">Ожидаем видео…</div>}
              </div>
            )}
            {callKind === "audio" && <audio ref={remoteAudioRef} autoPlay />}
            <div className="px-5 py-5">
              {terminal ? (
                <div className="py-3 text-center">
                  <div className="text-[14px] font-semibold tcy-text">{headline}</div>
                  <button type="button" onClick={closePanel} className="mt-5 rounded-full px-6 py-2.5 text-[13px] font-extrabold tcy-text tcy-glass-surface">Закрыть</button>
                </div>
              ) : incoming ? (
                <div className="flex items-center justify-center gap-5 py-2">
                  <button type="button" disabled={busy} onClick={() => void endCall("reject")} className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e5484d] text-white disabled:opacity-50" aria-label="Отклонить звонок" title="Отклонить">
                    <PhoneOff size={22} />
                  </button>
                  <button type="button" disabled={busy} onClick={() => void acceptCall()} className="flex h-14 w-14 items-center justify-center rounded-full text-white disabled:opacity-50" style={{ background: "var(--tcy-accent)" }} aria-label="Принять звонок" title="Принять">
                    {callKind === "video" ? <Video size={22} /> : <Phone size={22} />}
                  </button>
                </div>
              ) : (
                <>
                  <div className="text-center text-[12px] tcy-dim">
                    {error || (activeCall?.status === "accepted"
                      ? connected ? "Соединение установлено" : "Подключаем медиапоток…"
                      : "Вызов отправлен. Ожидаем ответа…")}
                  </div>
                  {callKind === "video" && localStream && (
                    <div className="mt-3 text-center text-[11px] tcy-faint">Предпросмотр камеры доступен только тебе</div>
                  )}
                  <div className="mt-5 flex items-center justify-center gap-3">
                    <button type="button" disabled={!localStream} onClick={() => setMicEnabled((value) => !value)} title={micEnabled ? "Выключить микрофон" : "Включить микрофон"} aria-label={micEnabled ? "Выключить микрофон" : "Включить микрофон"} className="flex h-11 w-11 items-center justify-center rounded-full tcy-glass-surface tcy-text disabled:opacity-40">
                      {micEnabled ? <Mic size={19} /> : <MicOff size={19} />}
                    </button>
                    {callKind === "video" && (
                      <button type="button" disabled={!localStream} onClick={() => setCameraEnabled((value) => !value)} title={cameraEnabled ? "Выключить камеру" : "Включить камеру"} aria-label={cameraEnabled ? "Выключить камеру" : "Включить камеру"} className="flex h-11 w-11 items-center justify-center rounded-full tcy-glass-surface tcy-text disabled:opacity-40">
                        {cameraEnabled ? <Video size={19} /> : <VideoOff size={19} />}
                      </button>
                    )}
                    <button type="button" disabled={busy} onClick={() => void endCall("end")} title="Завершить звонок" aria-label="Завершить звонок" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e5484d] text-white disabled:opacity-50">
                      <PhoneOff size={20} />
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
