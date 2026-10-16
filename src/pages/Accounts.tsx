import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Check, Plus, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { TcButton } from "@/components/TcButton";
import { trpc } from "@/providers/trpc";
import {
  createAccountSlotId,
  forgetSavedAccount,
  MAX_SAVED_ACCOUNTS,
  readSavedAccounts,
  upsertSavedAccount,
  type SavedAccount,
} from "@/lib/saved-accounts";

export default function AccountsPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const auth = trpc.auth.me.useQuery(undefined, { retry: false, staleTime: 0 });
  const profileQuery = trpc.profile.me.useQuery(undefined, { enabled: !!auth.data, retry: false });
  const [accounts, setAccounts] = useState<SavedAccount[]>(() => readSavedAccounts());
  const [error, setError] = useState("");
  const [syncingCurrent, setSyncingCurrent] = useState(false);
  const migrationAttempted = useRef(false);

  const saveCurrent = trpc.auth.saveCurrentAccount.useMutation({
    onError: (cause) => {
      setError(cause.message);
      setSyncingCurrent(false);
    },
  });
  const switchAccount = trpc.auth.switchAccount.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      navigate("/", { replace: true });
    },
    onError: (cause) => setError(cause.message),
  });
  const removeAccount = trpc.auth.removeAccount.useMutation({
    onSuccess: async (result, variables) => {
      setAccounts(forgetSavedAccount(variables.slotId));
      setError("");
      if (result.wasActive) await utils.invalidate();
    },
    onError: (cause) => setError(cause.message),
  });

  useEffect(() => {
    const sync = () => setAccounts(readSavedAccounts());
    window.addEventListener("tcy-saved-accounts-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("tcy-saved-accounts-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (auth.isLoading || migrationAttempted.current) return;
    migrationAttempted.current = true;
    const currentUser = auth.data;
    if (!currentUser) return;

    const existing = readSavedAccounts().find(
      (item) => item.username.toLowerCase() === currentUser.username.toLowerCase(),
    );
    if (existing) {
      setAccounts(readSavedAccounts());
      setSyncingCurrent(true);
      saveCurrent.mutate(
        { slotId: existing.slotId },
        {
          onSuccess: () => setSyncingCurrent(false),
        },
      );
      return;
    }

    const stored = readSavedAccounts();
    if (stored.length >= MAX_SAVED_ACCOUNTS) {
      setError("Список заполнен: удалите один сохранённый аккаунт, чтобы добавить текущий.");
      return;
    }

    const slotId = createAccountSlotId();
    setSyncingCurrent(true);
    saveCurrent.mutate(
      { slotId },
      {
        onSuccess: () => {
          const latestProfile = profileQuery.data?.profile;
          const updated = upsertSavedAccount({
            slotId,
            username: currentUser.username,
            displayName: latestProfile?.displayName ?? currentUser.username,
            avatarKey: latestProfile?.avatarKey ?? null,
          });
          setAccounts(updated);
          setSyncingCurrent(false);
        },
      },
    );
  }, [auth.isLoading, auth.data?.username]);

  useEffect(() => {
    const currentProfile = profileQuery.data?.profile;
    if (!currentProfile) return;
    const existing = readSavedAccounts().find(
      (item) => item.username.toLowerCase() === currentProfile.username.toLowerCase(),
    );
    if (!existing) return;
    setAccounts(
      upsertSavedAccount({
        ...existing,
        displayName: currentProfile.displayName,
        avatarKey: currentProfile.avatarKey,
      }),
    );
  }, [
    profileQuery.data?.profile?.username,
    profileQuery.data?.profile?.displayName,
    profileQuery.data?.profile?.avatarKey,
  ]);

  const currentUsername = auth.data?.username?.toLowerCase();
  const busy = switchAccount.isPending || removeAccount.isPending || syncingCurrent;

  return (
    <div className="relative h-full flex flex-col">
      <header className="relative z-10 flex items-center gap-3 px-4 pt-5 safe-top pb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="tcy-press w-10 h-10 rounded-full tcy-card border tcy-line flex items-center justify-center tcy-dim"
          aria-label="Назад"
        >
          <ArrowLeft size={19} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[21px] font-extrabold tcy-text">Аккаунты</h1>
          <p className="text-[12px] tcy-faint">Сохранённые входы на этом устройстве</p>
        </div>
        <UsersRound size={22} className="tcy-accent" />
      </header>

      <main className="relative z-10 flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pb-28 space-y-4">
        <section className="rounded-[24px] tcy-card border tcy-line p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck size={20} className="tcy-accent shrink-0 mt-0.5" />
            <p className="text-[12.5px] tcy-dim leading-relaxed">
              Аккаунты остаются в списке при переключении. Пароли не сохраняются в списке браузера: каждый вход хранится в отдельной защищённой сессии.
            </p>
          </div>
        </section>

        {error && (
          <div role="alert" className="rounded-[15px] border px-3.5 py-3 text-[12.5px] tcy-danger" style={{ borderColor: "var(--tcy-danger)" }}>
            {error}
          </div>
        )}

        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[13px] font-bold tcy-dim">Ваши аккаунты</h2>
            <span className="text-[11px] tcy-faint">{accounts.length}/{MAX_SAVED_ACCOUNTS}</span>
          </div>

          {accounts.map((account) => {
            const isCurrent = account.username.toLowerCase() === currentUsername;
            return (
              <div key={account.slotId} className="flex items-center gap-3 rounded-[22px] tcy-card border tcy-line p-3.5">
                <Avatar name={account.displayName || account.username} avatarKey={account.avatarKey} size={48} />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-bold tcy-text truncate">{account.displayName || account.username}</div>
                  <div className="text-[12px] tcy-accent truncate">@{account.username}</div>
                  {isCurrent && (
                    <span className="inline-flex mt-1 items-center gap-1 text-[10.5px] font-bold tcy-dim">
                      <Check size={12} /> Открыт сейчас
                    </span>
                  )}
                </div>
                {!isCurrent && (
                  <button
                    type="button"
                    disabled={busy || syncingCurrent}
                    onClick={() => {
                      setError("");
                      switchAccount.mutate({ slotId: account.slotId });
                    }}
                    className="h-9 px-3 rounded-[13px] tcy-gradient-accent text-[11.5px] font-bold tcy-press disabled:opacity-50"
                    style={{ color: "var(--tcy-on-accent)" }}
                  >
                    {switchAccount.isPending && switchAccount.variables?.slotId === account.slotId ? "…" : "Открыть"}
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  title="Удалить аккаунт с этого устройства"
                  aria-label={"Удалить @" + account.username + " с этого устройства"}
                  onClick={() => {
                    if (!confirm("Удалить @" + account.username + " из сохранённых аккаунтов на этом устройстве?")) return;
                    setError("");
                    removeAccount.mutate({ slotId: account.slotId });
                  }}
                  className="w-9 h-9 rounded-full tcy-card-strong flex items-center justify-center tcy-danger tcy-press disabled:opacity-40"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}

          {accounts.length === 0 && (
            <div className="rounded-[22px] tcy-card border tcy-line px-5 py-8 text-center">
              <UsersRound size={28} className="mx-auto tcy-faint" />
              <p className="mt-3 text-[14px] font-bold tcy-text">Пока нет сохранённых аккаунтов</p>
              <p className="mt-1 text-[12px] tcy-dim">Войдите в аккаунт — он появится здесь.</p>
            </div>
          )}
        </section>

        <TcButton
          size="lg"
          disabled={accounts.length >= MAX_SAVED_ACCOUNTS || busy}
          onClick={() => navigate("/register?addAccount=1")}
        >
          <Plus size={18} /> Добавить аккаунт
        </TcButton>
        {accounts.length >= MAX_SAVED_ACCOUNTS && (
          <p className="text-center text-[11.5px] tcy-faint">Можно сохранить до {MAX_SAVED_ACCOUNTS} аккаунтов. Удалите один, чтобы добавить другой.</p>
        )}
      </main>
    </div>
  );
}
