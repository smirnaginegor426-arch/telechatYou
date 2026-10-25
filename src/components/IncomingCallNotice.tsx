import { Phone, Video } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";

/**
 * Poll the authenticated user's incoming-call inbox even while they are on the
 * contacts, profile, or chat-list screens. Opening the notice navigates to the
 * chat, where CallWidget provides the actual answer/reject controls.
 */
export function IncomingCallNotice() {
  const location = useLocation();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const incoming = trpc.calls.incoming.useQuery(undefined, {
    refetchInterval: 1500,
    refetchIntervalInBackground: false,
    retry: false,
  });
  const call = incoming.data;
  if (!call || location.pathname === `/chat/${call.chatId}`) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-[10040] mx-auto max-w-[420px]">
      <div className="flex items-center gap-3 rounded-[22px] border tcy-line tcy-card p-3 shadow-2xl">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--tcy-selected-accent) 18%, var(--tcy-card))", color: "var(--tcy-selected-accent)" }}>
          {call.callType === "video" ? <Video size={21} /> : <Phone size={21} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-extrabold tcy-text">{call.callerName}</div>
          <div className="mt-0.5 text-[12px] tcy-dim">{call.callType === "video" ? "Входящий видеозвонок" : "Входящий аудиозвонок"}</div>
        </div>
        <button
          type="button"
          onClick={() => {
            navigate(`/chat/${call.chatId}`);
            void utils.calls.incoming.invalidate();
          }}
          className="shrink-0 rounded-full px-4 py-2.5 text-[12px] font-extrabold text-white"
          style={{ background: "var(--tcy-accent)" }}
        >
          Ответить
        </button>
      </div>
    </div>
  );
}
