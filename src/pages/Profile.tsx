import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { AtSign, Camera, Check, ChevronRight, Copy, ImagePlus, LogOut, MoreVertical, Pencil, Quote, RefreshCw, Sparkles, Trash2, UsersRound } from "lucide-react";
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
import { useTesterMode } from "@/hooks/useTesterMode";
import { usePrivateReleaseAccess } from "@/hooks/usePrivateReleaseAccess";
import { copyTextToClipboard, profileShareUrl } from "@/lib/share-links";

type PlushProfilePrefs = { status: string; background: string };
const PLUSH_STATUSES = ["🌼 На связи", "🎮 Играю", "🎨 Рисую", "🌙 Сплю", "📚 Учусь", "🎧 Слушаю музыку", "☕ Отдыхаю"];
const PLUSH_BACKGROUNDS = [
  { id: "cotton", name: "Зефир", style: "linear-gradient(145deg, #fff2e8, #f8ddeb 55%, #eee3ff)" },
  { id: "mint", name: "Мята", style: "linear-gradient(145deg, #e8f9ed, #d3f2e8 55%, #e6f4ff)" },
  { id: "sky", name: "Облачко", style: "linear-gradient(145deg, #e8f5ff, #dbe8ff 55%, #f4e7ff)" },
  { id: "lemon", name: "Лимон", style: "linear-gradient(145deg, #fff8d8, #ffe8dc 58%, #f9dfec)" },
];
const DEFAULT_PLUSH_PREFS: PlushProfilePrefs = { status: "🌼 На связи", background: "cotton" };

type AvatarFrameId = "midnight-gold" | "candy-party" | "moon-cat" | "pumpkin-night";
type FrameFlight = {
  frameId: AvatarFrameId;
  from: { left: number; top: number; width: number; height: number };
  to: { left: number; top: number; width: number; height: number };
};
const AVATAR_FRAMES: { id: AvatarFrameId; name: string; src: string }[] = [
  // These use the exact frame photos supplied by the user, with transparent
  // paper/center areas so the real profile photo shows through.
  { id: "midnight-gold", name: "Золотая ночь", src: "/frames/frame-black-gold-skull.webp" },
  { id: "candy-party", name: "Сладкий Хэллоуин", src: "/frames/frame-orange-sweets.webp" },
  { id: "moon-cat", name: "Лунный кот", src: "/frames/frame-blue-cat.webp" },
  { id: "pumpkin-night", name: "Тыквенная ночь", src: "/frames/frame-purple-halloween.webp" },
];


