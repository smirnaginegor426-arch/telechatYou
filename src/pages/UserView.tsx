import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { motion } from "framer-motion";
import { ArrowLeft, AtSign, MessageCircle, Quote } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Avatar } from "@/components/Avatar";
import { TesterBadge } from "@/components/TesterBadge";
import { isTesterUsername } from "@/lib/testers";
import { Lightbox } from "@/components/Lightbox";
import { TcButton } from "@/components/TcButton";
import { formatLastSeen, isOnline } from "@/lib/format";

/** Public profile of another user */
export default function UserView() {
  const { id } = useParams<{ id: string }>();
  const userId = Number(id);
  const navigate = useNavigate();
  const profile = trpc.profile.byId.useQuery({ userId });
  const createDirect = trpc.chats.createDirect.useMutation({
    onSuccess: (r) => navigate(`/chat/${r.chatId}`, { replace: true }),
  });

  const p = profile.data;
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);

  return (
    <div className="relative h-full overflow-y-auto no-scrollbar">
      <header className="relative z-10 px-4 pt-4 safe-top">
        <button
          onClick={() => navigate(-1)}
          className="tcy-press w-10 h-10 rounded-full tcy-card border tcy-line flex items-center justify-center tcy-dim"
        >
          <ArrowLeft size={19} />
        </button>
      </header>
      {profile.isLoading ? (
        <div className="flex flex-col items-center pt-14 gap-4">
          <div className="tcy-skeleton w-32 h-32" style={{ borderRadius: "32%" }} />
          <div className="tcy-skeleton h-5 w-40 rounded-full" />
        </div>
      ) : !p ? (
        <p className="text-center tcy-dim pt-20">Пользователь не найден</p>
      ) : (
        <div className="flex flex-col items-center pt-8 px-8">
          <div
            className="absolute inset-x-0 top-0 h-64 pointer-events-none"
            style={{ background: "radial-gradient(120% 100% at 50% 0%, var(--tcy-glow-1), transparent 70%)" }}
          />
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="mt-5"
          >
            <button
              type="button"
              onClick={() => setAvatarPreviewOpen(true)}
              aria-label="Открыть аватарку пользователя"
              title="Открыть аватарку"
              className="tcy-press block cursor-zoom-in rounded-[30%] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--tcy-accent)]"
            >
              <Avatar
                name={p.displayName}
                avatarKey={p.avatarKey}
                size={132}
                lastSeenAt={p.lastSeenAt}
                showOnline
              />
            </button>
          </motion.div>
          <div className="mt-5 flex items-center justify-center gap-2">
            <h1 className="text-[22px] font-extrabold tcy-text">{p.displayName}</h1>
            {isTesterUsername(p.username, userId) && <TesterBadge />}
          </div>
          <div className="mt-1 text-[13.5px] font-semibold tcy-accent">@{p.username}</div>
          <div
            className="mt-1.5 text-[12.5px] font-semibold"
            style={{ color: isOnline(p.lastSeenAt) ? "var(--tcy-accent)" : "var(--tcy-faint)" }}
          >
            {formatLastSeen(p.lastSeenAt)}
          </div>
          {p.bio && (
            <p className="mt-4 text-center text-[13.5px] tcy-dim leading-relaxed max-w-[280px]">{p.bio}</p>
          )}
          <TcButton
            size="lg"
            className="mt-7 max-w-[300px]"
            loading={createDirect.isPending}
            onClick={() => createDirect.mutate({ userId })}
          >
            <MessageCircle size={18} /> Написать сообщение
          </TcButton>
          <div className="w-full mt-8 rounded-[24px] tcy-card border tcy-line divide-y divide-[color:var(--tcy-line)] max-w-[340px]">
            <div className="flex items-center gap-3.5 px-4 py-3.5">
              <AtSign size={17} className="tcy-accent" />
              <div>
                <div className="text-[14px] font-semibold tcy-text">@{p.username}</div>
                <div className="text-[11.5px] tcy-faint">Имя пользователя</div>
              </div>
            </div>
            <div className="flex items-center gap-3.5 px-4 py-3.5">
              <Quote size={17} className="tcy-accent" />
              <div>
                <div className="text-[14px] font-semibold tcy-text">{p.bio || "—"}</div>
                <div className="text-[11.5px] tcy-faint">О себе</div>
              </div>
            </div>
          </div>
        </div>
      )}
      {avatarPreviewOpen && p && (
        <Lightbox
          imageKey={p.avatarKey ?? null}
          name={p.displayName}
          fallbackName={!p.avatarKey ? p.displayName : null}
          onClose={() => setAvatarPreviewOpen(false)}
        />
      )}
    </div>
  );
}
