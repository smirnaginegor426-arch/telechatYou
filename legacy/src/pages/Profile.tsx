import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { AtSign, Camera, Check, LogOut, Quote, SquarePen, Trash2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Avatar } from "@/components/Avatar";
import { BottomSheet } from "@/components/BottomSheet";
import { TcButton } from "@/components/TcButton";
import { TcInput, TcTextarea } from "@/components/TcInput";
import { fileToBase64 } from "@/lib/format";

export default function Profile() {
  const { logout } = useAuth();
  const utils = trpc.useUtils();
  const me = trpc.profile.me.useQuery();
  const profile = me.data?.profile;

  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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
    update.mutate({ avatarKey: res.key });
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
          if (f) void changeAvatar(f);
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
          className="relative"
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

      </div>

      {/* info cards */}
      <div className="px-4 space-y-3">
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

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => logout()}
            className="tcy-press flex w-full items-center gap-3.5 rounded-[20px] border px-4 py-4 text-left transition-colors"
            style={{
              color: "#ffffff",
              borderColor: "#ff303f",
              background: "linear-gradient(135deg, #ff303f 0%, #d90024 100%)",
              boxShadow: "0 6px 18px rgba(255, 30, 55, 0.22)",
            }}
          >
            <LogOut size={18} />
            <span className="text-[14.5px] font-bold">Выйти из аккаунта</span>
          </button>
          <button
            type="button"
            onClick={() => window.alert("Удаление аккаунта пока не подключено на сервере.")}
            className="tcy-press flex w-full items-center gap-3.5 rounded-[20px] border px-4 py-4 text-left transition-colors"
            style={{
              color: "#ffffff",
              borderColor: "#ff303f",
              background: "linear-gradient(135deg, #ff303f 0%, #d90024 100%)",
              boxShadow: "0 6px 18px rgba(255, 30, 55, 0.22)",
            }}
          >
            <Trash2 size={18} />
            <span className="text-[14.5px] font-bold">Удалить аккаунт</span>
          </button>
        </div>
        <p className="text-center text-[11px] tcy-faint pt-1">
          TeleChatYou · ID {profile.userId}
        </p>
      </div>

      {/* edit sheet */}
      <BottomSheet open={editOpen} onClose={() => setEditOpen(false)} title="Редактировать профиль">
        <div className="px-5 space-y-4">
          <TcInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" maxLength={64} />
          <TcInput
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
            placeholder="username"
            maxLength={32}
          />
          <TcTextarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="О себе"
            rows={3}
            maxLength={280}
          />
          {error && <p className="text-[13px] tcy-danger font-semibold">{error}</p>}
          <TcButton size="lg" loading={update.isPending} onClick={save}>
            <Check size={17} /> Сохранить
          </TcButton>
        </div>
      </BottomSheet>
    </div>
  );
}