export default function Profile() {
  const { logout } = useAuth();
  const { enabled: isPrivateTester } = useTesterMode();
  const { enabled: isPrivateRelease } = usePrivateReleaseAccess();
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
  const [plushCustomizeOpen, setPlushCustomizeOpen] = useState(false);
  const [plushPrefs, setPlushPrefs] = useState<PlushProfilePrefs | null>(null);
  const [framesOpen, setFramesOpen] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState<AvatarFrameId | null>(null);
  const [appliedFrame, setAppliedFrame] = useState<AvatarFrameId | null>(null);
  const [frameFlight, setFrameFlight] = useState<FrameFlight | null>(null);
  const frameOptionRefs = useRef<Record<string, HTMLSpanElement | null>>({});

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
    if (!profile?.userId) return;
    try {
      const stored = localStorage.getItem(`tcy-avatar-frame-${profile.userId}`);
      const validFrame = AVATAR_FRAMES.find((frame) => frame.id === stored);
      setAppliedFrame(validFrame?.id ?? null);
      setSelectedFrame(validFrame?.id ?? AVATAR_FRAMES[0].id);
    } catch {
      setSelectedFrame(AVATAR_FRAMES[0].id);
    }
  }, [profile?.userId]);

  useEffect(() => {
    if (!isPrivateTester || !profile?.userId) {
      setPlushPrefs(null);
      return;
    }
    try {
      const stored = localStorage.getItem(`tcy-plush-profile-prefs-${profile.userId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<PlushProfilePrefs>;
        setPlushPrefs({
          status: PLUSH_STATUSES.includes(parsed.status ?? "") ? parsed.status! : DEFAULT_PLUSH_PREFS.status,
          background: PLUSH_BACKGROUNDS.some((option) => option.id === parsed.background)
            ? parsed.background!
            : DEFAULT_PLUSH_PREFS.background,
        });
      } else {
        setPlushPrefs(DEFAULT_PLUSH_PREFS);
      }
    } catch {
      setPlushPrefs(DEFAULT_PLUSH_PREFS);
    }
  }, [isPrivateTester, profile?.userId]);

  useEffect(() => {
    if (!isPrivateTester || !profile?.userId || !plushPrefs) return;
    try {
      localStorage.setItem(`tcy-plush-profile-prefs-${profile.userId}`, JSON.stringify(plushPrefs));
    } catch {
      // Keep the current preview in memory if local storage is unavailable.
    }
  }, [isPrivateTester, profile?.userId, plushPrefs]);

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

  const applySelectedFrame = () => {
    if (!profile?.userId || !selectedFrame) return;
    const source = frameOptionRefs.current[selectedFrame];
    const target = document.getElementById("avatar-frame-target");
    if (!source || !target) {
      setAppliedFrame(selectedFrame);
      try {
        localStorage.setItem(`tcy-avatar-frame-${profile.userId}`, selectedFrame);
      } catch {
        // Keep the applied frame for this session when storage is unavailable.
      }
      setFramesOpen(false);
      return;
    }
    const sourceRect = source.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    setFrameFlight({
      frameId: selectedFrame,
      from: { left: sourceRect.left, top: sourceRect.top, width: sourceRect.width, height: sourceRect.height },
      to: { left: targetRect.left - 20, top: targetRect.top - 20, width: targetRect.width + 40, height: targetRect.height + 40 },
    });
    setFramesOpen(false);
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
      <div
        className={`tcy-profile-hero relative pt-16 safe-top pb-8 flex flex-col items-center ${isPrivateTester ? "tcy-plush-profile-hero" : ""}`}
        style={isPrivateTester && plushPrefs
          ? { background: PLUSH_BACKGROUNDS.find((option) => option.id === plushPrefs.background)?.style }
          : undefined}
      >
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
          <div id="avatar-frame-target" className="relative shrink-0" style={{ width: 128, height: 128 }}>
            <button
              type="button"
              onClick={() => setAvatarPreviewOpen(true)}
              aria-label="Открыть свою аватарку"
              title="Открыть аватарку"
              className="tcy-press relative z-[1] block cursor-zoom-in rounded-[30%] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--tcy-accent)]"
            >
              <Avatar
                name={profile.displayName}
                avatarKey={profile.avatarKey}
                size={128}
                lastSeenAt={profile.lastSeenAt}
                showOnline={!isPrivateTester}
              />
            </button>
            {isPrivateRelease && appliedFrame && (
              <img
                src={AVATAR_FRAMES.find((frame) => frame.id === appliedFrame)?.src}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="pointer-events-none absolute -left-[20px] -top-[20px] z-10 h-[168px] w-[168px] max-w-none object-contain"
              />
            )}
          </div>
          <button
            type="button"
            aria-label="Изменить аватарку"
            onClick={() => fileRef.current?.click()}
            className="tcy-press absolute -bottom-1 -right-1 z-20 w-10 h-10 rounded-full tcy-gradient-accent tcy-shadow-accent flex items-center justify-center"
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
        {isPrivateRelease && (
        <div className="mt-4 flex items-center justify-center gap-2.5 px-4">
          <TcButton size="sm" variant="soft" onClick={openEdit}>
            <Pencil size={15} className="text-black dark:text-white" /> Редактирование
          </TcButton>
          <button
            type="button"
            onClick={() => {
              setSelectedFrame(appliedFrame ?? AVATAR_FRAMES[0].id);
              setFramesOpen(true);
            }}
            className="tcy-press inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-[color:var(--tcy-line)] px-3.5 text-[12px] font-semibold tcy-card tcy-text"
          >
            <span aria-hidden="true" className="text-[16px] leading-none">🎃</span>
            Рамки
          </button>
        </div>
        )}
        {isPrivateTester && plushPrefs && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <span className="tcy-profile-status-chip">{plushPrefs.status}</span>
            <button
              type="button"
              onClick={() => setPlushCustomizeOpen(true)}
              className="tcy-profile-customize-button"
            >
              <Sparkles size={15} /> Укрась свой профиль
            </button>
          </div>
        )}
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

      <BottomSheet
        open={plushCustomizeOpen}
        onClose={() => setPlushCustomizeOpen(false)}
        title="Укрась свой профиль"
      >
        <div className="space-y-5 px-5 pb-5">
          <section>
            <h3 className="mb-3 text-[14px] font-extrabold tcy-text">Какое у тебя настроение?</h3>
            <div className="flex flex-wrap gap-2">
              {PLUSH_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  aria-pressed={plushPrefs?.status === status}
                  onClick={() => setPlushPrefs((current) => ({ ...(current ?? DEFAULT_PLUSH_PREFS), status }))}
                  className="tcy-plush-profile-choice"
                >
                  {status}
                </button>
              ))}
            </div>
          </section>
          <section>
            <h3 className="mb-3 text-[14px] font-extrabold tcy-text">Выбери фон</h3>
            <div className="grid grid-cols-2 gap-3">
              {PLUSH_BACKGROUNDS.map((background) => (
                <button
                  key={background.id}
                  type="button"
                  aria-pressed={plushPrefs?.background === background.id}
                  onClick={() => setPlushPrefs((current) => ({ ...(current ?? DEFAULT_PLUSH_PREFS), background: background.id }))}
                  className="tcy-plush-profile-bg-choice"
                  style={{ background: background.style }}
                >
                  <span>{background.name}</span>
                  {plushPrefs?.background === background.id && <Check size={17} />}
                </button>
              ))}
            </div>
          </section>
          <p className="text-[11.5px] leading-relaxed tcy-dim">
            Это тестовая настройка приватной версии и пока сохраняется только на этом устройстве.
          </p>
          <TcButton size="lg" onClick={() => setPlushCustomizeOpen(false)}>Готово ✨</TcButton>
        </div>
      </BottomSheet>
      <BottomSheet open={framesOpen} onClose={() => setFramesOpen(false)} title="Рамки">
        <div className="space-y-4 px-5 pb-5">
          <div className="flex flex-col items-center pt-1">
            <div className="relative flex h-[204px] w-[204px] items-center justify-center">
              <Avatar name={profile.displayName} avatarKey={profile.avatarKey} size={120} showOnline={false} />
              {selectedFrame && (
                <motion.img
                  key={selectedFrame}
                  src={AVATAR_FRAMES.find((frame) => frame.id === selectedFrame)?.src}
                  alt=""
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 23 }}
                  className="pointer-events-none absolute left-1/2 top-1/2 h-[190px] w-[190px] object-contain"
                  style={{ marginLeft: -95, marginTop: -95 }}
                />
              )}
            </div>
            <p className="mt-1 text-center text-[12px] font-medium tcy-dim">
              {AVATAR_FRAMES.find((frame) => frame.id === selectedFrame)?.name ?? "Выбери рамку"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {AVATAR_FRAMES.map((frame) => (
              <button
                key={frame.id}
                type="button"
                aria-pressed={selectedFrame === frame.id}
                onClick={() => setSelectedFrame(frame.id)}
                className={`tcy-press flex min-w-0 flex-col items-center gap-1.5 rounded-[18px] border p-2.5 text-center transition-colors ${selectedFrame === frame.id ? "border-[var(--tcy-accent)] bg-[color-mix(in_srgb,var(--tcy-accent)_12%,transparent)]" : "tcy-line tcy-card"}`}
              >
                <span
                  ref={(element) => { frameOptionRefs.current[frame.id] = element; }}
                  className="relative flex h-[94px] w-[94px] items-center justify-center"
                >
                  <Avatar name={profile.displayName} avatarKey={profile.avatarKey} size={58} showOnline={false} />
                  <img
                    src={frame.src}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    className="pointer-events-none absolute left-[3px] top-[3px] h-[88px] w-[88px] object-contain"
                  />
                </span>
                <span className="line-clamp-2 text-[11px] font-semibold leading-tight tcy-text">{frame.name}</span>
              </button>
            ))}
          </div>
          <TcButton size="lg" onClick={applySelectedFrame}>
            <Check size={17} /> Применить
          </TcButton>
        </div>
      </BottomSheet>

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
      <AnimatePresence>
        {frameFlight && (
          <motion.img
            key={frameFlight.frameId}
            src={AVATAR_FRAMES.find((frame) => frame.id === frameFlight.frameId)?.src}
            alt=""
            aria-hidden="true"
            draggable={false}
            initial={{
              left: frameFlight.from.left,
              top: frameFlight.from.top,
              width: frameFlight.from.width,
              height: frameFlight.from.height,
              scale: 0.9,
              opacity: 1,
            }}
            animate={{
              left: frameFlight.to.left,
              top: frameFlight.to.top,
              width: frameFlight.to.width,
              height: frameFlight.to.height,
              scale: 1,
              opacity: 1,
            }}
            transition={{ type: "spring", stiffness: 300, damping: 28, mass: 0.75 }}
            onAnimationComplete={() => {
              const completedFrame = frameFlight.frameId;
              setAppliedFrame(completedFrame);
              setSelectedFrame(completedFrame);
              try {
                if (profile?.userId) localStorage.setItem(`tcy-avatar-frame-${profile.userId}`, completedFrame);
              } catch {
                // Keep the selected frame in React state if storage is unavailable.
              }
              setFrameFlight(null);
              toast.success("Рамка применена");
            }}
            className="pointer-events-none fixed z-[100] max-w-none object-contain"
            style={{ position: "fixed", transformOrigin: "center center" }}
          />
        )}
      </AnimatePresence>
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
