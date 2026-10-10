import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { motion } from "framer-motion";
import {
  Archive,
  ArrowLeft,
  BellOff,
  Camera,
  Check,
  Crown,
  FileText,
  Image as ImageIcon,
  LogOut,
  Mic,
  Pin,
  Shield,
  Trash2,
  UserPlus,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Avatar } from "@/components/Avatar";
import { BottomSheet } from "@/components/BottomSheet";
import { TcButton } from "@/components/TcButton";
import { TcInput } from "@/components/TcInput";
import { useFileUrl } from "@/hooks/useFileUrl";
import { fileToBase64, formatFileSize, isOnline } from "@/lib/format";

export default function ChatInfo() {
  const { id } = useParams<{ id: string }>();
  const chatId = Number(id);
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const info = trpc.chats.info.useQuery({ chatId });
  const me = trpc.profile.me.useQuery();
  const myId = me.data?.profile?.userId;

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [title, setTitle] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const directory = trpc.profile.directory.useQuery(undefined, { enabled: addOpen });

  const invalidate = () => {
    utils.chats.info.invalidate({ chatId });
    utils.chats.list.invalidate();
  };
  const flags = trpc.chats.setFlags.useMutation({ onSuccess: invalidate });
  const remove = trpc.chats.remove.useMutation({
    onSuccess: () => {
      invalidate();
      navigate("/", { replace: true });
    },
  });
  const updateGroup = trpc.chats.updateGroup.useMutation({
    onSuccess: () => {
      invalidate();
      setEditOpen(false);
    },
  });
  const addMembers = trpc.chats.addMembers.useMutation({
    onSuccess: () => {
      invalidate();
      setAddOpen(false);
    },
  });
  const upload = trpc.storage.upload.useMutation();

  const data = info.data;
  const chat = data?.chat;
  const isGroup = chat?.type === "group";
  const peer = data?.peer;
  const name = isGroup ? chat?.title ?? "Группа" : peer?.displayName ?? "…";
  const myRole = data?.me.role;
  const canEdit = isGroup && (myRole === "owner" || myRole === "admin");

  // shared media/files: load recent messages and pick attachments
  const recentMedia = trpc.messages.list.useQuery({ chatId });
  const media = useMemo(
    () => (recentMedia.data?.items ?? []).filter((m) => !m.deletedAt && m.kind === "image"),
    [recentMedia.data],
  );
  const docs = useMemo(
    () =>
      (recentMedia.data?.items ?? []).filter(
        (m) => !m.deletedAt && (m.kind === "file" || m.kind === "voice"),
      ),
    [recentMedia.data],
  );

  const memberIds = new Set((data?.members ?? []).map((m) => m.userId));
  const addable = (directory.data ?? []).filter((p) => !memberIds.has(p.userId));

  const changeGroupAvatar = async (f: File) => {
    const res = await upload.mutateAsync({
      name: f.name,
      contentBase64: await fileToBase64(f),
      contentType: f.type,
      folder: "avatars",
    });
    updateGroup.mutate({ chatId, avatarKey: res.key });
  };

  if (info.isLoading || !data) {
    return (
      <div className="h-full flex flex-col items-center pt-20 gap-4">
        <div className="tcy-skeleton w-28 h-28 rounded-[30%]" />
        <div className="tcy-skeleton h-5 w-40 rounded-full" />
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-y-auto no-scrollbar pb-10">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void changeGroupAvatar(f);
        }}
      />
      <header className="relative z-10 px-4 pt-4 safe-top flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="tcy-press w-10 h-10 rounded-full tcy-card border tcy-line flex items-center justify-center tcy-dim"
        >
          <ArrowLeft size={19} />
        </button>
        {canEdit && (
          <button
            onClick={() => {
              setTitle(chat?.title ?? "");
              setEditOpen(true);
            }}
            className="tcy-press h-10 px-4 rounded-full tcy-card border tcy-line text-[13px] font-bold tcy-accent"
          >
            Изменить
          </button>
        )}
      </header>

      {/* hero */}
      <div className="flex flex-col items-center pt-4 px-8">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="relative"
        >
          <Avatar
            name={name}
            avatarKey={isGroup ? chat?.avatarKey : peer?.avatarKey}
            size={112}
            lastSeenAt={peer?.lastSeenAt}
            showOnline={!isGroup}
          />
          {canEdit && (
            <button
              onClick={() => fileRef.current?.click()}
              className="tcy-press absolute -bottom-1 -right-1 w-9 h-9 rounded-full tcy-gradient-accent flex items-center justify-center"
              style={{ color: "var(--tcy-on-accent)" }}
            >
              <Camera size={15} />
            </button>
          )}
        </motion.div>
        <h1 className="mt-4 text-[20px] font-extrabold tcy-text text-center">{name}</h1>
        <p className="mt-1 text-[12.5px] tcy-faint font-semibold">
          {isGroup
            ? `${data.members.length} участников`
            : `@${peer?.username} · ${isOnline(peer?.lastSeenAt) ? "в сети" : "не в сети"}`}
        </p>
        {!isGroup && peer?.bio && (
          <p className="mt-2.5 text-center text-[13px] tcy-dim max-w-[280px]">{peer.bio}</p>
        )}
      </div>

      {/* quick actions */}
      <div className="mx-4 mt-6 rounded-[24px] tcy-card border tcy-line divide-y divide-[color:var(--tcy-line)]">
        <button
          onClick={() => flags.mutate({ chatId, pinned: !data.me.pinned })}
          className="w-full flex items-center gap-3.5 px-4 py-3.5 tcy-press"
        >
          <Pin size={17} className="tcy-accent" />
          <span className="text-[14px] font-semibold tcy-text flex-1 text-left">
            {data.me.pinned ? "Открепить чат" : "Закрепить чат"}
          </span>
        </button>
        <button
          onClick={() => flags.mutate({ chatId, muted: !data.me.muted })}
          className="w-full flex items-center gap-3.5 px-4 py-3.5 tcy-press"
        >
          <BellOff size={17} className="tcy-accent" />
          <span className="text-[14px] font-semibold tcy-text flex-1 text-left">
            {data.me.muted ? "Включить уведомления" : "Без звука"}
          </span>
        </button>
        <button
          onClick={() => flags.mutate({ chatId, archived: !data.me.archived })}
          className="w-full flex items-center gap-3.5 px-4 py-3.5 tcy-press"
        >
          <Archive size={17} className="tcy-accent" />
          <span className="text-[14px] font-semibold tcy-text flex-1 text-left">
            {data.me.archived ? "Вернуть из архива" : "В архив"}
          </span>
        </button>
      </div>

      {/* members */}
      {isGroup && (
        <div className="mt-6">
          <div className="px-5 pb-2 flex items-center justify-between">
            <h4 className="text-[12px] font-bold uppercase tracking-[0.08em] tcy-faint">
              Участники
            </h4>
            {canEdit && (
              <button
                onClick={() => setAddOpen(true)}
                className="tcy-press flex items-center gap-1.5 text-[12.5px] font-bold tcy-accent"
              >
                <UserPlus size={14} /> Добавить
              </button>
            )}
          </div>
          <div className="mx-4 rounded-[24px] tcy-card border tcy-line divide-y divide-[color:var(--tcy-line)]">
            {data.members.map((m) => (
              <button
                key={m.id}
                onClick={() => m.userId !== myId && navigate(`/user/${m.userId}`)}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left tcy-press"
              >
                <Avatar
                  name={m.profile?.displayName ?? "?"}
                  avatarKey={m.profile?.avatarKey}
                  size={40}
                  lastSeenAt={m.profile?.lastSeenAt}
                  showOnline
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold tcy-text truncate">
                    {m.profile?.displayName ?? "Участник"}
                    {m.userId === myId && <span className="tcy-faint"> (вы)</span>}
                  </div>
                  <div className="text-[11.5px] tcy-faint">@{m.profile?.username}</div>
                </div>
                {m.role === "owner" && <Crown size={15} style={{ color: "var(--tcy-accent)" }} />}
                {m.role === "admin" && <Shield size={15} className="tcy-dim" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* media */}
      {media.length > 0 && (
        <div className="mt-6">
          <h4 className="px-5 pb-2 text-[12px] font-bold uppercase tracking-[0.08em] tcy-faint">
            Медиа
          </h4>
          <div className="mx-4 grid grid-cols-3 gap-1.5">
            {media.slice(0, 9).map((m) => (
              <MediaThumb key={m.id} attachmentKey={m.attachmentKey} />
            ))}
          </div>
        </div>
      )}

      {/* files */}
      {docs.length > 0 && (
        <div className="mt-6">
          <h4 className="px-5 pb-2 text-[12px] font-bold uppercase tracking-[0.08em] tcy-faint">
            Файлы
          </h4>
          <div className="mx-4 rounded-[24px] tcy-card border tcy-line divide-y divide-[color:var(--tcy-line)]">
            {docs.slice(0, 8).map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                {m.kind === "voice" ? (
                  <Mic size={16} className="tcy-accent shrink-0" />
                ) : (
                  <FileText size={16} className="tcy-accent shrink-0" />
                )}
                <span className="text-[13.5px] font-semibold tcy-text truncate flex-1">
                  {m.kind === "voice" ? "Голосовое сообщение" : m.attachmentName}
                </span>
                <span className="text-[11px] tcy-faint shrink-0">{formatFileSize(m.attachmentSize)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* danger zone */}
      <div className="mx-4 mt-6 rounded-[24px] tcy-card border tcy-line">
        <button
          onClick={() => {
            if (isGroup) {
              if (confirm("Покинуть группу?")) remove.mutate({ chatId, leave: true });
            } else if (confirm("Удалить чат из списка?")) {
              remove.mutate({ chatId, leave: false });
            }
          }}
          className="w-full flex items-center gap-3.5 px-4 py-4 tcy-press"
        >
          {isGroup ? <LogOut size={17} className="tcy-danger" /> : <Trash2 size={17} className="tcy-danger" />}
          <span className="text-[14px] font-semibold tcy-danger">
            {isGroup ? "Покинуть группу" : "Удалить чат"}
          </span>
        </button>
      </div>

      {/* add members */}
      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title="Добавить участников">
        <div className="px-2">
          {addable.length === 0 && (
            <p className="text-center tcy-dim text-[13.5px] py-6">Больше некого добавить</p>
          )}
          {addable.map((p) => (
            <button
              key={p.id}
              disabled={addMembers.isPending}
              onClick={() => addMembers.mutate({ chatId, memberIds: [p.userId] })}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[18px] active:bg-[color:var(--tcy-card)] tcy-press"
            >
              <Avatar name={p.displayName} avatarKey={p.avatarKey} size={42} />
              <span className="text-[14px] font-semibold tcy-text truncate flex-1 text-left">
                {p.displayName}
              </span>
              <UserPlus size={16} className="tcy-accent" />
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* edit group */}
      <BottomSheet open={editOpen} onClose={() => setEditOpen(false)} title="Название группы">
        <div className="px-5 space-y-4">
          <TcInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={96} />
          <TcButton
            size="lg"
            disabled={!title.trim()}
            loading={updateGroup.isPending}
            onClick={() => updateGroup.mutate({ chatId, title })}
          >
            <Check size={17} /> Сохранить
          </TcButton>
        </div>
      </BottomSheet>
    </div>
  );
}

function MediaThumb({ attachmentKey }: { attachmentKey: string | null }) {
  const url = useFileUrl(attachmentKey);
  return (
    <div className="aspect-square rounded-[16px] overflow-hidden tcy-card">
      {url ? (
        <img src={url} className="w-full h-full object-cover" loading="lazy" alt="" />
      ) : (
        <div className="w-full h-full flex items-center justify-center tcy-faint">
          <ImageIcon size={18} />
        </div>
      )}
    </div>
  );
}
