import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { AtSign, Camera, Check, ChevronRight, LogOut, Pencil, Quote, Trash2, UsersRound } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Avatar } from "@/components/Avatar";
import { AvatarEditor } from "@/components/AvatarEditor";
import { BottomSheet } from "@/components/BottomSheet";
import { TcButton } from "@/components/TcButton";
import { TcInput, TcTextarea } from "@/components/TcInput";
import { fileToBase64 } from "@/lib/format";
import { useFileUrl } from "@/hooks/useFileUrl";

export default function Profile() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const me = trpc.profile.me.useQuery();
  const profile = me.data?.profile;
  const bannerUrl = useFileUrl(profile?.bannerKey);

  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [avatarToEdit, setAvatarToEdit] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const [bannerError, setBannerError] = useState("");

  const update = trpc.profile.update.useMutation({
    onSuccess: async () => {
      await utils.profile.me.invalidate();
      setEditOpen(false);
    },
    onError: (e) => setError(e.message),
  });
  const upload = trpc.storage.upload.useMutation();

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
  };

  const changeBanner = async (f: File) => {
    setBannerError("");
    if (!f.type.startsWith("image/")) {
      setBannerError("Выберите изображение для обложки.");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setBannerError("Размер обложки не должен превышать 20 МБ.");
      return;
    }
    try {
      const res = await upload.mutateAsync({
        name: f.name,
        contentBase64: await fileToBase64(f),
        contentType: f.type,
        folder: "banners",
      });
      await update.mutateAsync({ bannerKey: res.key });
      await utils.profile.me.invalidate();
    } catch (cause) {
      setBannerError(cause instanceof Error ? cause.message : "Не удалось загрузить обложку.");
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
      <input
        ref={bannerRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.currentTarget.value = "";
          if (f) void changeBanner(f);
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
        <div className="relative mx-4 mb-0 h-[168px] w-[calc(100%-2rem)] max-w-[560px] overflow-hidden rounded-[24px] border tcy-line tcy-card-strong shadow-lg">
          {bannerUrl ? (
            <img src={bannerUrl} alt="Обложка профиля" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
          ) : (
            <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 78% 25%, color-mix(in srgb, var(--tcy-accent) 46%, transparent), transparent 34%), radial-gradient(circle at 18% 110%, color-mix(in srgb, #f97316 34%, transparent), transparent 44%), linear-gradient(135deg, var(--tcy-card-strong), var(--tcy-card))" }}>
              <div className="absolute -right-5 -top-10 h-36 w-36 rounded-full border border-white/10" />
              <div className="absolute right-16 -bottom-20 h-48 w-48 rounded-full border border-white/10" />
              <div className="absolute left-5 bottom-5 text-[11px] font-extrabold uppercase tracking-[0.24em] text-white/75">TeleChatYou</div>

            </div>
          )}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/35 via-transparent to-black/10" />
          <button type="button" onClick={() => { setBannerError(""); bannerRef.current?.click(); }}
            aria-label="Изменить обложку" title="Изменить обложку"
            className="tcy-press absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md">
            <Pencil size={16} />
          </button>
          {profile.bannerKey && (
            <button type="button" onClick={() => {
              void update.mutateAsync({ bannerKey: null }).then(() => utils.profile.me.invalidate()).catch((cause) => setBannerError(cause instanceof Error ? cause.message : "Не удалось убрать обложку."));
            }} aria-label="Удалить обложку" title="Удалить обложку"
              className="tcy-press absolute left-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md">
              <Trash2 size={14} />
            </button>
          )}
          {!profile.bannerKey && <div className="absolute left-5 top-5 rounded-full bg-black/20 px-2.5 py-1 text-[10px] font-semibold text-white/85">Рекомендуемый размер 1920 × 768</div>}
        </div>
        {bannerError && <p role="alert" className="relative mt-3 px-5 text-center text-[12px] font-semibold tcy-danger">{bannerError}</p>}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="relative mt-5"
        >
          <Avatar
            name={profile.displayName}
            avatarKey={profile.avatarKey}
            size={128}
            lastSeenAt={profile.lastSeenAt}
            showOnline
          />
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
          className="mt-5 text-[22px] font-extrabold tcy-text"
        >
          {profile.displayName}
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
    </div>
  );
}
