import { useState } from "react";
import { Check } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { BottomSheet } from "@/components/BottomSheet";
import { TcButton } from "@/components/TcButton";
import { TcInput } from "@/components/TcInput";

/** Set or change the account password. Used from Settings. */
export function PasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const status = trpc.auth.passwordStatus.useQuery(undefined, { enabled: open });
  const hasPassword = status.data?.hasPassword ?? false;

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const setPassword = trpc.auth.setPassword.useMutation({
    onSuccess: async () => {
      await utils.auth.passwordStatus.invalidate();
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    },
    onError: (e) => setError(e.message),
  });

  const submit = () => {
    setError("");
    if (hasPassword && !current) return setError("Введите текущий пароль");
    if (next.length < 8) return setError("Новый пароль — не короче 8 символов");
    if (next !== confirm) return setError("Пароли не совпадают");
    setPassword.mutate({
      newPassword: next,
      currentPassword: hasPassword ? current : undefined,
    });
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        setError("");
        setDone(false);
        onClose();
      }}
      title={hasPassword ? "Смена пароля" : "Пароль для входа"}
    >
      <div className="px-5 space-y-4 pb-6">
        <p className="text-[13px] tcy-dim leading-relaxed">
          С паролем можно войти по username, даже если вход через Kimi недоступен.
        </p>
        {hasPassword && (
          <TcInput
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="Текущий пароль"
            maxLength={128}
          />
        )}
        <TcInput
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
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
        {error && <p className="text-[13px] tcy-danger text-center font-semibold">{error}</p>}
        {done && (
          <p className="text-[13px] tcy-accent text-center font-semibold flex items-center justify-center gap-1.5">
            <Check size={14} /> Пароль сохранён
          </p>
        )}
        <TcButton size="lg" loading={setPassword.isPending} onClick={submit}>
          Сохранить
        </TcButton>
      </div>
    </BottomSheet>
  );
}
