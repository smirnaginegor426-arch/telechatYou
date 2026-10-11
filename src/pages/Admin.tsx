
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Avatar } from "@/components/Avatar";

export default function Admin() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetPasswords, setResetPasswords] =
    useState<Record<number, string>>({});

  const me = trpc.profile.me.useQuery(undefined, {
    retry: false,
  });

  const isAdmin = me.data?.user.role === "admin";

  const stats = trpc.admin.stats.useQuery(undefined, {
    enabled: isAdmin,
    retry: false,
  });

  const people = trpc.admin.users.list.useQuery(
    { search: search.trim(), limit: 100 },
    { enabled: isAdmin, retry: false },
  );

  const createAccount = trpc.admin.users.create.useMutation({
    onSuccess: async () => {
      setNewUsername("");
      setNewName("");
      setNewPassword("");
      await Promise.all([people.refetch(), stats.refetch()]);
    },
  });

  const changeRole = trpc.admin.users.setRole.useMutation({
    onSuccess: async () => {
      await Promise.all([people.refetch(), stats.refetch()]);
    },
  });

  const resetPassword = trpc.admin.users.resetPassword.useMutation({
    onSuccess: async (_result, variables) => {
      setResetPasswords((current) => ({
        ...current,
        [variables.userId]: "",
      }));
      await people.refetch();
    },
  });

  if (me.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        Проверяем доступ...
      </div>
    );
  }

  if (me.isError || !me.data) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">
          Не удалось загрузить аккаунт
        </h1>
        <button onClick={() => navigate("/")} className="mt-4 rounded-xl border border-white/15 px-5 py-3">
          Вернуться в мессенджер
        </button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
        <h1 className="text-2xl font-bold">Доступ запрещён</h1>
        <p>Аккаунт @{me.data.user.username} не является администратором.</p>
        <button onClick={() => navigate("/")} className="rounded-xl border border-white/15 px-5 py-3">
          Вернуться
        </button>
      </div>
    );
  }

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createAccount.reset();
    createAccount.mutate({
      username: newUsername.trim(),
      name: newName.trim() || undefined,
      password: newPassword,
    });
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">

        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm opacity-60">TELECHATYOU / CONTROL</p>
            <h1 className="mt-2 text-3xl font-bold">
              Админ-панель
            </h1>
            <p className="mt-2 opacity-70">
              Управление аккаунтами и доступом
            </p>
          </div>

          <button
            onClick={() => navigate("/")}
            className="rounded-xl border border-white/15 px-4 py-3"
          >
            ← В мессенджер
          </button>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 p-5">
            <p className="text-sm opacity-60">Пользователей</p>
            <p className="mt-2 text-3xl font-bold">
              {stats.isLoading ? "…" : stats.data?.totalUsers ?? "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 p-5">
            <p className="text-sm opacity-60">Администраторов</p>
            <p className="mt-2 text-3xl font-bold">
              {stats.isLoading ? "…" : stats.data?.totalAdmins ?? "—"}
            </p>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-white/10 p-5">
          <div>
            <h2 className="text-xl font-bold">Создать аккаунт</h2>
            <p className="mt-1 text-sm opacity-60">
              Новый пользователь сможет войти с этими данными.
            </p>
          </div>

          <form onSubmit={submitCreate} className="grid gap-3 sm:grid-cols-2">
            <input
              required
              minLength={3}
              maxLength={32}
              pattern="[a-zA-Z0-9_]+"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Username, например user123"
              className="min-w-0 rounded-xl border border-white/15 bg-transparent px-4 py-3"
            />
            <input
              maxLength={255}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Имя (необязательно)"
              className="min-w-0 rounded-xl border border-white/15 bg-transparent px-4 py-3"
            />
            <input
              required
              type="password"
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Пароль (минимум 8 символов)"
              className="min-w-0 rounded-xl border border-white/15 bg-transparent px-4 py-3"
            />
            <button
              type="submit"
              disabled={createAccount.isPending}
              className="rounded-xl px-4 py-3 font-semibold tcy-accent-bg disabled:opacity-50"
            >
              {createAccount.isPending ? "Создаём…" : "＋ Создать аккаунт"}
            </button>
          </form>

          {createAccount.isSuccess && (
            <p className="text-sm">
              Аккаунт @{createAccount.data.username} создан. Передай пользователю его имя и пароль безопасным способом.
            </p>
          )}
          {createAccount.error && (
            <p className="text-sm text-red-400">
              Не удалось создать аккаунт: {createAccount.error.message}
            </p>
          )}
        </section>

        <section className="space-y-4 rounded-2xl border border-white/10 p-4 sm:p-5">
          <div>
            <h2 className="text-xl font-bold">Пользователи</h2>
            <p className="mt-1 text-sm opacity-60">
              Фото, username, права доступа и сброс пароля.
            </p>
          </div>

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по username, имени или почте…"
            className="w-full rounded-xl border border-white/15 bg-transparent px-4 py-3"
          />

          {people.error && (
            <p className="text-sm text-red-400">
              Ошибка загрузки: {people.error.message}
            </p>
          )}

          {changeRole.error && (
            <p className="text-sm text-red-400">
              Ошибка изменения роли: {changeRole.error.message}
            </p>
          )}

          {resetPassword.error && (
            <p className="text-sm text-red-400">
              Ошибка сброса пароля: {resetPassword.error.message}
            </p>
          )}

          {resetPassword.isSuccess && (
            <p className="text-sm">
              Пароль изменён. Сеансы пользователя на других устройствах отозваны.
            </p>
          )}

          {people.isLoading ? (
            <p className="py-8 text-center opacity-60">
              Загружаем пользователей…
            </p>
          ) : people.data?.length ? (
            <div className="space-y-3">
              {people.data.map((person) => {
                const isSelf = person.id === me.data.user.id;
                const password = resetPasswords[person.id] ?? "";

                return (
                  <article
                    key={person.id}
                    className="space-y-4 rounded-2xl border border-white/10 p-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        name={person.displayName || person.name || person.username}
                        avatarKey={person.avatarKey}
                        size={48}
                      />

                      <div className="min-w-0 flex-1">
                        <p className="break-words font-semibold">
                          @{person.username}
                          {isSelf && (
                            <span className="ml-2 text-xs opacity-60">
                              (вы)
                            </span>
                          )}
                        </p>
                        <p className="break-words text-sm opacity-60">
                          {person.displayName || person.name || "Имя не указано"}
                        </p>
                        <p className="text-xs opacity-50">
                          ID: {person.id}
                          {person.email ? ` · ${person.email}` : ""}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-lg border border-white/15 px-3 py-2 text-xs">
                        {person.role === "admin" ? "Админ" : "Пользователь"}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        disabled={
                          changeRole.isPending ||
                          (isSelf && person.role === "admin")
                        }
                        onClick={() => {
                          changeRole.reset();
                          changeRole.mutate({
                            userId: person.id,
                            role: person.role === "admin" ? "user" : "admin",
                          });
                        }}
                        className="rounded-xl border border-white/15 px-3 py-2 text-sm disabled:opacity-40"
                      >
                        {person.role === "admin"
                          ? "Снять админку"
                          : "Выдать админку"}
                      </button>
                    </div>

                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (password.length < 8) return;
                        resetPassword.reset();
                        resetPassword.mutate({
                          userId: person.id,
                          newPassword: password,
                        });
                      }}
                      className="flex flex-col gap-2 sm:flex-row"
                    >
                      <input
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={128}
                        required
                        value={password}
                        onChange={(e) =>
                          setResetPasswords((current) => ({
                            ...current,
                            [person.id]: e.target.value,
                          }))
                        }
                        placeholder="Новый пароль (минимум 8 символов)"
                        className="min-w-0 flex-1 rounded-xl border border-white/15 bg-transparent px-3 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={resetPassword.isPending || password.length < 8}
                        className="rounded-xl border border-white/15 px-4 py-2 text-sm disabled:opacity-40"
                      >
                        {resetPassword.isPending ? "Сохраняем…" : "Сбросить пароль"}
                      </button>
                    </form>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center opacity-60">
              Пользователи не найдены.
            </p>
          )}

          <p className="text-xs opacity-50">
            Показано не более 100 аккаунтов. Поиск поможет найти нужного пользователя.
          </p>
        </section>
      </div>
    </div>
  );
}
