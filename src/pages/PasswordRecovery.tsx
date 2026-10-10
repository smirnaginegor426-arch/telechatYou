import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router";
import { ArrowLeft, ArrowRight, AtSign, Check, Copy, KeyRound } from "lucide-react";
import { Logo } from "@/components/Logo";
import { TcButton } from "@/components/TcButton";
import { TcInput } from "@/components/TcInput";
import { trpc } from "@/providers/trpc";
import { copyText } from "@/lib/clipboard";

type Step = "username" | "code" | "reset";
type Issued = { code: string; expiresAt: string };

const slide = {
  initial: { x: 60, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: -60, opacity: 0 },
  transition: { type: "spring" as const, stiffness: 320, damping: 32 },
};

const STEP_INDEX: Record<Step, number> = { username: 0, code: 1, reset: 2 };

export default function PasswordRecovery() {
  const navigate = useNavigate();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState("");
  const [issued, setIssued] = useState<Issued | null>(null);
  const [copied, setCopied] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const request = trpc.auth.requestRecoveryCode.useMutation({
    onSuccess: (data) => {
      setIssued(data);
      setCopied(false);
      setError("");
      setStep("code");
    },
    onError: (e) => setError(e.message),
  });

  const reset = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      navigate("/login", {
        replace: true,
        state: { notice: "Пароль изменён. Войдите с новым паролем." },
      });
    },
    onError: (e) => setError(e.message),
  });

  const usernameOk = /^[a-zA-Z0-9_]{3,32}$/.test(username);
  const codeOk = /^[A-Z]{3}[1-9]-[A-Z]{3}[1-9]-[A-Z]{4}[1-9]$/.test(codeInput.trim());

  const onBack = () => {
    setError("");
    if (step === "username") navigate("/login");
    else if (step === "code") setStep("username");
    else setStep("code");
  };

  const handleCopy = async () => {
    if (!issued) return;
    const ok = await copyText(issued.code);
    if (ok) {
      setCopied(true);
      setError("");
    } else {
      setError("Не удалось скопировать автоматически. Выделите код и скопируйте вручную.");
    }
  };

  const submitReset = () => {
    setError("");
    if (!codeOk) return setError("Введите код в формате AAA1-BBB1-CCCC1");
    if (newPassword.length < 8) return setError("Пароль должен быть не короче 8 символов");
    if (newPassword !== confirm) return setError("Пароли не совпадают");
    reset.mutate({ username, code: codeInput.trim(), newPassword });
  };

  const expiresText = issued
    ? new Date(issued.expiresAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : "";

  const steps: Record<Step, ReactNode> = {
    username: (
      <div className="space-y-6">
        <div>
          <h2 className="text-[24px] font-extrabold tcy-text">Восстановление пароля</h2>
          <p className="text-[13.5px] tcy-dim mt-1.5">
            {me.data
              ? "Введите ваш username, чтобы создать одноразовый код для своего аккаунта."
              : "Сначала войдите в свой аккаунт. Если забыли пароль, используйте вход через Kimi, затем вернитесь на эту страницу."}
          </p>
        </div>
        {me.isLoading ? (
          <p className="text-[13.5px] tcy-dim">Проверяем авторизацию...</p>
        ) : !me.data ? (
          <div className="space-y-4">
            <p className="text-[13.5px] tcy-dim">
              Получить код можно только для аккаунта, в который вы вошли. На экране входа выберите «Войти через Kimi», затем снова откройте эту страницу.
            </p>
            <TcButton size="lg" onClick={() => navigate("/login")}>
              Перейти ко входу <ArrowRight size={18} />
            </TcButton>
          </div>
        ) : (
          <>
            <div className="relative">
              <AtSign size={18} className="absolute left-4 top-1/2 -translate-y-1/2 tcy-faint" />
              <TcInput
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                placeholder="username"
                maxLength={32}
                className="pl-11"
              />
            </div>
            <TcButton
              size="lg"
              disabled={!usernameOk}
              loading={request.isPending}
              onClick={() => {
                setError("");
                request.mutate({ username });
              }}
            >
              Получить код <ArrowRight size={18} />
            </TcButton>
          </>
        )}
      </div>
    ),

    code: issued ? (
      <div className="space-y-6">
        <div>
          <h2 className="text-[24px] font-extrabold tcy-text">Ваш код</h2>
          <p className="text-[13.5px] tcy-dim mt-1.5">
            Код одноразовый и действует до {expiresText}. Скопируйте его и продолжите.
          </p>
        </div>
        <div className="rounded-[22px] tcy-card border tcy-line px-4 py-5 text-center">
          <span
            className="font-mono text-[20px] font-bold tracking-[0.12em] tcy-text select-all break-all"
            data-testid="recovery-code"
          >
            {issued.code}
          </span>
        </div>
        <TcButton variant="soft" size="lg" onClick={handleCopy}>
          {copied ? (
            <>
              <Check size={18} /> Скопировано
            </>
          ) : (
            <>
              <Copy size={18} /> Скопировать
            </>
          )}
        </TcButton>
        {copied && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <TcButton size="lg" onClick={() => setStep("reset")}>
              Продолжить <ArrowRight size={18} />
            </TcButton>
          </motion.div>
        )}
      </div>
    ) : null,

    reset: (
      <div className="space-y-5">
        <div>
          <h2 className="text-[24px] font-extrabold tcy-text">Новый пароль</h2>
          <p className="text-[13.5px] tcy-dim mt-1.5">
            Вставьте скопированный код и придумайте новый пароль.
          </p>
        </div>
        <div className="relative">
          <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 tcy-faint" />
          <TcInput
            autoFocus
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            placeholder="AAA1-BBB1-CCCC1"
            maxLength={15}
            className="pl-11 font-mono tracking-[0.08em]"
          />
        </div>
        <TcInput
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Новый пароль (от 8 символов)"
          maxLength={128}
        />
        <TcInput
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Повторите пароль"
          maxLength={128}
        />
        <TcButton size="lg" loading={reset.isPending} onClick={submitReset}>
          Сохранить пароль <Check size={18} />
        </TcButton>
      </div>
    ),
  };

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      <div className="relative z-10 px-6 pt-6 safe-top flex items-center justify-between">
        <button
          onClick={onBack}
          className="tcy-press w-10 h-10 rounded-full tcy-card flex items-center justify-center tcy-dim"
          aria-label="Назад"
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
                width: i === STEP_INDEX[step] ? 22 : 8,
                background: i <= STEP_INDEX[step] ? "var(--tcy-accent)" : "var(--tcy-card-strong)",
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-center px-7 pb-16 overflow-y-auto no-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div key={step} {...slide}>
            {steps[step]}
          </motion.div>
        </AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 text-[13px] tcy-danger text-center font-semibold"
          >
            {error}
          </motion.p>
        )}
      </div>
    </div>
  );
}
