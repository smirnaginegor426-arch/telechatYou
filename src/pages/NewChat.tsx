import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { ArrowLeft, Camera, Check, Users } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Avatar } from "@/components/Avatar";
import { TcButton } from "@/components/TcButton";
import { TcInput } from "@/components/TcInput";
import { fileToBase64 } from "@/lib/format";
import { cn } from "@/lib/utils";

/** New chat: pick one user for a direct chat, or several + title for a group. */
export default function NewChat() {
  const navigate = useNavigate();
  const directory = trpc.profile.directory.useQuery(undefined, { staleTime: 30_000 });
  const [selected, setSelected] = useState<number[]>([]);
  const [title, setTitle] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const createDirect = trpc.chats.createDirect.useMutation({
    onSuccess: (r) => navigate(`/chat/${r.chatId}`, { replace: true }),
  });
  const createGroup = trpc.chats.createGroup.useMutation({
    onSuccess: (r) => navigate(`/chat/${r.chatId}`, { replace: true }),
  });
  const upload = trpc.storage.upload.useMutation();

  const toggle = (userId: number) => {
    setSelected((prev) => {
      if (prev.includes(userId)) return prev.filter((x) => x !== userId);
      if (prev.length === 0) {
        // first tap on a user = quick direct chat unless holding multi-select:
        return [userId];
      }
      return [...prev, userId];
    });
  };

  const makeGroup = async () => {
    let avatarKey: string | undefined;
    if (avatarFile) {
      const res = await upload.mutateAsync({
        name: avatarFile.name,
        contentBase64: await fileToBase64(avatarFile),
        contentType: avatarFile.type,
        folder: "avatars",
      });
      avatarKey = res.key;
    }
    createGroup.mutate({ title, memberIds: selected, avatarKey });
  };

  const busy = createDirect.isPending || createGroup.isPending || upload.isPending;

  return (
    <div className="relative h-full flex flex-col">
      <header className="relative z-10 flex items-center gap-3 px-4 pt-5 safe-top pb-3">
        <button
          onClick={() => navigate(-1)}
          className="tcy-press w-10 h-10 rounded-full tcy-card flex items-center justify-center tcy-dim"
        >
          <ArrowLeft size={19} />
        </button>
        <h1 className="text-[19px] font-extrabold tcy-text flex-1">Новый чат</h1>
        {selected.length > 1 && (
          <span className="text-[12.5px] font-bold tcy-accent">{selected.length} выбрано</span>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-2 pb-6 relative z-10">
        <div className="px-3 py-2 text-[12px] font-bold uppercase tracking-[0.08em] tcy-faint">
          Выберите собеседников
        </div>
        {(directory.data ?? []).map((p, i) => {
          const active = selected.includes(p.userId);
          return (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.025, 0.2) }}
              onClick={() => toggle(p.userId)}
              onDoubleClick={() => createDirect.mutate({ userId: p.userId })}
              className={cn(
                "w-full flex items-center gap-3.5 px-3 py-2.5 rounded-[20px] text-left tcy-press",
                active && "tcy-card",
              )}
            >
              <Avatar name={p.displayName} avatarKey={p.avatarKey} size={46} />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[14.5px] tcy-text truncate">{p.displayName}</div>
                <div className="text-[12.5px] tcy-faint">@{p.username}</div>
              </div>
              <span
                className="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
                style={{
                  borderColor: active ? "var(--tcy-accent)" : "var(--tcy-line-strong)",
                  background: active ? "var(--tcy-accent)" : "transparent",
                  color: "var(--tcy-on-accent)",
                }}
              >
                {active && <Check size={14} strokeWidth={3} />}
              </span>
            </motion.button>
          );
        })}
        {(directory.data ?? []).length === 0 && !directory.isLoading && (
          <p className="text-center tcy-dim text-[13.5px] py-10">
            Других пользователей пока нет — пригласите друзей!
          </p>
        )}
      </div>

      {/* footer actions */}
     <div
  className="relative z-10 shrink-0 px-5 space-y-3"
  style={{
    paddingBottom: "calc(120px + env(safe-area-inset-bottom))",
  }}
>
        {selected.length === 1 && (
          <TcButton
            size="lg"
            loading={busy}
            onClick={() => createDirect.mutate({ userId: selected[0] })}
          >
            Начать чат
          </TcButton>
        )}
        {selected.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="tcy-solid border tcy-line rounded-[26px] p-4 space-y-3 tcy-shadow-soft"
          >
            <div className="flex items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setAvatarFile(f);
                    setAvatarPreview(URL.createObjectURL(f));
                  }
                }}
              />
              <button onClick={() => fileRef.current?.click()} className="tcy-press shrink-0">
                {avatarPreview ? (
                  <img src={avatarPreview} className="w-12 h-12 object-cover rounded-[16px]" alt="" />
                ) : (
                  <span className="w-12 h-12 rounded-[16px] tcy-card border border-dashed tcy-line flex items-center justify-center tcy-faint">
                    <Camera size={18} />
                  </span>
                )}
              </button>
              <TcInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Название группы"
                maxLength={96}
              />
            </div>
            <TcButton size="lg" disabled={!title.trim()} loading={busy} onClick={makeGroup}>
              <Users size={18} /> Создать группу ({selected.length})
            </TcButton>
          </motion.div>
        )}
      </div>
    </div>
  );
}
