import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router";
import { ArrowLeft, AtSign, KeyRound, LogIn } from "lucide-react";
import { Logo, Wordmark } from "@/components/Logo";
import { TcButton } from "@/components/TcButton";
import { TcInput } from "@/components/TcInput";
import { trpc } from "@/providers/trpc";

function getOAuthUrl() {
  const kimiAuthUrl = import.meta.env.VITE_KIMI_AUTH_URL;
  const appID = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${kimiAuthUrl}/api/oauth/authorize`);
  url.searchParams.set("client_id", appID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "profile");
  url.searchParams.set("state", state);

  return url.toString();
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const utils = trpc.useUtils();
  const notice = (location.state as { notice?: string } | null)?.notice;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const login = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.fetch();
      await utils.profile.me.fetch();
      navigate("/", { replace: true });
    },
    onError: (e) => setError(e.message),
  });

  const canSubmit = username.trim().length > 0 && password.length > 0 && !login.isPending;

  return (
    <div className="relative h-full flex flex-col overflow-y-auto no-scrollbar">
      <div className="relative z-10 px-6 pt-6 safe-top flex items-center">
        <button
          onClick={() => navigate("/")}
          className="tcy-press w-10 h-10 rounded-full tcy-card flex items-center justify-center tcy-dim"
          aria-label="Назад"
        >
          <ArrowLeft size={19} />
        </button>
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-center px-7 py-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 240, damping: 22 }}
          className="flex flex-col items-center"
        >
          <Logo size={64} />
          <div className="mt-4">
            <Wordmark />
          </div>
          <h1 className="mt-6 text-[24px] font-extrabold tcy-text">Вход</h1>
        </motion.div>

        {notice && (
          <p className="mt-5 text-center text-[13px] font-semibold tcy-accent">{notice}</p>
        )}

        <form
          className="mt-7 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            setError("");
            login.mutate({ username: username.trim(), password });
          }}
        >
          <div className="relative">
            <AtSign size={18} className="absolute left-4 top-1/2 -translate-y-1/2 tcy-faint" />
            <TcInput
              autoComplete="username"
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

          <div className="relative">
            <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 tcy-faint" />
            <TcInput
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              maxLength={128}
              className="pl-11"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => navigate("/recover")}
              className="tcy-press text-[13.5px] font-semibold tcy-accent px-2 py-1"
            >
              Забыл пароль?
            </button>
          </div>

          {error && (
            <p className="text-[13px] tcy-danger text-center font-semibold">{error}</p>
          )}

          <TcButton type="submit" size="lg" disabled={!canSubmit} loading={login.isPending}>
            Войти <LogIn size={18} />
          </TcButton>
        </form>

        <div className="flex items-center gap-3 my-7">
          <span className="flex-1 h-px" style={{ background: "var(--tcy-line)" }} />
          <span className="text-[12px] tcy-faint font-semibold">или</span>
          <span className="flex-1 h-px" style={{ background: "var(--tcy-line)" }} />
        </div>

        <TcButton
          variant="soft"
          size="lg"
          onClick={() => {
            window.location.href = getOAuthUrl();
          }}
        >
          Войти через Kimi
        </TcButton>
      </div>
    </div>
  );
}
