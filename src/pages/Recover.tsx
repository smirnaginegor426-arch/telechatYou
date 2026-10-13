import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, AtSign, Copy, Hash, KeyRound, LockKeyhole } from "lucide-react";
import {
  createAccountSlotId,
  MAX_SAVED_ACCOUNTS,
  readSavedAccounts,
  upsertSavedAccount,
} from "@/lib/saved-accounts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TcButton } from "@/components/TcButton";
import { TcInput } from "@/components/TcInput";
import { Logo } from "@/components/Logo";
import { trpc } from "@/providers/trpc";

export default function Recover() {
  const navigate = useNavigate();
  const [newSlotId] = useState(() => createAccountSlotId());
  const [username, setUsername] = useState("");
  const [accountId, setAccountId] = useState("");
  const [key, setKey] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const utils = trpc.useUtils();

  const requestKey = trpc.auth.requestRecoveryKey.useMutation({
    onSuccess: (result) => {
      setKey(result.key);
      setExpiresAt(result.expiresAt);
      setError("");
      setNotice("Ключ создан. Он действует 15 минут и срабатывает только один раз.");
    },
    onError: (e) => {
      setError(e.message);
      setNotice("");
    },
  });

  const loginWithKey = trpc.auth.loginWithRecoveryKey.useMutation({
    onSuccess: async (_result, variables) => {
      const slotId = variables.slotId ?? newSlotId;
      upsertSavedAccount({
        slotId,
        username: variables.username,
        displayName: variables.username,
      });
      await utils.invalidate();
      navigate("/", { replace: true });
    },
    onError: (e) => {
      setError(e.message);
      setNotice("");
    },
  });

  const normalizedUsername = username.trim().toLowerCase();
  const parsedAccountId = Number(accountId);
  const accountIdValid = Number.isSafeInteger(parsedAccountId) && parsedAccountId > 0;
  const savedAccounts = readSavedAccounts();
  const existingAccount = savedAccounts.find(
    (account) => account.username.toLowerCase() === normalizedUsername,
  );
  const slotId = existingAccount?.slotId ?? newSlotId;

  const validateAccount = () => {
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(normalizedUsername)) {
      setError("Username должен содержать 3–32 символа: латиницу, цифры или _.");
      return false;
    }
    if (!accountIdValid) {
      setError("Введи числовой ID аккаунта.");
      return false;
    }
    if (!existingAccount && savedAccounts.length >= MAX_SAVED_ACCOUNTS) {
      setError("Сохранено максимум 5 аккаунтов. Удали один из сохранённых аккаунтов перед входом.");
      return false;
    }
    return true;
  };

  const handleRequestKey = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!validateAccount()) return;
    setKey("");
    setExpiresAt("");
    requestKey.mutate({ username: normalizedUsername, accountId: parsedAccountId });
  };

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!validateAccount()) return;
    if (!key.trim()) {
      setError("Сначала получи или введи одноразовый ключ.");
      return;
    }
    loginWithKey.mutate({
      username: normalizedUsername,
      accountId: parsedAccountId,
      key: key.trim(),
      slotId,
    });
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(key);
      setNotice("Ключ скопирован. Храни его в секрете.");
    } catch {
      setNotice("Не удалось скопировать автоматически — выдели ключ и скопируй его вручную.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-8">
      <div className="w-full max-w-sm">
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="mb-5 flex items-center gap-2 text-sm tcy-dim"
        >
          <ArrowLeft size={17} /> Вернуться ко входу
        </button>
        <Card className="w-full tcy-card border tcy-line">
          <CardHeader className="items-center text-center space-y-3">
            <Logo size={58} />
            <CardTitle className="text-2xl tcy-text">Восстановление входа</CardTitle>
            <p className="text-sm tcy-dim">
              Укажи username и ID аккаунта, чтобы получить одноразовый ключ.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={handleRequestKey} className="space-y-3.5">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium tcy-text">Имя пользователя</span>
                <div className="relative block">
                  <AtSign size={17} className="absolute left-4 top-1/2 -translate-y-1/2 tcy-faint" />
                  <TcInput
                    className="pl-11"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                    minLength={3}
                    maxLength={32}
                    required
                    placeholder="username"
                  />
                </div>
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium tcy-text">ID аккаунта</span>
                <div className="relative block">
                  <Hash size={17} className="absolute left-4 top-1/2 -translate-y-1/2 tcy-faint" />
                  <TcInput
                    className="pl-11"
                    inputMode="numeric"
                    autoComplete="off"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                    required
                    placeholder="Например, 123"
                  />
                </div>
              </label>
              <TcButton type="submit" size="lg" loading={requestKey.isPending}>
                Получить одноразовый ключ
              </TcButton>
            </form>

            <form onSubmit={handleLogin} className="space-y-3.5">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium tcy-text">Одноразовый ключ</span>
                <div className="relative block">
                  <KeyRound size={17} className="absolute left-4 top-1/2 -translate-y-1/2 tcy-faint" />
                  <TcInput
                    className="pl-11 pr-12 font-mono tracking-wide"
                    autoComplete="one-time-code"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    maxLength={80}
                    placeholder="Вставь или получи ключ выше"
                  />
                  {key && (
                    <button
                      type="button"
                      onClick={copyKey}
                      aria-label="Скопировать ключ"
                      className="absolute right-3 top-1/2 -translate-y-1/2 tcy-dim"
                    >
                      <Copy size={17} />
                    </button>
                  )}
                </div>
                {expiresAt && (
                  <span className="block text-xs tcy-dim">
                    Действует до {new Date(expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.
                  </span>
                )}
              </label>
              {error && <p role="alert" className="text-sm tcy-danger">{error}</p>}
              {notice && <p role="status" className="text-sm tcy-accent">{notice}</p>}
              <TcButton type="submit" size="lg" variant="soft" loading={loginWithKey.isPending}>
                <LockKeyhole size={17} /> Войти по ключу
              </TcButton>
            </form>

            <p className="text-xs leading-relaxed tcy-faint text-center">
              Ключ действует 15 минут, хранится на сервере только в виде хеша и после входа становится недействительным.
              Не передавай его другим людям.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
