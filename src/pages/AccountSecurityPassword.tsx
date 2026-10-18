import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Delete, Fingerprint, KeyRound, ShieldCheck } from "lucide-react";
import { trpc } from "@/providers/trpc";

type PasswordFormat = "digital" | "graphical";
type WizardStep = "create" | "confirm" | "success";
type EntryFeedback = "neutral" | "error" | "success";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "delete"];

function Header({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack: () => void }) {
  return (
    <header className="safe-top shrink-0 flex items-center gap-3 px-4 py-3 border-b tcy-line">
      <button
        type="button"
        onClick={onBack}
        aria-label="Назад"
        className="tcy-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full tcy-card border tcy-line tcy-dim"
      >
        <ArrowLeft size={19} />
      </button>
      <div className="min-w-0">
        <h1 className="text-[17px] font-extrabold tcy-text">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[12px] tcy-faint">{subtitle}</p>}
      </div>
    </header>
  );
}

export default function AccountSecurityPassword() {
  const navigate = useNavigate();
  const { format: formatParam } = useParams<{ format?: string }>();
  const format: PasswordFormat | null =
    formatParam === "digital" || formatParam === "graphical" ? formatParam : null;
  const utils = trpc.useUtils();
  const [step, setStep] = useState<WizardStep>("create");
  const [entered, setEntered] = useState("");
  const [firstValue, setFirstValue] = useState("");
  const [pattern, setPattern] = useState<number[]>([]);
  const [firstPattern, setFirstPattern] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<EntryFeedback>("neutral");
  const [errorMessage, setErrorMessage] = useState("");

  const createPassword = trpc.auth.createAccountSecurityPassword.useMutation();
  const status = trpc.auth.accountSecurityPasswordStatus.useQuery();

  const returnToSecurity = () => navigate("/settings/security");

  if (formatParam && !format) {
    return <Navigate to="/settings/security/create-password" replace />;
  }

  const title = format === "digital" ? "Цифровой пароль" : "Графический пароль";
  const addDigit = (digit: string) => {
    if (step === "success" || entered.length >= 6 || createPassword.isPending) return;
    setEntered((current) => current + digit);
    setFeedback("neutral");
    setErrorMessage("");
  };

  const removeDigit = () => {
    setEntered((current) => current.slice(0, -1));
    setFeedback("neutral");
    setErrorMessage("");
  };

  const addPatternNode = (node: number) => {
    if (step === "success" || createPassword.isPending) return;
    setPattern((current) => current.includes(node) || current.length >= 9 ? current : [...current, node]);
    setFeedback("neutral");
    setErrorMessage("");
  };

  const resetPattern = () => {
    setPattern([]);
    setFeedback("neutral");
    setErrorMessage("");
  };

  const currentValue = format === "digital" ? entered : pattern.join("-");
  const canContinue = step === "create"
    ? (format === "digital" ? entered.length === 6 : pattern.length >= 4)
    : step === "confirm"
      ? (format === "digital" ? entered.length === 6 : pattern.length >= 4)
      : true;

  const continueWizard = async () => {
    setErrorMessage("");
    if (step === "create") {
      setFirstValue(currentValue);
      if (format === "graphical") setFirstPattern(pattern);
      setEntered("");
      setPattern([]);
      setFeedback("neutral");
      setStep("confirm");
      return;
    }

    if (step !== "confirm") return;
    if (currentValue !== firstValue) {
      setFeedback("error");
      setEntered("");
      setPattern([]);
      setErrorMessage(format === "digital" ? "Коды не совпали. Повтори ввод." : "Ключи не совпали. Нарисуй ключ ещё раз.");
      return;
    }

    try {
      setFeedback("success");
      await createPassword.mutateAsync({
        format: format!,
        password: currentValue,
      });
      await utils.auth.accountSecurityPasswordStatus.invalidate();
      setStep("success");
      setFeedback("success");
      setEntered(format === "digital" ? firstValue : "");
      setPattern(format === "graphical" ? firstPattern : []);
    } catch (error) {
      setFeedback("neutral");
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить пароль. Попробуй ещё раз.");
    }
  };

  const finish = () => {
    void utils.auth.accountSecurityPasswordStatus.invalidate();
    returnToSecurity();
  };

  if (!format) {
    return (
      <div className="relative flex h-full flex-col tcy-solid" style={{ background: "var(--tcy-bg)" }}>
        <Header title="Создать пароль" subtitle="Выбери формат защиты" onBack={returnToSecurity} />
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <div className="mx-auto flex w-full max-w-[440px] flex-col gap-4">
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] tcy-card border tcy-line">
                <ShieldCheck size={30} className="tcy-accent" />
              </div>
              <h2 className="text-[20px] font-extrabold tcy-text">Каков формат пароля?</h2>
              <p className="mx-auto mt-2 max-w-[300px] text-[13px] leading-relaxed tcy-dim">
                Выбери, как будет выглядеть дополнительный пароль для твоего аккаунта.
              </p>
              {status.data?.configured && (
                <p className="mt-3 text-[12px] font-semibold" style={{ color: "#2eae78" }}>
                  Пароль уже создан. Здесь можно задать новый.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate("/settings/security/create-password/digital")}
              className="tcy-press flex items-center gap-4 rounded-[22px] border tcy-line tcy-card p-4 text-left"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] tcy-card-strong">
                <KeyRound size={23} className="tcy-accent" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold tcy-text">Цифровой</span>
                <span className="mt-1 block text-[12px] leading-relaxed tcy-dim">6 цифр на цифровой панели</span>
              </span>
              <span className="tcy-faint"><ArrowLeft className="rotate-180" size={17} /></span>
            </button>
            <button
              type="button"
              onClick={() => navigate("/settings/security/create-password/graphical")}
              className="tcy-press flex items-center gap-4 rounded-[22px] border tcy-line tcy-card p-4 text-left"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] tcy-card-strong">
                <Fingerprint size={23} className="tcy-accent" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold tcy-text">Графический</span>
                <span className="mt-1 block text-[12px] leading-relaxed tcy-dim">Ключ из точек на сетке 3×3</span>
              </span>
              <span className="tcy-faint"><ArrowLeft className="rotate-180" size={17} /></span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="relative flex h-full flex-col tcy-solid" style={{ background: "var(--tcy-bg)" }}>
        <Header title={title} subtitle="Защита аккаунта" onBack={returnToSecurity} />
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-6 text-center">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 19 }}
            className="mb-6 flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: "rgba(46,174,120,.14)", color: "#2eae78" }}
          >
            <Check size={38} strokeWidth={2.5} />
          </motion.div>
          {format === "digital" && (
            <div className="mb-6 flex items-center justify-center gap-2">
              {Array.from({ length: 6 }, (_, index) => (
                <span
                  key={index}
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 text-[15px] font-bold"
                  style={{ borderColor: "#2eae78", color: "#2eae78", background: "rgba(46,174,120,.08)" }}
                >
                  {firstValue[index] ?? ""}
                </span>
              ))}
            </div>
          )}
          <h2 className="text-[21px] font-extrabold tcy-text">Вы успешно создали пароль!</h2>
          <p className="mt-2 max-w-[310px] text-[13px] leading-relaxed tcy-dim">
            Пароль сохранён для твоего аккаунта. Не передавай его другим людям.
          </p>
        </div>
        <footer className="safe-bottom shrink-0 border-t tcy-line px-4 py-3">
          <button
            type="button"
            onClick={finish}
            className="tcy-press mx-auto flex h-12 w-full max-w-[480px] items-center justify-center gap-2 rounded-full tcy-gradient-accent text-[14px] font-extrabold"
            style={{ color: "var(--tcy-on-accent)" }}
          >
            Завершить
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col tcy-solid" style={{ background: "var(--tcy-bg)" }}>
      <Header
        title={title}
        subtitle={step === "create" ? "Придумай пароль" : "Повтори пароль"}
        onBack={() => {
          if (step === "confirm") {
            setStep("create");
            setEntered("");
            setPattern([]);
            setFeedback("neutral");
            setErrorMessage("");
          } else {
            navigate("/settings/security/create-password");
          }
        }}
      />

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto flex w-full max-w-[380px] flex-col items-center">
          <div className="pt-2 text-center">
            <h2 className="text-[19px] font-extrabold tcy-text">
              {step === "create"
                ? format === "digital" ? "Придумай 6-значный пароль" : "Нарисуй графический ключ"
                : format === "digital" ? "Повтори пароль" : "Повтори графический ключ"}
            </h2>
            <p className="mx-auto mt-2 max-w-[300px] text-[12.5px] leading-relaxed tcy-dim">
              {format === "digital"
                ? "Нажимай цифры на панели ниже."
                : "Выбери не менее 4 точек из сетки. Порядок важен."}
            </p>
          </div>

          {format === "digital" ? (
            <>
              <div className="mt-7 flex h-12 items-center justify-center gap-3" aria-label={`Введено ${entered.length} из 6 цифр`}>
                {Array.from({ length: 6 }, (_, index) => (
                  <span
                    key={index}
                    className="flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors duration-150"
                    style={{
                      borderColor: feedback === "success" ? "#2eae78" : feedback === "error" ? "var(--tcy-danger)" : entered.length > index ? "var(--tcy-selected-accent)" : "var(--tcy-line)",
                      background: entered.length > index ? (feedback === "error" ? "transparent" : "var(--tcy-card-strong)") : "transparent",
                    }}
                  >
                    <span
                      className="text-[14px] font-bold tabular-nums"
                      style={{ color: feedback === "error" ? "var(--tcy-danger)" : feedback === "success" ? "#2eae78" : "var(--tcy-text)" }}
                    >
                      {entered[index] ?? ""}
                    </span>
                  </span>
                ))}
              </div>
              <div className="mt-6 grid w-full max-w-[300px] grid-cols-3 gap-2.5">
                {DIGITS.map((key, index) => (
                  key === "" ? <span key={`blank-${index}`} className="h-[58px]" /> : (
                    <button
                      key={key}
                      type="button"
                      disabled={createPassword.isPending || (key !== "delete" && entered.length >= 6)}
                      onClick={() => key === "delete" ? removeDigit() : addDigit(key)}
                      aria-label={key === "delete" ? "Удалить последнюю цифру" : key}
                      className="tcy-press flex h-[58px] items-center justify-center rounded-[18px] border tcy-line tcy-card text-[22px] font-semibold tcy-text disabled:opacity-35"
                    >
                      {key === "delete" ? <Delete size={21} className="tcy-dim" /> : key}
                    </button>
                  )
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="mt-6 w-full max-w-[300px]">
                <div className="relative aspect-square w-full overflow-hidden rounded-[26px] border tcy-line tcy-card p-1">
                  <svg viewBox="0 0 300 300" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
                    {pattern.length > 1 && (
                      <polyline
                        points={pattern.map((node) => {
                          const point = node - 1;
                          return `${50 + (point % 3) * 100},${50 + Math.floor(point / 3) * 100}`;
                        }).join(" ")}
                        fill="none"
                        stroke={feedback === "error" ? "var(--tcy-danger)" : feedback === "success" ? "#2eae78" : "var(--tcy-selected-accent)"}
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.8"
                      />
                    )}
                  </svg>
                  <div className="relative grid h-full w-full grid-cols-3 grid-rows-3">
                    {Array.from({ length: 9 }, (_, index) => {
                      const node = index + 1;
                      const selected = pattern.includes(node);
                      return (
                        <button
                          key={node}
                          type="button"
                          onClick={() => addPatternNode(node)}
                          disabled={createPassword.isPending || pattern.length >= 9}
                          aria-label={`Точка ${node}`}
                          className="flex items-center justify-center rounded-xl disabled:cursor-default"
                        >
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors"
                            style={{
                              borderColor: feedback === "error" ? "var(--tcy-danger)" : selected ? feedback === "success" ? "#2eae78" : "var(--tcy-selected-accent)" : "var(--tcy-line)",
                              background: selected ? feedback === "success" ? "#2eae78" : feedback === "error" ? "var(--tcy-danger)" : "var(--tcy-selected-accent)" : "var(--tcy-bg)",
                            }}
                          >
                            {selected && <span className="h-2 w-2 rounded-full" style={{ background: "#fff" }} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11.5px] tcy-faint">Выбрано точек: {pattern.length}</span>
                  <button type="button" onClick={resetPattern} className="text-[12px] font-bold tcy-accent">Очистить</button>
                </div>
              </div>
            </>
          )}

          {errorMessage && (
            <p role="alert" className="mt-4 text-center text-[12px] font-semibold tcy-danger">{errorMessage}</p>
          )}
        </div>
      </div>

      <footer className="safe-bottom shrink-0 border-t tcy-line px-4 py-3">
        <button
          type="button"
          disabled={!canContinue || createPassword.isPending}
          onClick={() => void continueWizard()}
          className="tcy-press mx-auto flex h-12 w-full max-w-[480px] items-center justify-center gap-2 rounded-full tcy-gradient-accent text-[14px] font-extrabold disabled:opacity-45"
          style={{ color: "var(--tcy-on-accent)" }}
        >
          {createPassword.isPending ? "Сохранение…" : "Далее"}
        </button>
      </footer>
    </div>
  );
}
