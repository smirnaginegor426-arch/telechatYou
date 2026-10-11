import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";

export default function Admin() {
  const navigate = useNavigate();

  const me = trpc.profile.me.useQuery(undefined, {
    retry: false,
    staleTime: 0,
  });

  if (me.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        Загрузка админ-панели...
      </div>
    );
  }

  if (me.isError || !me.data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-xl font-bold">Не удалось загрузить аккаунт</h1>
        <button
          onClick={() => navigate("/")}
          className="rounded-xl px-5 py-3 tcy-accent-bg"
        >
          Вернуться в мессенджер
        </button>
      </div>
    );
  }

  if (me.data.user.role !== "admin") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-2xl font-bold">Доступ запрещён</h1>
        <p>У этого аккаунта нет прав администратора.</p>
<p>Username: {me.data.user.username}</p>
<p>ID аккаунта: {me.data.user.id}</p>
<p>Роль, которую видит сайт: {me.data.user.role}</p>
        <button
          onClick={() => navigate("/")}
          className="rounded-xl px-5 py-3 tcy-accent-bg"
        >
          Вернуться в мессенджер
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <p className="text-sm opacity-60">TeleChatYou</p>
          <h1 className="mt-2 text-3xl font-bold">Админ-панель</h1>
          <p className="mt-2 opacity-70">
            Управление мессенджером
          </p>
        </header>

        <section className="rounded-2xl border border-white/10 p-5">
          <h2 className="text-lg font-semibold">
            Твой аккаунт
          </h2>

          <p className="mt-3">
            Username: @{me.data.user.username}
          </p>

          <p className="mt-2">
            Роль: <span className="font-bold">admin</span>
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 p-5">
          <h2 className="text-lg font-semibold">
            Доступ администратора подтверждён
          </h2>
          <p className="mt-2 opacity-70">
            Страница подключена. Следующий этап — подключить инструменты
            управления пользователями и значками.
          </p>
        </section>

        <button
          onClick={() => navigate("/")}
          className="rounded-xl px-5 py-3 tcy-accent-bg"
        >
          Вернуться в мессенджер
        </button>
      </div>
    </div>
  );
}
