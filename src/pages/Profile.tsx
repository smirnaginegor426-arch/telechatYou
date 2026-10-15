import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { AtSign, Camera, Check, ChevronRight, Copy, ImagePlus, LogOut, MoreVertical, Pencil, Quote, RefreshCw, Trash2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Avatar } from "@/components/Avatar";
import { TesterBadge } from "@/components/TesterBadge";
import { isTesterUsername } from "@/lib/testers";
import { AvatarEditor } from "@/components/AvatarEditor";
import { Lightbox } from "@/components/Lightbox";
import { BottomSheet } from "@/components/BottomSheet";
import { TcButton } from "@/components/TcButton";
import { TcInput, TcTextarea } from "@/components/TcInput";
import { fileToBase64 } from "@/lib/format";
import { copyTextToClipboard, profileShareUrl } from "@/lib/share-links";

export default function Profile() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const me = trpc.profile.me.useQuery();
  const profile = me.data?.profile;

  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [avatarToEdit, setAvatarToEdit] = useState<File | null>(null);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [deleteAvatarOpen, setDeleteAvatarOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = trpc.profile.update.useMutation({
    onSuccess: async () => {
      await utils.profile.me.invalidate();
      setEditOpen(false);
    },
    onError: (e) => setError(e.message),
  });
  const upload = trpc.storage.upload.useMutation();

  useEffect(() => {
    if (!actionsOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !actionsRef.current?.contains(event.target)) {
        setActionsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActionsOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [actionsOpen]);

  const openEdit = () => {
    if (!profile) return;
    setName(profile.displayName);
    setUsername(profile.username);
    setBio(profile.bio);
    setError("");
    setEditOpen(true);
  };

  const save = () => {
    if (!name.trim()) return setError("Имя не может быть пустым");
    update.mutate({
      displayName: name,
      username: username !== profile?.username ? username : undefined,
      bio,
    });
  };

  const changeAvatar = async (f: File) => {
    const res = await upload.mutateAsync({
      name: f.name,
      contentBase64: await fileToBase64(f),
      contentType: f.type,
      folder: "avatars",
    });
    await update.mutateAsync({ avatarKey: res.key });
    toast.success(profile?.avatarKey ? "Аватарка заменена" : "Аватарка добавлена");
  };

  const copyProfileLink = async () => {
    if (!profile) return;
    const copied = await copyTextToClipboard(profileShareUrl(profile.username));
    if (copied) toast.success("Ссылка на профиль скопирована");
    else toast.error("Не удалось скопировать ссылку");
    setActionsOpen(false);
  };

  const removeAvatar = async () => {
    try {
      await update.mutateAsync({ avatarKey: null });
      setAvatarPreviewOpen(false);
      setDeleteAvatarOpen(false);
      setActionsOpen(false);
      toast.success("Аватарка удалена");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Не удалось удалить аватарку");
    }
  };

  if (me.isLoading || !profile) {
    return (
      <div className="h-full flex flex-col items-center pt-24 px-8 gap-5">
        <div className="tcy-skeleton w-32 h-32" style={{ borderRadius: "32%" }} />
        <div className="tcy-skeleton h-5 w-44 rounded-full" />
        <div className="tcy-skeleton h-3.5 w-28 rounded-full" />
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-y-auto no-scrollbar pb-32">
      <div
        ref={actionsRef}
        className="absolute right-4 z-40"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <button
          type="button"
          aria-label="Действия с профилем"
          aria-expanded={actionsOpen}
          onClick={() => setActionsOpen((open) => !open)}
          className="tcy-press flex h-11 w-11 items-center justify-center rounded-full tcy-card border tcy-line tcy-text"
        >
          <MoreVertical size={20} />
        </button>
        <AnimatePresence>
          {actionsOpen && (
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="absolute right-0 top-[calc(100%+8px)] w-64 origin-top-right rounded-[20px] tcy-card border tcy-line p-1.5 shadow-2xl backdrop-blur-2xl"
            >
              <button
                type="button"
                role="menuitem"
                onClick={copyProfileLink}
                className="tcy-press flex w-full items-center gap-3 rounded-[14px] px-3.5 py-3 text-left text-[13.5px] font-semibold tcy-text"
              >
                <Copy size={17} className="tcy-accent" />
                <span>Скопировать ссылку</span>
              </button>
              {!profile.avatarKey ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setActionsOpen(false);
                    fileRef.current?.click();
                  }}
                  className="tcy-press flex w-full items-center gap-3 rounded-[14px] px-3.5 py-3 text-left text-[13.5px] font-semibold tcy-text"
                >
                  <ImagePlus size={17} className="tcy-accent" />
                  <span>Добавить аватарку</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setActionsOpen(false);
                      fileRef.current?.click();
                    }}
                    className="tcy-press flex w-full items-center gap-3 rounded-[14px] px-3.5 py-3 text-left text-[13.5px] font-semibold tcy-text"
                  >
                    <RefreshCw size={17} className="tcy-accent" />
                    <span>Заменить аватарку</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setActionsOpen(false);
                      setDeleteAvatarOpen(true);
                    }}
                    className="tcy-press flex w-full items-center gap-3 rounded-[14px] px-3.5 py-3 text-left text-[13.5px] font-semibold tcy-danger"
                  >
                    <Trash2 size={17} />
                    <span>Удалить аватарку</span>
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setAvatarToEdit(f);
          e.currentTarget.value = "";
        }}
      />
      {/* hero */}
      <div className="relative pt-16 safe-top pb-8 flex flex-col items-center">
        <div
          className="absolute inset-x-0 top-0 h-56 pointer-events-none"
          style={{
            background:
              "radial-gradient(120% 100% at 50% 0%, var(--tcy-glow-1), transparent 70%)",
          }}
        />
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="relative mt-5"
        >
          <button
            type="button"
            onClick={() => setAvatarPreviewOpen(true)}
            aria-label="Открыть свою аватарку"
            title="Открыть аватарку"
            className="tcy-press block cursor-zoom-in rounded-[30%] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--tcy-accent)]"
          >
            <Avatar
              name={profile.displayName}
              avatarKey={profile.avatarKey}
              size={128}
              lastSeenAt={profile.lastSeenAt}
              showOnline
            />
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="tcy-press absolute -bottom-1 -right-1 w-10 h-10 rounded-full tcy-gradient-accent tcy-shadow-accent flex items-center justify-center"
            style={{ color: "var(--tcy-on-accent)" }}
          >
            <Camera size={17} />
          </button>
        </motion.div>
        <motion.h1
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-5 flex items-center justify-center gap-2 text-[22px] font-extrabold tcy-text"
        >
          {profile.displayName}
          {isTesterUsername(profile.username, profile.userId) && <TesterBadge />}
        </motion.h1>
        <div className="mt-1 text-[13.5px] font-semibold tcy-accent">@{profile.username}</div>
        {profile.bio && (
          <p className="mt-3 px-10 text-center text-[13.5px] tcy-dim leading-relaxed">
            {profile.bio}
          </p>
        )}
        <TcButton size="sm" variant="soft" className="mt-5" onClick={openEdit}>
          <Pencil size={14} /> Редактировать
        </TcButton>
      </div>

      {/* info cards */}
      <div className="px-4 space-y-3">
        <button
          type="button"
          onClick={() => navigate("/accounts")}
          className="w-full rounded-[22px] tcy-card border tcy-line px-4 py-3.5 flex items-center gap-3.5 text-left tcy-press"
        >
          <span className="w-10 h-10 rounded-[14px] tcy-card-strong flex items-center justify-center tcy-accent">
            <UsersRound size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold tcy-text">Аккаунты</span>
            <span className="block text-[11.5px] tcy-faint">Добавить или переключиться</span>
          </span>
          <ChevronRight size={17} className="tcy-faint" />
        </button>
        <div className="rounded-[24px] tcy-card border tcy-line divide-y divide-[color:var(--tcy-line)]">
          <div className="flex items-center gap-3.5 px-4 py-3.5">
            <AtSign size={17} className="tcy-accent" />
            <div>
              <div className="text-[14px] font-semibold tcy-text">@{profile.username}</div>
              <div className="text-[11.5px] tcy-faint">Имя пользователя</div>
            </div>
          </div>
          <div className="flex items-center gap-3.5 px-4 py-3.5">
            <Quote size={17} className="tcy-accent" />
            <div>
              <div className="text-[14px] font-semibold tcy-text">
                {profile.bio || "—"}
              </div>
              <div className="text-[11.5px] tcy-faint">О себе</div>
            </div>
          </div>
        </div>

        <button
          onClick={() => logout()}
          className="w-full rounded-[24px] tcy-card border tcy-line px-4 py-4 flex items-center gap-3.5 tcy-press"
        >
          <LogOut size={17} className="tcy-danger" />
          <span className="text-[14.5px] font-semibold tcy-danger">Выйти из аккаунта</span>
        </button>
        <p className="text-center text-[11px] tcy-faint pt-1">
          TeleChatYou · ID {profile.userId}
        </p>
      </div>

      <BottomSheet open={deleteAvatarOpen} onClose={() => setDeleteAvatarOpen(false)} title="Удалить аватарку?">
        <div className="px-5 pb-5 space-y-4">
          <p className="text-[13.5px] leading-relaxed tcy-dim">Текущая фотография профиля будет удалена. Вместо неё будет отображаться стандартная аватарка.</p>
          <div className="flex items-center justify-end gap-2">
            <TcButton size="sm" variant="soft" onClick={() => setDeleteAvatarOpen(false)}>Отмена</TcButton>
            <TcButton size="sm" variant="danger" loading={update.isPending} onClick={removeAvatar}><Trash2 size={15} /> Удалить</TcButton>
          </div>
        </div>
      </BottomSheet>

      {/* edit sheet */}
      <BottomSheet open={editOpen} onClose={() => setEditOpen(false)} title="Редактировать профиль">
        <div className="px-5 space-y-4">
          <label className="block space-y-1.5">
            <span className="block text-[12.5px] font-semibold tcy-dim">Имя</span>
            <TcInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Введите имя" maxLength={64} />
          </label>
          <label className="block space-y-1.5">
            <span className="block text-[12.5px] font-semibold tcy-dim">Имя пользователя</span>
            <span className="block text-[11.5px] tcy-faint">@юзернейм пользователя</span>
            <TcInput value={username} onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))} placeholder="@username" maxLength={32} />
          </label>
          <label className="block space-y-1.5">
            <span className="block text-[12.5px] font-semibold tcy-dim">О себе</span>
            <span className="block text-[11.5px] tcy-faint">Описание пользователя</span>
            <TcTextarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Расскажите о себе" rows={3} maxLength={280} />
          </label>
          {error && <p className="text-[13px] tcy-danger font-semibold">{error}</p>}
          <TcButton size="lg" loading={update.isPending} onClick={save}>
            <Check size={17} /> Сохранить
          </TcButton>
        </div>
      </BottomSheet>
      <AvatarEditor
        file={avatarToEdit}
        onCancel={() => setAvatarToEdit(null)}
        onSave={changeAvatar}
        saving={upload.isPending || update.isPending}
      />
      {avatarPreviewOpen && (
        <Lightbox
          imageKey={profile.avatarKey ?? null}
          name={profile.displayName}
          fallbackName={!profile.avatarKey ? profile.displayName : null}
          onClose={() => setAvatarPreviewOpen(false)}
        />
      )}
    </div>
  );
}
