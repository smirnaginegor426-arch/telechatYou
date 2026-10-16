import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  AtSign,
  Camera,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Sparkles,
  UserRound,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { TcButton } from "@/components/TcButton";
import { AvatarEditor } from "@/components/AvatarEditor";
import { ThemeToggle } from "@/components/ThemeToggle";
import { fileToBase64 } from "@/lib/format";
import {
  createAccountSlotId,
  MAX_SAVED_ACCOUNTS,
  readSavedAccounts,
  upsertSavedAccount,
} from "@/lib/saved-accounts";
import { useTheme } from "@/hooks/useTheme";

type Point = { x: number; y: number };
const ENTRANCES: Point[] = [
  { x: 64, y: -42 },
  { x: -64, y: -42 },
  { x: 64, y: 42 },
  { x: -64, y: 42 },
  { x: 0, y: -70 },
  { x: 0, y: 70 },
];
const ONBOARDING = [
  {
    image: "/onboarding/person-headphones.svg",
    alt: "Человек в наушниках",
    title: "Поддержка рядом",
    body: "TeleChat You создан для общения без лишней сложности. Если понадобится помощь, полезные действия и настройки всегда под рукой.",
  },
  {
    image: "/onboarding/privacy-shield.svg",
    alt: "Щит конфиденциальности",
    title: "Защита и конфиденциальность",
    body: "Личные данные важны. Настройки приватности помогают контролировать видимость профиля, статуса в сети и отчётов о прочтении.",
  },
  {
    image: "/onboarding/comfort-smile.svg",
    alt: "Улыбающийся смайлик в наушниках",
    title: "Комфорт и удобство",
    body: "Плавные переходы, темы, чаты и медиа — чтобы общаться так, как удобно именно тебе. Удачи в использовании!",
  },
];

