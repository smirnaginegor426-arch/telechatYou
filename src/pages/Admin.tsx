import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";

export default function Admin() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

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
    {
      enabled: isAdmin,
      retry: false,
    },
  );

  const changeRole = trpc.admin.users.setRole.useMutation({
    onSuccess: async () => {
      await Promise.all([people.refetch(), stats.refetch()]);
    },
  });

  if (me.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        Проверяем права доступа...
      </div>
    );
  }

  if (me.isError || !me.data) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Не удалось загрузить аккаунт</h1>
        <button
          onClick={() => navigate("/")}
          className="mt-4 rounded-xl px-5 py-3 tcy-accent-bg"
        >
          Вернуться в мессенджер
        </button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
        <h1 className="text-2xl font-bold">Доступ запрещён</h1>
        <p>Текущий аккаунт не имеет прав администратора.</p>
        <p>Username: @{me.data.user.username}</p>
        <p>ID: {me.data.user.id}</p>
        <button
          onClick={() => navigate("/")}
          className="mt-2 rounded-xl px-5 py-3 tcy-accent-bg"
        >
          Вернуться в мессенджер
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm opacity-60">TeleChatYou</p>
            <h1 className="mt-1 text-3xl font-bold">
              Панель администратора
            </h1>
            <p className="mt-2 opacity-70">
              Управление пользователями и доступом
            </p>
          </div>

          <button
            onClick={() => navigate("/")}
            className="rounded-xl border border-white/15 px-4 py-3"
          >
            В мессенджер
          </button>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 p-5">
            <p className="text-sm opacity-60">Всего пользователей</p>
            <p className="mt-2 text-3xl font-bold">
              {stats.isLoading
                ? "..."
                : stats.error
                  ? "—"
                  : stats.data?.totalUsers ?? 0}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 p-5">
            <p className="text-sm opacity-60">Администраторов</p>
            <p className="mt-2 text-3xl font-bold">
              {stats.isLoading
                ? "..."
                : stats.error
                  ? "—"
                  : stats.data?.totalAdmins ?? 0}
            </p>
          </div>
        </section>

        {stats.error && (
          <p className="text-sm text-red-400">
            Ошибка статистики: {stats.error.message}
          </p>
        )}

        <section className="space-y-4 rounded-2xl border border-white/10 p-4 sm:p-5">
          <div>
            <h2 className="text-xl font-bold">Пользователи</h2>
            <p className="mt-1 text-sm opacity-60">
              Ищи аккаунты по username, имени или электронной почте.
            </p>
          </div>

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск пользователя..."
            className="w-full rounded-xl border border-white/15 bg-transparent px-4 py-3 outline-none"
          />

          {people.error && (
            <p className="text-sm text-red-400">
              Ошибка загрузки пользователей: {people.error.message}
            </p>
          )}

          {changeRole.error && (
            <p className="text-sm text-red-400">
              Не удалось изменить роль: {changeRole.error.message}
            </p>
          )}

          {changeRole.isSuccess && !changeRole.isPending && (
            <p className="text-sm">
              Роль пользователя успешно изменена.
            </p>
          )}

          {people.isLoading ? (
            <p className="py-6 text-center opacity-60">
              Загружаем пользователей...
            </p>
          ) : people.data?.length ? (
            <div className="space-y-3">
              {people.data.map((person) => {
                const isSelf = person.id === me.data.user.id;
                const isLastAdmin =
                  isSelf && person.role === "admin";

                return (
                  <article
                    key={person.id}
                    className="flex flex-col justify-between gap-4 rounded-xl border border-white/10 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="break-words font-semibold">
                        @{person.username}
                        {isSelf && (
                          <span className="ml-2 text-xs opacity-60">
                            (это ты)
                          </span>
                        )}
                      </p>

                      <p className="mt-1 break-words text-sm opacity-70">
                        {person.name || "Имя не указано"}
                      </p>

                      <p className="mt-1 text-xs opacity-50">
                        ID: {person.id}
                        {person.email ? ` · ${person.email}` : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-lg border border-white/15 px-3 py-2 text-sm">
                        {person.role === "admin"
                          ? "Администратор"
                          : "Пользователь"}
                      </span>

                      <button
                        disabled={
                          changeRole.isPending || isLastAdmin
                        }
                        onClick={() => {
                          changeRole.reset();
                          changeRole.mutate({
                            userId: person.id,
                            role:
                              person.role === "admin"
                                ? "user"
                                : "admin",
                          });
                        }}
                        className="rounded-xl border border-white/15 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {changeRole.isPending
                          ? "Сохраняем..."
                          : person.role === "admin"
                            ? "Снять админку"
                            : "Выдать админку"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="py-6 text-center opacity-60">
              Пользователи не найдены.
            </p>
          )}

          <p className="text-xs opacity-50">
            Отображается не более 100 пользователей. Поиск позволяет
            найти нужный аккаунт.
          </p>
        </section>
      </div>
    </div>
  );
}
