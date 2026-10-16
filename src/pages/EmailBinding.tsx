import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router";
import { ArrowLeft, Check, Delete, Mail } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { TcButton } from "@/components/TcButton";
import { TcInput } from "@/components/TcInput";

type Step = "email" | "code" | "success";

const stepMotion: Record<Step, {
  initial: { opacity: number; x: number; y: number; scale: number };
  exit: { opacity: number; x: number; y: number; scale: number };
}> = {
  email: {
    initial: { opacity: 0, x: -42, y: 38, scale: 0.97 },
    exit: { opacity: 0, x: -35, y: -30, scale: 0.97 },
  },
  code: {
    initial: { opacity: 0, x: 42, y: 38, scale: 0.97 },
    exit: { opacity: 0, x: 36, y: -30, scale: 0.97 },
  },
  success: {
    initial: { opacity: 0, x: -42, y: -38, scale: 0.97 },
    exit: { opacity: 0, x: 42, y: 32, scale: 0.97 },
  },
};

export default function EmailBinding() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const emailStatus = trpc.auth.emailStatus.useQuery(undefined, { staleTime: 0 });
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [verifiedCode, setVerifiedCode] = useState<boolean | null>(null);
  const verificationAttempted = useRef("");
  const verificationInFlight = useRef(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!email && emailStatus.data?.email) setEmail(emailStatus.data.email);
  }, [emailStatus.data?.email, email]);

  const requestEmailVerification = trpc.auth.requestEmailVerification.useMutation({
    onSuccess: async (result, variables) => {
      setError("");
      if (result.alreadyVerified) {
        await utils.auth.emailStatus.invalidate();
        setStep("success");
        return;
      }
      setEmail(variables.email.trim().toLowerCase());
      setCode("");
      setVerifiedCode(null);
      verificationAttempted.current = "";
      setCurrentPassword("");
      setStep("code");
    },
    onError: (cause) => setError(cause.message),
  });

  const verifyLinkedEmail = trpc.auth.verifyLinkedEmail.useMutation({
    onSuccess: async () => {
      setVerifiedCode(true);
      setError("");
      await utils.auth.emailStatus.invalidate();
    },
    onError: (cause) => {
      setVerifiedCode(false);
      setError(cause.message);
    },
    onSettled: () => {
      verificationInFlight.current = false;
    },
  });

  const verifyCode = (value: string) => {
    if (value.length !== 6 || verificationInFlight.current || verificationAttempted.current === value) return;
    verificationAttempted.current = value;
    verificationInFlight.current = true;
    setVerifiedCode(null);
    setError("");
    verifyLinkedEmail.mutate({ code: value });
  };

  const addDigit = (digit: string) => {
    if (step !== "code" || verifyLinkedEmail.isPending) return;
    if (verifiedCode === true) return;

    let current = code;
    if (verifiedCode === false) {
      current = "";
      setCode("");
      setVerifiedCode(null);
      setError("");
      verificationAttempted.current = "";
    }
    if (current.length >= 6) return;
    const next = current + digit;
    setCode(next);
    if (next.length === 6) verifyCode(next);
  };

  const removeDigit = () => {
    if (verifyLinkedEmail.isPending || verifiedCode === true) return;
    if (verifiedCode === false) {
      setCode("");
      setVerifiedCode(null);
      setError("");
      verificationAttempted.current = "";
      return;
    }
    setCode((value) => value.slice(0, -1));
    verificationAttempted.current = "";
  };

  const requestCode = () => {
    setError("");
    if (!email.trim()) {
      setError("Введи адрес электронной почты.");
      return;
    }
    requestEmailVerification.mutate({
      email: email.trim().toLowerCase(),
      currentPassword:
        emailStatus.data?.verified && email.trim().toLowerCase() !== emailStatus.data.email?.toLowerCase()
          ? currentPassword
          : undefined,
    });
  };

  const finishCodeStep = () => {
    if (verifiedCode === true) {
      setStep("success");
      return;
    }
    if (verifiedCode === false) {
      setCode("");
      setVerifiedCode(null);
      setError("Введи новый код из письма.");
      verificationAttempted.current = "";
    }
  };

  const isChangingVerifiedEmail = Boolean(
    emailStatus.data?.verified &&
    email.trim().toLowerCase() !== emailStatus.data.email?.toLowerCase(),
  );
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const codeBusy = verifyLinkedEmail.isPending;

  return (
    <div className="relative flex h-full flex-col overflow-hidden tcy-bg">
      <header className="relative z-10 flex shrink-0 items-center gap-3 px-4 pt-4 safe-top pb-3">
        <button
          type="button"
          aria-label="Назад"
          onClick={() => step === "email" ? navigate("/settings") : step === "code" ? (setStep("email"), setError("")) : navigate("/settings")}
          className="tcy-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full border tcy-line tcy-card tcy-dim"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-[19px] font-extrabold tcy-text">Почта для восстановления</h1>
      </header>

      <div className="relative min-h-0 flex-1 overflow-y-auto no-scrollbar px-4 pb-8">
        <AnimatePresence mode="wait" initial={false}>
          {step === "email" && (
            <motion.section
              key="email"
              initial={stepMotion.email.initial}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={stepMotion.email.exit}
              transition={{ type: "spring", stiffness: 250, damping: 28 }}
              className="flex min-h-[min(72vh,650px)] flex-col justify-center"
            >
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[23px] border tcy-line tcy-card-strong tcy-accent">
                <Mail size={29} />
              </div>
              <h2 className="mx-auto max-w-[340px] text-center text-[23px] font-extrabold leading-tight tcy-text">
                Давай привяжем почту, чтобы не потерять твой аккаунт!
              </h2>
              <p className="mx-auto mt-3 max-w-[310px] text-center text-[13px] leading-relaxed tcy-dim">
                Отправим на неё одноразовый код. Подтверждённая почта поможет восстановить доступ к аккаунту.
              </p>

              <div className="mt-8 space-y-3">
                {!emailStatus.data?.deliveryConfigured && (
                  <p className="rounded-[15px] border border-rose-400/30 bg-rose-500/10 p-3 text-[12px] leading-relaxed tcy-danger">
                    Отправка писем пока не настроена на сервере.
                  </p>
                )}
                <label className="block space-y-2">
                  <span className="px-1 text-[12.5px] font-bold tcy-dim">Твоя почта</span>
                  <TcInput
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError("");
                    }}
                    maxLength={320}
                    placeholder="name@example.com"
                  />
                </label>
                {isChangingVerifiedEmail && (
                  <label className="block space-y-2">
                    <span className="px-1 text-[12.5px] font-bold tcy-dim">Текущий пароль</span>
                    <TcInput
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      maxLength={128}
                      placeholder="Пароль от аккаунта"
                    />
                  </label>
                )}
                {error && <p role="alert" className="text-[12px] leading-relaxed tcy-danger">{error}</p>}
                <TcButton
                  size="lg"
                  className="w-full"
                  loading={requestEmailVerification.isPending}
                  disabled={
                    !emailStatus.data?.deliveryConfigured ||
                    !emailLooksValid ||
                    requestEmailVerification.isPending ||
                    emailStatus.isLoading ||
                    (isChangingVerifiedEmail && !currentPassword)
                  }
                  onClick={requestCode}
                >
                  <Mail size={17} /> Отправить код
                </TcButton>
              </div>
            </motion.section>
          )}

          {step === "code" && (
            <motion.section
              key="code"
              initial={stepMotion.code.initial}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={stepMotion.code.exit}
              transition={{ type: "spring", stiffness: 250, damping: 28 }}
              className="mx-auto flex min-h-[min(72vh,650px)] w-full max-w-[390px] flex-col justify-center"
            >
              <h2 className="text-center text-[19px] font-extrabold leading-snug tcy-text">
                Введи код с почты
              </h2>
              <p className="mx-auto mt-2 max-w-[330px] text-center text-[12.5px] leading-relaxed tcy-dim">
                Не нашёл? Загляни в папку «СПАМ». Код отправлен на <span className="font-bold tcy-text">{email}</span>.
              </p>

              <div className="relative mt-6 flex justify-center gap-2.5" onClick={() => codeInputRef.current?.focus()}>
                {Array.from({ length: 6 }, (_, index) => {
                  const hasDigit = index < code.length;
                  const isFeedback = verifiedCode !== null && code.length === 6;
                  const feedbackColor = verifiedCode === true ? "#26b36a" : "#ef4444";
                  return (
                    <motion.div
                      key={index}
                      animate={{
                        backgroundColor: isFeedback
                          ? feedbackColor
                          : hasDigit
                            ? "color-mix(in srgb, var(--tcy-selected-accent) 24%, var(--tcy-card))"
                            : "var(--tcy-card)",
                        borderColor: isFeedback
                          ? feedbackColor
                          : hasDigit
                            ? "var(--tcy-selected-accent)"
                            : "var(--tcy-line-strong)",
                        color: isFeedback ? "#ffffff" : "var(--tcy-text)",
                        scale: isFeedback ? [1, 1.06, 1] : 1,
                      }}
                      transition={{ duration: 0.22, delay: isFeedback ? index * 0.09 : 0 }}
                      className="flex h-12 min-w-0 flex-1 max-w-[48px] items-center justify-center rounded-[15px] border text-[20px] font-extrabold tabular-nums"
                    >
                      {code[index] ?? ""}
                    </motion.div>
                  );
                })}
                <input
                  ref={codeInputRef}
                  aria-label="Шестизначный код с почты"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(event) => {
                    const next = event.target.value.replace(/[^0-9]/g, "").slice(0, 6);
                    if (verifiedCode === false) {
                      setVerifiedCode(null);
                      setError("");
                      verificationAttempted.current = "";
                    }
                    setCode(next);
                    if (next.length === 6) verifyCode(next);
                  }}
                  className="absolute inset-0 h-full w-full cursor-text opacity-0"
                  style={{ fontSize: "16px" }}
                />
              </div>

              <div
                className="mx-auto mt-5 w-full rounded-[25px] border p-3"
                style={{
                  borderColor: "var(--tcy-line-strong)",
                  background: "linear-gradient(150deg, color-mix(in srgb, var(--tcy-solid) 94%, var(--tcy-selected-accent) 6%), var(--tcy-bg))",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,.06), 0 12px 28px -22px rgba(0,0,0,.8)",
                }}
                aria-label="Цифровая клавиатура"
              >
                <div className="grid grid-cols-3 gap-2">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "delete"].map((key) => (
                    <motion.button
                      key={key}
                      type="button"
                      whileTap={{ scale: 0.93 }}
                      disabled={codeBusy || verifiedCode === true}
                      onClick={() => key === "delete" ? removeDigit() : key === "clear" ? (setCode(""), setVerifiedCode(null), setError(""), verificationAttempted.current = "") : addDigit(key)}
                      className="flex h-[49px] items-center justify-center rounded-[15px] border text-[20px] font-semibold tcy-text disabled:opacity-40"
                      style={{
                        borderColor: "var(--tcy-line)",
                        background: key === "clear" ? "var(--tcy-card)" : "color-mix(in srgb, var(--tcy-card-strong) 82%, transparent)",
                      }}
                    >
                      {key === "delete" ? <Delete size={20} /> : key === "clear" ? <span className="text-[12px] font-bold">Сброс</span> : key}
                    </motion.button>
                  ))}
                </div>
              </div>

              {verifyLinkedEmail.isPending && (
                <p className="mt-4 text-center text-[12px] font-semibold tcy-accent">Проверяем код…</p>
              )}
              {error && <p role="alert" className="mt-3 text-center text-[12px] leading-relaxed tcy-danger">{error}</p>}
              <div className="mt-5">
                <TcButton
                  size="lg"
                  className="w-full"
                  disabled={verifiedCode === null || codeBusy}
                  onClick={finishCodeStep}
                >
                  {verifiedCode === false ? "Завершить" : verifiedCode === true ? "Завершить" : "Завершить"}
                </TcButton>
              </div>
            </motion.section>
          )}

          {step === "success" && (
            <motion.section
              key="success"
              initial={stepMotion.success.initial}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={stepMotion.success.exit}
              transition={{ type: "spring", stiffness: 250, damping: 28 }}
              className="flex min-h-[min(72vh,650px)] flex-col items-center justify-center text-center"
            >
              <motion.div
                initial={{ scale: 0.55, opacity: 0, rotate: -14 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 230, damping: 17 }}
                className="mb-6 flex h-24 w-24 items-center justify-center rounded-full"
                style={{ color: "#ffffff", background: "linear-gradient(145deg, #2dc779, #148d54)", boxShadow: "0 18px 45px -22px rgba(38,179,106,.8)" }}
              >
                <Check size={44} strokeWidth={3} />
              </motion.div>
              <h2 className="max-w-[340px] text-center text-[24px] font-extrabold leading-tight tcy-text">
                Ты успешно привязал почту!
              </h2>
              <p className="mt-3 text-[13px] tcy-dim">{email || emailStatus.data?.email}</p>
              <div className="mt-8 w-full max-w-[300px]">
                <TcButton size="lg" className="w-full" onClick={() => navigate("/settings", { replace: true })}>
                  Выйти
                </TcButton>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
