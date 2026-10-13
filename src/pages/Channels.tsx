import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Camera,
  Check,
  Globe2,
  LockKeyhole,
  Plus,
  Radio,
  Search,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Avatar } from "@/components/Avatar";
import { AvatarEditor } from "@/components/AvatarEditor";
import { TcButton } from "@/components/TcButton";
import { fileToBase64 } from "@/lib/format";

export default function ChannelsPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [username, setUsername] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarToEdit, setAvatarToEdit] = useState<File | null>(null);
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!avatarPreview) return;
    return () => URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  const directory = trpc.channels.directory.useQuery(
    { query: directoryQuery.trim() || undefined },
    { staleTime: 30_000 },
  );
  const upload = trpc.storage.upload.useMutation();
  const create = trpc.channels.create.useMutation();
  const join = trpc.channels.joinPublic.useMutation();

  const busy = upload.isPending || create.isPending || join.isPending;

  const createChannel = async () => {
    setError("");
    if (!title.trim()) {
      setError("Укажите название канала.");
      return;
    }
    if (isPublic && !/^[a-zA-Z0-9_]{3,32}$/.test(username.trim())) {
      setError("Username публичного канала: 3–32 символа, латиница, цифры и _.");
      return;
    }
    try {
      let avatarKey: string | undefined;
      if (avatarFile) {
        const result = await upload.mutateAsync({
          name: avatarFile.name || "channel-avatar.jpg",
          contentBase64: await fileToBase64(avatarFile),
          contentType: avatarFile.type,
          folder: "avatars",
        });
        avatarKey = result.key;
      }
      const result = await create.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        avatarKey,
        isPublic,
        username: isPublic ? username.trim().toLowerCase() : undefined,
      });
      await utils.chats.list.invalidate();
      navigate(`/chat/${result.chatId}`, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось создать канал.");
    }
  };

  const joinChannel = async (name: string) => {
    setError("");
    try {
      const result = await join.mutateAsync({ username: name });
      await utils.chats.list.invalidate();
      navigate(`/chat/${result.chatId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось открыть канал.");
    }
  };

  return (
    <div className="relative h-full flex flex-col">
      <header className="relative z-10 flex items-center gap-3 px-4 pt-5 safe-top pb-3">
        <button
          onClick={() => navigate(-1)}
          className="tcy-press w-10 h-10 rounded-full tcy-card border tcy-line flex items-center justify-center tcy-dim"
          aria-label="Назад"
        >
          <ArrowLeft size={19} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold tcy-text">Каналы</h1>
          <p className="text-[12px] tcy-faint">Создавайте и находите сообщества</p>
        </div>
        <Radio size={23} className="tcy-accent" />
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pb-28 relative z-10 space-y-4">
        <section className="tcy-solid border tcy-line rounded-[26px] p-4 space-y-3 tcy-shadow-soft">
          <div>
            <h2 className="text-[16px] font-extrabold tcy-text">Создать канал</h2>
            <p className="text-[12px] tcy-dim mt-1">Публиковать посты и опросы смогут владелец и администраторы.</p>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) setAvatarToEdit(file);
              event.currentTarget.value = "";
            }}
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="tcy-press w-[66px] h-[66px] shrink-0 rounded-[22px] tcy-card border tcy-line overflow-hidden flex items-center justify-center"
              aria-label="Выбрать аватар канала"
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <Camera size={22} className="tcy-accent" />
              )}
            </button>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={96}
              placeholder="Название канала"
              className="flex-1 min-w-0 h-12 rounded-[16px] tcy-card border tcy-line px-3.5 text-[14px] tcy-text outline-none focus:border-[color:var(--tcy-accent)]"
            />
          </div>

          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={280}
            rows={3}
            placeholder="Описание канала (необязательно)"
            className="w-full resize-none rounded-[16px] tcy-card border tcy-line p-3.5 text-[13.5px] tcy-text outline-none focus:border-[color:var(--tcy-accent)]"
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsPublic(true)}
              className="tcy-press rounded-[17px] border p-3 text-left flex items-center gap-2.5"
              style={{
                borderColor: isPublic ? "var(--tcy-accent)" : "var(--tcy-line)",
                background: isPublic ? "var(--tcy-card-strong)" : "var(--tcy-card)",
              }}
            >
              <Globe2 size={18} className={isPublic ? "tcy-accent" : "tcy-faint"} />
              <span className="min-w-0">
                <span className="block text-[13px] font-bold tcy-text">Публичный</span>
                <span className="block text-[10.5px] tcy-faint">Можно найти по username</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setIsPublic(false)}
              className="tcy-press rounded-[17px] border p-3 text-left flex items-center gap-2.5"
              style={{
                borderColor: !isPublic ? "var(--tcy-accent)" : "var(--tcy-line)",
                background: !isPublic ? "var(--tcy-card-strong)" : "var(--tcy-card)",
              }}
            >
              <LockKeyhole size={18} className={!isPublic ? "tcy-accent" : "tcy-faint"} />
              <span className="min-w-0">
                <span className="block text-[13px] font-bold tcy-text">Приватный</span>
                <span className="block text-[10.5px] tcy-faint">Владелец приглашает участников</span>
              </span>
            </button>
          </div>

          {isPublic && (
            <label className="block space-y-1.5">
              <span className="text-[12px] font-bold tcy-dim">Username канала</span>
              <div className="flex items-center rounded-[16px] tcy-card border tcy-line px-3.5">
                <span className="text-[14px] tcy-faint">@</span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 32))}
                  minLength={3}
                  maxLength={32}
                  placeholder="my_channel"
                  className="h-11 min-w-0 flex-1 bg-transparent px-2 text-[14px] tcy-text outline-none"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
              <span className="block text-[10.5px] tcy-faint">Ссылка для поиска: @username</span>
            </label>
          )}

          {error && (
            <div role="alert" className="rounded-[14px] border px-3 py-2.5 text-[12.5px]" style={{ borderColor: "var(--tcy-danger)", color: "var(--tcy-danger)" }}>
              {error}
            </div>
          )}

          <TcButton size="lg" loading={busy} disabled={!title.trim()} onClick={() => void createChannel()}>
            <Plus size={18} /> Создать канал
          </TcButton>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-[16px] font-extrabold tcy-text">Публичные каналы</h2>
            <p className="text-[12px] tcy-dim mt-1">Подпишитесь, чтобы канал появился в списке каналов.</p>
          </div>
          <div className="flex items-center gap-2.5 h-11 rounded-[16px] tcy-card border tcy-line px-3.5">
            <Search size={16} className="tcy-faint shrink-0" />
            <input
              value={directoryQuery}
              onChange={(event) => setDirectoryQuery(event.target.value)}
              placeholder="Поиск по username"
              className="flex-1 min-w-0 bg-transparent outline-none text-[13.5px] tcy-text"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

          {directory.isLoading ? (
            <div className="text-center py-6 text-[13px] tcy-dim">Загружаем каналы…</div>
          ) : (directory.data ?? []).length === 0 ? (
            <div className="tcy-card border tcy-line rounded-[20px] px-4 py-5 text-center">
              <Radio size={26} className="mx-auto tcy-faint" />
              <p className="text-[13px] font-semibold tcy-text mt-2">Каналы не найдены</p>
              <p className="text-[11.5px] tcy-faint mt-1">Создайте первый публичный канал.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(directory.data ?? []).map((channel, index) => (
                <motion.div
                  key={channel.chatId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.025, 0.15) }}
                  className="tcy-card border tcy-line rounded-[21px] p-3 flex items-center gap-3"
                >
                  <Avatar name={channel.title} avatarKey={channel.avatarKey} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-bold tcy-text truncate">{channel.title}</div>
                    <div className="text-[11.5px] tcy-accent truncate">@{channel.username} · {channel.membersCount} подписч.</div>
                    {channel.description && (
                      <p className="text-[11.5px] tcy-dim mt-1 line-clamp-2">{channel.description}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void joinChannel(channel.username!)}
                    disabled={busy}
                    className="tcy-press h-9 px-3 rounded-[13px] tcy-gradient-accent text-[12px] font-bold flex items-center gap-1.5 disabled:opacity-50"
                    style={{ color: "var(--tcy-on-accent)" }}
                  >
                    <Check size={14} /> Войти
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>
      <AvatarEditor
        file={avatarToEdit}
        onCancel={() => setAvatarToEdit(null)}
        onSave={(edited) => {
          setAvatarFile(edited);
          setAvatarPreview(URL.createObjectURL(edited));
        }}
      />
    </div>
  );
}
