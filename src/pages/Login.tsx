import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router";
import { ArrowLeft, LockKeyhole, UserRound, UsersRound } from "lucide-react";
import { createAccountSlotId, MAX_SAVED_ACCOUNTS, readSavedAccounts, upsertSavedAccount } from "@/lib/saved-accounts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TcButton } from "@/components/TcButton";
import { TcInput } from "@/components/TcInput";
import { Logo } from "@/components/Logo";
import { trpc } from "@/providers/trpc";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAddingAccount = new URLSearchParams(location.search).get("addAccount") === "1";
  const [newSlotId] = useState(() => createAccountSlotId());
  const savedAccounts = readSavedAccounts();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const afterAuth = async (variables: { username: string; slotId?: string }) => {
    const slotId = variables.slotId ?? newSlotId;
    upsertSavedAccount({ slotId, username: variables.username, displayName: variables.username });
    await utils.invalidate();
    navigate("/", { replace: true });
  };
  const login = trpc.auth.login.useMutation({
    onSuccess: async (_result, variables) => afterAuth(variables),
    onError: (e) => setError(e.message),
  });
  const register = trpc.auth.register.useMutation({
    onSuccess: async (_result, variables) => afterAuth(variables),
    onError: (e) => setError(e.message),
  });
  const pending = login.isPending || register.isPending;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const normalized = username.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(normalized)) {
      setError("Имя: 3–32 символа, латиница, цифры и знак _");
      return;
    }
    if (password.length < 8 || password.length > 128) {
      setError("Пароль должен содержать от 8 до 128 символов");
      return;
    }
    const saved = readSavedAccounts();
    const existingAccount = saved.find((account) => account.username.toLowerCase() === normalized);
    if (!existingAccount && saved.length >= MAX_SAVED_ACCOUNTS) {
      setError("Сохранено максимум 5 аккаунтов. Откройте сохранённые аккаунты и удалите один перед добавлением.");
      return;
    }
    const accountSlotId = existingAccount?.slotId ?? newSlotId;
    if (mode === "register") {
      if (password !== confirmPassword) { setError("Пароли не совпадают"); return; }
      register.mutate({ username: normalized, password, slotId: accountSlotId });
    } else {
      login.mutate({ username: normalized, password, slotId: accountSlotId });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-8">
      <div className="w-full max-w-sm">
        <button onClick={() => navigate(-1)} className="mb-5 flex items-center gap-2 text-sm tcy-dim">
          <ArrowLeft size={17} /> Назад
        </button>
        <Card className="w-full tcy-card border tcy-line">
          <CardHeader className="items-center text-center space-y-3">
            <Logo size={58} />
            <CardTitle className="text-2xl tcy-text">{mode === "login" ? (isAddingAccount ? "Добавить аккаунт" : "С возвращением") : "Создать аккаунт"}</CardTitle>
            <p className="text-sm tcy-dim">{mode === "login" ? (isAddingAccount ? "Войдите в другой аккаунт — текущий останется сохранённым" : "Войдите в TeleChatYou") : "Придумайте имя и надёжный пароль"}</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium tcy-text">Имя пользователя</span>
                <div className="relative block">
                  <UserRound size={17} className="absolute left-4 top-1/2 -translate-y-1/2 tcy-faint" />
                  <TcInput className="pl-11" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} maxLength={32} required placeholder="username" />
                </div>
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium tcy-text">Пароль</span>
                <div className="relative block">
                  <LockKeyhole size={17} className="absolute left-4 top-1/2 -translate-y-1/2 tcy-faint" />
                  <TcInput className="pl-11" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} maxLength={128} required placeholder="Минимум 8 символов" />
                </div>
              </label>
              {mode === "login" && (
                <div className="-mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => navigate("/recover")}
                    className="text-sm font-semibold tcy-accent"
                  >
                    Забыл пароль?
                  </button>
                </div>
              )}
              {mode === "register" && (
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium tcy-text">Повторите пароль</span>
                  <TcInput type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} maxLength={128} required placeholder="Повторите пароль" />
                </label>
              )}
              {error && <p role="alert" className="text-sm tcy-danger">{error}</p>}
              <TcButton type="submit" size="lg" loading={pending}>
                {mode === "login" ? "Войти" : "Создать аккаунт"}
              </TcButton>
            </form>
            <button
              type="button"
              className="w-full mt-5 text-sm font-semibold tcy-accent"
              onClick={() => {
                setError("");
                if (mode === "login") {
                  navigate(isAddingAccount ? "/register?addAccount=1" : "/register");
                } else {
                  setMode("login");
                }
              }}
            >
              {mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
            </button>
            {savedAccounts.length > 0 && (
              <button
                type="button"
                onClick={() => navigate("/accounts")}
                className="w-full mt-4 rounded-[15px] tcy-card border tcy-line px-3 py-3 text-[12.5px] font-bold tcy-text flex items-center justify-center gap-2"
              >
                <UsersRound size={16} className="tcy-accent" /> Сохранённые аккаунты ({savedAccounts.length})
              </button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
