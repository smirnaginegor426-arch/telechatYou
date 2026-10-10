import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, LockKeyhole, UserRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TcButton } from "@/components/TcButton";
import { TcInput } from "@/components/TcInput";
import { Logo } from "@/components/Logo";
import { trpc } from "@/providers/trpc";

export default function Login() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const afterAuth = async () => {
    await utils.invalidate();
    navigate("/", { replace: true });
  };
  const login = trpc.auth.login.useMutation({ onSuccess: afterAuth, onError: (e) => setError(e.message) });
  const register = trpc.auth.register.useMutation({ onSuccess: afterAuth, onError: (e) => setError(e.message) });
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
    if (mode === "register") {
      if (password !== confirmPassword) { setError("Пароли не совпадают"); return; }
      register.mutate({ username: normalized, password });
    } else {
      login.mutate({ username: normalized, password });
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
            <CardTitle className="text-2xl tcy-text">{mode === "login" ? "С возвращением" : "Создать аккаунт"}</CardTitle>
            <p className="text-sm tcy-dim">{mode === "login" ? "Войдите в TeleChatYou" : "Придумайте имя и надёжный пароль"}</p>
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
              onClick={() => { setError(""); setMode((current) => current === "login" ? "register" : "login"); }}
            >
              {mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
