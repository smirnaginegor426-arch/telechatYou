import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router";
import { ArrowLeft, ArrowRight, AtSign, Camera, Check, UserRound } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { TcButton } from "@/components/TcButton";
import { AvatarEditor } from "@/components/AvatarEditor";
import { TcInput, TcTextarea } from "@/components/TcInput";

import { Logo } from "@/components/Logo";
import { fileToBase64 } from "@/lib/format";

const slide = {
  initial: { x: 60, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: -60, opacity: 0 },
  transition: { type: "spring" as const, stiffness: 320, damping: 32 },
};

export default function Setup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarToEdit, setAvatarToEdit] = useState<File | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const usernameOk = /^[a-zA-Z0-9_]{3,32}$/.test(username);
  const check = trpc.profile.checkUsername.useQuery(
    { username },
    { enabled: usernameOk, retry: false },
  );

  const setup = trpc.profile.setup.useMutation({
    onSuccess: async () => {
      await utils.profile.me.invalidate();
      navigate("/", { replace: true });
    },
    onError: (e) => setError(e.message),
  });
  const upload = trpc.storage.upload.useMutation();

  useEffect(() => setError(""), [step, username, displayName]);

  useEffect(() => {
    if (!avatarPreview) return;
    return () => URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  const finish = async () => {
    setError("");
    try {
      let avatarKey: string | undefined;
      if (avatarFile) {
        const res = await upload.mutateAsync({
          name: avatarFile.name || "avatar.jpg",
          contentBase64: await fileToBase64(avatarFile),
          contentType: avatarFile.type,
          folder: "avatars",
        });
        avatarKey = res.key;
      }
      await setup.mutateAsync({ displayName, username, bio: bio || undefined, avatarKey });
    } catch {
      /* onError handles */
    }
  };

  const steps = [
    // 0 — name
    <div key="name" className="space-y-6">
      <div>
        <h2 className="text-[24px] font-extrabold tcy-text">Как вас зовут?</h2>
        <p className="text-[13.5px] tcy-dim mt-1.5">Это имя увидят ваши собеседники.</p>
      </div>
      <TcInput
        autoFocus
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Имя и фамилия"
        maxLength={64}
      />
      <TcButton size="lg" disabled={!displayName.trim()} onClick={() => setStep(1)}>
        Дальше <ArrowRight size={18} />
      </TcButton>
    </div>,
    // 1 — username
    <div key="username" className="space-y-6">
      <div>
        <h2 className="text-[24px] font-extrabold tcy-text">Придумайте username</h2>
        <p className="text-[13.5px] tcy-dim mt-1.5">По нему вас смогут найти другие люди.</p>
      </div>
      <div className="relative">
        <AtSign size={18} className="absolute left-4 top-1/2 -translate-y-1/2 tcy-faint" />
        <TcInput
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
          placeholder="username"
          maxLength={32}
          className="pl-11"
          error={
            username && !usernameOk
              ? "Минимум 3 символа: латиница, цифры, _"
              : usernameOk && check.data && !check.data.available
                ? "Этот username уже занят"
                : undefined
          }
        />
      </div>
      {usernameOk && check.data?.available && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[13px] font-semibold flex items-center gap-1.5 px-2 tcy-accent"
        >
          <Check size={14} /> Свободно!
        </motion.p>
      )}
      <TcButton
        size="lg"
        disabled={!usernameOk || !check.data?.available}
        onClick={() => setStep(2)}
      >
        Дальше <ArrowRight size={18} />
      </TcButton>
    </div>,
    // 2 — avatar + bio
    <div key="avatar" className="space-y-6">
      <div>
        <h2 className="text-[24px] font-extrabold tcy-text">Фото профиля</h2>
        <p className="text-[13.5px] tcy-dim mt-1.5">Можно пропустить и добавить позже.</p>
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
      <div className="flex justify-center">
        <button onClick={() => fileRef.current?.click()} className="tcy-press relative">
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt="Аватар"
              className="w-28 h-28 object-cover"
              style={{ borderRadius: "32%" }}
            />
          ) : (
            <div
              className="w-28 h-28 tcy-card border-2 border-dashed tcy-line flex flex-col items-center justify-center gap-1.5"
              style={{ borderRadius: "32%" }}
            >
              <UserRound size={30} className="tcy-faint" />
            </div>
          )}
          <span className="absolute -bottom-1.5 -right-1.5 w-9 h-9 rounded-full tcy-gradient-accent flex items-center justify-center tcy-shadow-accent" style={{ color: "var(--tcy-on-accent)" }}>
            <Camera size={16} />
          </span>
        </button>
      </div>
      <TcTextarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="Пара слов о себе (необязательно)"
        rows={2}
        maxLength={280}
      />
      <TcButton size="lg" loading={setup.isPending || upload.isPending} onClick={finish}>
        Создать профиль <Check size={18} />
      </TcButton>
      <button onClick={finish} className="w-full text-center text-[13.5px] font-semibold tcy-faint tcy-press">
        Пропустить
      </button>
    </div>,
  ];

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      <div className="tcy-aurora" />
      <div className="relative z-10 px-6 pt-6 safe-top flex items-center justify-between">
        <button
          onClick={() => (step === 0 ? navigate(-1) : setStep((s) => s - 1))}
          className="tcy-press w-10 h-10 rounded-full tcy-card flex items-center justify-center tcy-dim"
        >
          <ArrowLeft size={19} />
        </button>
        <Logo size={30} />
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === step ? 22 : 8,
                background: i <= step ? "var(--tcy-accent)" : "var(--tcy-card-strong)",
              }}
            />
          ))}
        </div>
      </div>
      <div className="relative z-10 flex-1 flex flex-col justify-center px-7 pb-16">
        <AnimatePresence mode="wait">
          <motion.div key={step} {...slide}>
            {steps[step]}
          </motion.div>
        </AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-[13px] tcy-danger text-center font-semibold">
            {error}
          </motion.p>
        )}
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
