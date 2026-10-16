import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { motion } from "framer-motion";
import { ArrowLeft, AtSign, MessageCircle, Quote, Radio, Users } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Avatar } from "@/components/Avatar";
import { TesterBadge } from "@/components/TesterBadge";
import { isTesterUsername } from "@/lib/testers";
import { Lightbox } from "@/components/Lightbox";
import { TcButton } from "@/components/TcButton";
import { formatLastSeen, isOnline } from "@/lib/format";
import { profileShareUrl } from "@/lib/share-links";
import { toast } from "sonner";

/** Public profile of another user */
export default function UserView() {
  const { id, username } = useParams<{ id: string; username: string }>();
  const parsedUserId = Number(id);
  const navigate = useNavigate();
  const location = useLocation();
  const autoOpen = new URLSearchParams(location.search).get("open") === "1";
  const autoOpenKeyRef = useRef<string | null>(null);
  const utils = trpc.useUtils();
  const profileById = trpc.profile.byId.useQuery(
    { userId: parsedUserId },
    { enabled: !!id && Number.isFinite(parsedUserId), retry: false },
  );
  const profileByUsername = trpc.profile.byUsername.useQuery(
    { username: username ?? "" },
    { enabled: !!username, retry: false },
  );
  const channelByUsername = trpc.channels.byUsername.useQuery(
    { username: username ?? "" },
    { enabled: !!username, retry: false },
  );
  const joinPublicChannel = trpc.channels.joinPublic.useMutation({
    onSuccess: async (result) => {
      await utils.chats.list.invalidate();
      navigate(`/chat/${result.chatId}`, { replace: true });
    },
    onError: (error) => toast.error(error.message),
  });
  const profile = username ? profileByUsername : profileById;
  const loading = username
    ? profileByUsername.isLoading || channelByUsername.isLoading
    : profileById.isLoading;
  const userId = profile.data?.userId ?? parsedUserId;
  const contactNamesQuery = trpc.accountData.contactNames.get.useQuery();
  const createDirect = trpc.chats.createDirect.useMutation({
    onSuccess: async (r) => {
      await utils.chats.list.invalidate();
      navigate(`/chat/${r.chatId}`, { replace: true });
    },
    onError: (error) => {
      toast.error(error.message);
      navigate(`/@${username ?? ""}`, { replace: true });
    },
  });

  const p = profile.data;
  const channel = !p && username ? channelByUsername.data : undefined;
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const displayName = p ? contactNamesQuery.data?.names[String(p.userId)] ?? p.displayName : "";

  // Mention links navigate here immediately, then this page resolves the name
  // into a direct chat or a public channel/group and opens it automatically.
  useEffect(() => {
    if (!autoOpen || !username || loading) return;
    const key = username.toLowerCase();
    if (autoOpenKeyRef.current === key) return;

    if (p) {
      autoOpenKeyRef.current = key;
      createDirect.mutate({ userId: p.userId });
      return;
    }

    if (channel) {
      autoOpenKeyRef.current = key;
      joinPublicChannel.mutate({ username: channel.username });
      return;
    }

    // The profile and public-channel lookups both finished without a match.
    autoOpenKeyRef.current = key;
    navigate(`/@${username}`, { replace: true });
  }, [autoOpen, username, loading, p?.userId, channel?.username, createDirect, joinPublicChannel, navigate]);

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
      {loading ? (
        <div className="flex flex-col items-center pt-14 gap-4">
          <div className="tcy-skeleton w-32 h-32" style={{ borderRadius: "32%" }} />
          <div className="tcy-skeleton h-5 w-40 rounded-full" />
        </div>
      ) : !p && channel ? (
        <div className="flex flex-col items-center pt-8 px-8 pb-12">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="mt-5"
          >
            <Avatar name={channel.title} avatarKey={channel.avatarKey} size={132} />
          </motion.div>
          <div className="mt-5 flex items-center justify-center gap-2">
            <h1 className="text-[22px] font-extrabold tcy-text text-center">{channel.title}</h1>
            {channel.kind === "group" ? <Users size={19} className="shrink-0" style={{ color: "#2787f5" }} /> : <Radio size={19} className="shrink-0" style={{ color: "#2787f5" }} />}
          </div>
          <p className="mt-1 text-[12.5px] font-semibold" style={{ color: "#2787f5" }}>
            {channel.kind === "group" ? `Публичная группа · ${channel.membersCount} участников` : `Публичный канал · ${channel.membersCount} подписчиков`}
          </p>
          <a
            href={profileShareUrl(channel.username)}
            onClick={(event) => {
              event.preventDefault();
              navigate(`/@${channel.username}`);
            }}
            className="mt-2 max-w-full break-all text-center text-[12px] underline underline-offset-2"
            style={{ color: "#2787f5" }}
          >
            {profileShareUrl(channel.username)}
          </a>
          {channel.description && (
            <p className="mt-4 text-center text-[13.5px] tcy-dim leading-relaxed max-w-[300px] whitespace-pre-wrap">
              {channel.description}
            </p>
          )}
          <TcButton
            size="lg"
            className="mt-7 max-w-[300px]"
            loading={joinPublicChannel.isPending}
            onClick={() => joinPublicChannel.mutate({ username: channel.username })}
          >
            {channel.kind === "group" ? <Users size={18} /> : <Radio size={18} />}
            {channel.kind === "group" ? "Вступить в группу" : "Подписаться и открыть канал"}
          </TcButton>
        </div>
      ) : !p ? (
        <p className="text-center tcy-dim pt-20">Пользователь или публичный канал не найден</p>
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
                name={displayName}
                avatarKey={p.avatarKey}
                size={132}
                lastSeenAt={p.lastSeenAt}
                showOnline
              />
            </button>
          </motion.div>
          <div className="mt-5 flex items-center justify-center gap-2">
            <h1 className="text-[22px] font-extrabold tcy-text">{displayName}</h1>
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
          name={displayName}
          fallbackName={!p.avatarKey ? displayName : null}
          onClose={() => setAvatarPreviewOpen(false)}
        />
      )}
    </div>
  );
}
