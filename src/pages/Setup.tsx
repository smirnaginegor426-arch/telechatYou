import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router";
import { ArrowLeft, ArrowRight, AtSign, Camera, Check } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { TcButton } from "@/components/TcButton";
import { AvatarEditor } from "@/components/AvatarEditor";
import { TcInput, TcTextarea } from "@/components/TcInput";

import { Logo } from "@/components/Logo";
import { fileToBase64 } from "@/lib/format";

type MascotId = "cat" | "rabbit" | "panda" | "dino" | "fox" | "bear";
const MASCOTS: { id: MascotId; name: string }[] = [
  { id: "cat", name: "Котёнок" },
  { id: "rabbit", name: "Кролик" },
  { id: "panda", name: "Панда" },
  { id: "dino", name: "Динозаврик" },
  { id: "fox", name: "Лисёнок" },
  { id: "bear", name: "Мишка" },
];

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
  const [selectedMascot, setSelectedMascot] = useState<MascotId | null>("cat");
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
      let avatarKey: string | undefined = selectedMascot ? `mascot:${selectedMascot}` : undefined;
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
        <h2 className="text-[24px] font-extrabold tcy-text">Как тебя зовут, дружок?</h2>
        <p className="text-[13.5px] tcy-dim mt-1.5">Давай придумаем тебе крутое имя — так тебя будут узнавать друзья.</p>
      </div>
      <TcInput
        autoFocus
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Твоё имя"
        maxLength={64}
      />
      <TcButton size="lg" disabled={!displayName.trim()} onClick={() => setStep(1)}>
        Дальше <ArrowRight size={18} />
      </TcButton>
    </div>,
    // 1 — username
    <div key="username" className="space-y-6">
      <div>
        <h2 className="text-[24px] font-extrabold tcy-text">Придумаем тебе классный ник!</h2>
        <p className="text-[13.5px] tcy-dim mt-1.5">По нему друзья смогут найти тебя.</p>
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
    // 2 — mascot or personal photo + bio
    <div key="avatar" className="space-y-5">
      <div className="text-center">
        <h2 className="text-[24px] font-extrabold tcy-text">Выбери себе маленького друга!</h2>
        <p className="text-[13.5px] tcy-dim mt-1.5">Можно выбрать персонажа или поставить своё фото.</p>
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
      <div className="tcy-mascot-picker">
        {MASCOTS.map((mascot) => (
          <button
            key={mascot.id}
            type="button"
            aria-pressed={selectedMascot === mascot.id}
            className="tcy-mascot-choice"
            onClick={() => {
              setSelectedMascot(mascot.id);
              setAvatarFile(null);
              setAvatarPreview(null);
            }}
          >
            <img src={`/mascots/${mascot.id}.svg`} alt="" draggable={false} />
            <span>{mascot.name}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="tcy-mascot-custom-photo inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-[13px] font-extrabold tcy-text"
      >
        <Camera size={18} /> Выбрать своё фото
      </button>
      {avatarPreview && (
        <div className="flex items-center gap-3 rounded-[20px] p-3 tcy-avatar-custom-preview">
          <img src={avatarPreview} alt="Твоё фото" className="h-12 w-12 rounded-[16px] object-cover" />
          <span className="flex-1 text-[12.5px] font-bold tcy-text">Фото выбрано</span>
          <button type="button" onClick={() => { setAvatarFile(null); setAvatarPreview(null); setSelectedMascot("cat"); }} className="text-[11px] font-extrabold tcy-accent">Персонаж</button>
        </div>
      )}
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
          setSelectedMascot(null);
          setAvatarFile(edited);
          setAvatarPreview(URL.createObjectURL(edited));
        }}
      />
    </div>
  );
}