export default function RegisterWizard() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { theme } = useTheme();
  const [step, setStep] = useState(0);
  const [entrance, setEntrance] = useState<Point>(ENTRANCES[0]);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarToEdit, setAvatarToEdit] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [registered, setRegistered] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const registeredRef = useRef(false);
  const [slotId] = useState(() => createAccountSlotId());

  const usernameOk = /^[a-zA-Z0-9_]{3,32}$/.test(username);
  const usernameCheck = trpc.auth.checkUsername.useQuery(
    { username },
    {
      enabled: usernameOk && step === 1,
      retry: false,
      refetchOnWindowFocus: false,
    },
  );
  const register = trpc.auth.register.useMutation();
  const upload = trpc.storage.upload.useMutation();
  const createProfile = trpc.profile.setup.useMutation();

  useEffect(() => {
    if (!avatarPreview) return;
    return () => URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  useEffect(() => {
    setError("");
  }, [step, username, displayName, password, confirmPassword]);

  const goTo = (nextStep: number) => {
    setEntrance(ENTRANCES[Math.floor(Math.random() * ENTRANCES.length)]);
    setStep(Math.max(0, Math.min(7, nextStep)));
    setError("");
  };

  const back = () => {
    if (step === 0) {
      navigate("/", { replace: true });
      return;
    }
    goTo(step - 1);
  };

  const passwordReady =
    password.length >= 8 &&
    password.length <= 128 &&
    password === confirmPassword;

  const finishRegistration = async () => {
    setError("");
    const normalized = username.trim().toLowerCase();
    const existing = readSavedAccounts().find(
      (account) => account.username.toLowerCase() === normalized,
    );
    if (!existing && readSavedAccounts().length >= MAX_SAVED_ACCOUNTS) {
      setError("Сохранено максимум 5 аккаунтов. Удали один из сохранённых перед регистрацией.");
      return;
    }

    try {
      if (!registeredRef.current) {
        await register.mutateAsync({
          username: normalized,
          password,
          slotId: existing?.slotId ?? slotId,
        });
        registeredRef.current = true;
        setRegistered(true);
        upsertSavedAccount({
          slotId: existing?.slotId ?? slotId,
          username: normalized,
          displayName: displayName.trim(),
        });
      }

      let avatarKey: string | undefined;
      if (avatarFile) {
        const result = await upload.mutateAsync({
          name: (avatarFile.name || "avatar.jpg").slice(0, 190),
          contentBase64: await fileToBase64(avatarFile),
          contentType: avatarFile.type || "image/jpeg",
          folder: "avatars",
        });
        avatarKey = result.key;
      }

      await createProfile.mutateAsync({
        displayName: displayName.trim(),
        username: normalized,
        avatarKey,
      });

      upsertSavedAccount({
        slotId: existing?.slotId ?? slotId,
        username: normalized,
        displayName: displayName.trim(),
        avatarKey,
      });
      await utils.invalidate();
      navigate("/", { replace: true });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Не удалось создать аккаунт. Попробуй ещё раз.";
      setError(message);
    }
  };

  const isSaving = register.isPending || upload.isPending || createProfile.isPending;

  const floatingShapes = Array.from({ length: 9 }, (_, index) => ({
    id: index,
    size: 34 + (index % 4) * 25,
    left: (index * 17 + 7) % 96,
    top: (index * 23 + 5) % 91,
    round: index % 3 === 0 ? "38%" : index % 3 === 1 ? "50%" : "17px",
  }));

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      <motion.div
        aria-hidden="true"
        className="absolute inset-0"
        animate={{
          background: theme === "dark"
            ? "radial-gradient(circle at 14% 10%, rgba(155,139,179,.16), transparent 37%), radial-gradient(circle at 90% 86%, rgba(91,135,184,.12), transparent 38%), var(--tcy-bg)"
            : "radial-gradient(circle at 14% 10%, rgba(155,139,179,.16), transparent 37%), radial-gradient(circle at 90% 86%, rgba(225,179,104,.15), transparent 38%), var(--tcy-bg)",
        }}
        transition={{ duration: 0.75, ease: "easeInOut" }}
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {floatingShapes.map((shape) => (
          <motion.span
            key={shape.id}
            className="absolute block border"
            style={{
              width: shape.size,
              height: shape.size,
              left: shape.left + "%",
              top: shape.top + "%",
              borderRadius: shape.round,
              borderColor: "color-mix(in srgb, var(--tcy-selected-accent) 25%, transparent)",
              background: "color-mix(in srgb, var(--tcy-selected-accent) 7%, transparent)",
            }}
            animate={{
              x: [0, shape.id % 2 ? 16 : -14, 0],
              y: [0, shape.id % 3 ? -22 : 18, 0],
              rotate: [0, shape.id % 2 ? 25 : -20, 0],
            }}
            transition={{ duration: 8 + shape.id, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>

      <header className="relative z-10 flex shrink-0 items-center justify-between gap-3 px-5 pt-4 safe-top">
        <button
          type="button"
          onClick={back}
          aria-label="Назад"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border tcy-line tcy-card tcy-dim"
        >
          <ArrowLeft size={19} />
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <span className="text-[13px] font-extrabold tracking-[0.16em] tcy-text">TELECHATYOU</span>
        </div>
        <ThemeToggle />
      </header>

      <div className="relative z-10 mx-6 mt-4 h-1 overflow-hidden rounded-full" style={{ background: "var(--tcy-card-strong)" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: "var(--tcy-selected-accent)" }}
          animate={{ width: ((step + 1) / 8) * 100 + "%" }}
          transition={{ type: "spring", stiffness: 180, damping: 24 }}
        />
      </div>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-6 py-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={step}
            initial={{ opacity: 0, x: entrance.x, y: entrance.y, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: -entrance.x, y: -entrance.y, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 250, damping: 28, mass: 0.8 }}
            className="mx-auto flex w-full max-w-[460px] flex-col justify-center"
          >
            {step === 0 && (
              <div className="space-y-7">
                <div className="space-y-2 text-center">
                  <div className="mx-auto mb-7 flex h-[68px] w-[68px] items-center justify-center rounded-[24px] border tcy-line tcy-card-strong">
                    <UserRound size={30} className="tcy-accent" />
                  </div>
                  <h1 className="text-[28px] font-black leading-tight tracking-tight tcy-text">Как будет твоё имя?</h1>
                  <p className="text-[14px] leading-relaxed tcy-dim">Так к тебе будут обращаться собеседники.</p>
                </div>
                <input
                  autoFocus
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value.slice(0, 64))}
                  onKeyDown={(event) => { if (event.key === "Enter" && displayName.trim()) goTo(1); }}
                  placeholder="Твоё имя"
                  maxLength={64}
                  className="h-14 w-full rounded-[19px] border tcy-line tcy-text outline-none px-5 text-[16px] font-semibold placeholder:text-[color:var(--tcy-faint)] focus:border-[color:var(--tcy-selected-accent)]"
                  style={{ background: "var(--tcy-input)" }}
                />
              </div>
            )}

            {step === 1 && (
              <div className="space-y-7">
                <div className="space-y-2 text-center">
                  <div className="mx-auto mb-7 flex h-[68px] w-[68px] items-center justify-center rounded-[24px] border tcy-line tcy-card-strong">
                    <AtSign size={30} className="tcy-accent" />
                  </div>
                  <h1 className="text-[27px] font-black leading-tight tracking-tight tcy-text">Давай придумаем тебе Юзернейм!</h1>
                  <p className="text-[14px] leading-relaxed tcy-dim">Он поможет друзьям найти тебя в TeleChatYou.</p>
                </div>
                <div>
                  <div className="flex h-14 items-center rounded-[19px] border tcy-line px-4 focus-within:border-[color:var(--tcy-selected-accent)]" style={{ background: "var(--tcy-input)" }}>
                    <span className="mr-2 text-[16px] font-bold" style={{ color: "var(--tcy-selected-accent)" }}>@</span>
                    <input
                      autoFocus
                      value={username}
                      onChange={(event) => setUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 32))}
                      onKeyDown={(event) => { if (event.key === "Enter" && usernameOk && usernameCheck.data?.available) goTo(2); }}
                      maxLength={32}
                      placeholder="username"
                      className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-semibold tcy-text outline-none placeholder:text-[color:var(--tcy-faint)]"
                      autoComplete="username"
                    />
                  </div>
                  <div className="min-h-6 px-2 pt-2 text-[12px]">
                    {!username && <span className="tcy-faint">3–32 символа: латиница, цифры или _</span>}
                    {username && !usernameOk && <span className="tcy-danger">Минимум 3 символа: латиница, цифры или _</span>}
                    {usernameOk && usernameCheck.isFetching && <span className="tcy-dim">Проверяем доступность…</span>}
                    {usernameOk && usernameCheck.data?.available && <span className="inline-flex items-center gap-1 font-bold tcy-accent"><Check size={13} /> Свободно</span>}
                    {usernameOk && usernameCheck.data && !usernameCheck.data.available && <span className="tcy-danger">Этот юзернейм уже занят</span>}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 text-center">
                <div className="space-y-2">
                  <h1 className="text-[27px] font-black leading-tight tracking-tight tcy-text">Давай поставим тебе аватарку?</h1>
                  <p className="text-[14px] tcy-dim">Это не обязательно — её можно добавить позже.</p>
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
                <div className="flex justify-center py-2">
                  <button type="button" onClick={() => fileRef.current?.click()} className="tcy-press relative">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Предпросмотр аватарки" className="h-36 w-36 object-cover" style={{ borderRadius: "34%" }} />
                    ) : (
                      <div className="flex h-36 w-36 flex-col items-center justify-center gap-2 rounded-[34%] border-2 border-dashed tcy-line tcy-card">
                        <UserRound size={42} className="tcy-faint" />
                        <span className="text-[11px] font-semibold tcy-faint">Выбрать фото</span>
                      </div>
                    )}
                    <span className="absolute -bottom-2 -right-2 flex h-11 w-11 items-center justify-center rounded-full tcy-gradient-accent tcy-shadow-accent" style={{ color: "var(--tcy-on-accent)" }}>
                      <Camera size={18} />
                    </span>
                  </button>
                </div>
                {avatarPreview && (
                  <button type="button" className="text-[12.5px] font-bold tcy-danger" onClick={() => { setAvatarFile(null); setAvatarPreview(null); }}>
                    Удалить выбранную аватарку
                  </button>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="space-y-2 text-center">
                  <div className="mx-auto mb-7 flex h-[68px] w-[68px] items-center justify-center rounded-[24px] border tcy-line tcy-card-strong">
                    <LockKeyhole size={29} className="tcy-accent" />
                  </div>
                  <h1 className="text-[27px] font-black leading-tight tracking-tight tcy-text">Защитим твой аккаунт</h1>
                  <p className="text-[14px] leading-relaxed tcy-dim">Придумай пароль для входа с других устройств.</p>
                </div>
                <label className="block space-y-2">
                  <span className="text-[12.5px] font-bold tcy-dim">Пароль</span>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value.slice(0, 128))}
                      autoComplete="new-password"
                      placeholder="Минимум 8 символов"
                      className="h-14 w-full rounded-[19px] border tcy-line px-5 pr-12 text-[15px] font-semibold tcy-text outline-none placeholder:text-[color:var(--tcy-faint)] focus:border-[color:var(--tcy-selected-accent)]"
                      style={{ background: "var(--tcy-input)" }}
                    />
                    <button type="button" aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"} onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full tcy-faint">
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </label>
                <label className="block space-y-2">
                  <span className="text-[12.5px] font-bold tcy-dim">Повтори пароль</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value.slice(0, 128))}
                    autoComplete="new-password"
                    placeholder="Ещё раз"
                    className="h-14 w-full rounded-[19px] border tcy-line px-5 text-[15px] font-semibold tcy-text outline-none placeholder:text-[color:var(--tcy-faint)] focus:border-[color:var(--tcy-selected-accent)]"
                    style={{ background: "var(--tcy-input)" }}
                  />
                </label>
                <p className="px-2 text-[12px] tcy-dim">
                  {password.length < 8
                    ? "Используй не менее 8 символов."
                    : confirmPassword && password !== confirmPassword
                      ? "Пароли пока не совпадают."
                      : passwordReady
                        ? "Пароль подходит."
                        : "Повтори пароль, чтобы проверить его."}
                </p>
              </div>
            )}

            {step >= 4 && step <= 6 && (
              <div className="flex flex-col items-center text-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 240, damping: 22 }}
                  className="mb-7 flex h-[min(55vw,260px)] w-[min(55vw,260px)] items-center justify-center overflow-hidden rounded-[30px] border tcy-line bg-white p-2"
                >
                  <img
                    src={ONBOARDING[step - 4].image}
                    alt={ONBOARDING[step - 4].alt}
                    className="h-full w-full object-contain"
                    draggable={false}
                  />
                </motion.div>
                <div className="max-w-[380px] space-y-3">
                  <h1 className="text-[27px] font-black leading-tight tracking-tight tcy-text">{ONBOARDING[step - 4].title}</h1>
                  <p className="text-[14.5px] leading-[1.75] tcy-dim">{ONBOARDING[step - 4].body}</p>
                </div>
              </div>
            )}

            {step === 7 && (
              <div className="flex flex-col items-center text-center">
                <motion.div
                  initial={{ scale: 0.65, rotate: -12, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 220, damping: 19 }}
                  className="mb-8 flex h-[84px] w-[84px] items-center justify-center rounded-[28px] tcy-gradient-accent"
                  style={{ color: "var(--tcy-on-accent)" }}
                >
                  <Sparkles size={37} />
                </motion.div>
                <h1 className="max-w-[380px] break-words text-[30px] font-black leading-tight tracking-tight tcy-text">
                  Добро пожаловать, {displayName.trim()}!
                </h1>
                <p className="mt-4 max-w-[320px] text-[14.5px] leading-relaxed tcy-dim">Твой профиль готов. Начнём общаться?</p>
                {registered && error && <p className="mt-3 text-[12px] font-semibold tcy-danger">{error}</p>}
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </main>

      <footer className="relative z-10 shrink-0 px-5 pb-5 pt-2 safe-bottom">
        <TcButton
          size="lg"
          loading={step === 7 && isSaving}
          disabled={
            (step === 0 && !displayName.trim()) ||
            (step === 1 && (!usernameOk || usernameCheck.isFetching || !usernameCheck.data?.available)) ||
            (step === 3 && !passwordReady) ||
            (step === 7 && isSaving)
          }
          onClick={() => {
            if (step === 0) goTo(1);
            else if (step === 1) goTo(2);
            else if (step === 2) goTo(3);
            else if (step === 3) goTo(4);
            else if (step === 4 || step === 5) goTo(step + 1);
            else if (step === 6) goTo(7);
            else void finishRegistration();
          }}
        >
          {step === 0
            ? "Дальше"
            : step === 1
              ? "Готово!"
              : step === 2
                ? "Завершить!"
                : step === 3
                  ? "Дальше"
                  : step === 4 || step === 5
                    ? "Дальше"
                    : step === 6
                      ? "Завершить!"
                      : isSaving
                        ? "Создаём аккаунт…"
                        : "Войти в TeleChatYou!"}
          {!(step === 7 && isSaving) && <ArrowRight size={18} />}
        </TcButton>
        {error && step !== 7 && (
          <p role="alert" className="mx-auto mt-3 max-w-[420px] text-center text-[12.5px] font-semibold tcy-danger">{error}</p>
        )}
        {error && step === 7 && !registered && (
          <p role="alert" className="mx-auto mt-3 max-w-[420px] text-center text-[12.5px] font-semibold tcy-danger">{error}</p>
        )}
        {step === 0 && (
          <p className="mt-4 text-center text-[11.5px] tcy-faint">
            Уже есть аккаунт?{" "}
            <button type="button" onClick={() => navigate("/login")} className="font-bold tcy-accent">Войти</button>
          </p>
        )}
      </footer>

      <AvatarEditor
        file={avatarToEdit}
        onCancel={() => setAvatarToEdit(null)}
        onSave={(editedFile) => {
          setAvatarFile(editedFile);
          setAvatarPreview(URL.createObjectURL(editedFile));
        }}
        title="Настроим аватарку"
        subtitle="Обрежь фото и при желании добавь детали"
        saveLabel="Использовать аватарку"
      />
    </div>
  );
}
