import { useRef, useState } from "react";
import { ArrowLeft, Check, Folder, Plus, Trash2, Users } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router";
import { Avatar } from "@/components/Avatar";
import { ChatItem } from "@/components/ChatItem";
import { EmptyState } from "@/components/EmptyState";
import { trpc } from "@/providers/trpc";
import type { ChatListItem } from "@/types/api";

function isPersonalConversation(item: ChatListItem) {
  if (item.chat.type !== "direct" || !item.peer) return false;
  const parts = item.chat.directKey?.split(":") ?? [];
  return !(parts.length === 2 && parts[0] === parts[1]);
}

export default function ChatFolders() {
  const navigate = useNavigate();
  const location = useLocation();
  const { folderId } = useParams<{ folderId: string }>();
  const creating = location.pathname.endsWith("/new");
  const utils = trpc.useUtils();
  const foldersQuery = trpc.accountData.folders.list.useQuery(undefined, { retry: false });
  const chatsQuery = trpc.chats.list.useQuery(undefined, { retry: false });
  const saveFolder = trpc.accountData.folders.save.useMutation();
  const deleteFolder = trpc.accountData.folders.delete.useMutation({
    onSuccess: async () => {
      await utils.accountData.folders.list.invalidate();
      navigate("/", { replace: true });
    },
  });
  const routeState = location.state as { chatIds?: number[] } | null;
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>(() =>
    Array.isArray(routeState?.chatIds) ? [...new Set(routeState.chatIds.filter((id) => typeof id === "number"))] : [],
  );
  const [error, setError] = useState("");
  const newId = useRef(`folder-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

  const items = chatsQuery.data ?? [];
  const peopleChats = items.filter(isPersonalConversation);
  const folder = (foldersQuery.data ?? []).find((item) => item.id === folderId);
  const folderItems = folder
    ? folder.chatIds.map((id) => items.find((item) => item.chat.id === id)).filter((item): item is ChatListItem => !!item)
    : [];
  const selectedDirectIds = selectedIds.filter((id) => peopleChats.some((item) => item.chat.id === id));

  const toggleChat = (id: number) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const create = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      setStep(1);
      setError("Введи название папки.");
      return;
    }
    setError("");
    try {
      const saved = await saveFolder.mutateAsync({
        id: newId.current,
        name: cleanName,
        chatIds: selectedDirectIds,
      });
      await utils.accountData.folders.list.invalidate();
      const created = saved.find((item) => item.id === newId.current);
      navigate(`/folders/${newId.current}`, { replace: true, state: { title: created?.name ?? cleanName } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось создать папку. Попробуй ещё раз.");
    }
  };

  if (!creating && folderId) {
    if (foldersQuery.isLoading || chatsQuery.isLoading) {
      return <div className="h-full p-6 text-center tcy-dim">Загружаем папку…</div>;
    }
    if (!folder) {
      return (
        <div className="h-full px-5 pt-5 safe-top">
          <button type="button" onClick={() => navigate("/")} className="tcy-press mb-5 flex h-10 w-10 items-center justify-center rounded-full tcy-card border tcy-line tcy-text" aria-label="Назад"><ArrowLeft size={19} /></button>
          <EmptyState icon={<Folder size={32} />} title="Папка не найдена" hint="Возможно, она была удалена с другого устройства." action={<button type="button" onClick={() => navigate("/")} className="font-extrabold tcy-accent">Вернуться к чатам</button>} />
        </div>
      );
    }
    return (
      <div className="relative flex h-full flex-col overflow-hidden">
        <header className="flex items-center gap-3 px-5 pt-5 safe-top pb-4">
          <button type="button" onClick={() => navigate("/")} className="tcy-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full tcy-card border tcy-line tcy-text" aria-label="Назад"><ArrowLeft size={19} /></button>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--tcy-selected-accent) 13%, var(--tcy-card))", color: "var(--tcy-selected-accent)" }}><Folder size={22} /></span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[21px] font-black tcy-text">{folder.name}</h1>
            <p className="text-[12px] tcy-dim">{folderItems.length} чатов в папке</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Удалить папку «${folder.name}»? Чаты останутся в списке.`)) {
                deleteFolder.mutate({ id: folder.id });
              }
            }}
            disabled={deleteFolder.isPending}
            className="tcy-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full tcy-card"
            style={{ color: "#e05262" }}
            aria-label="Удалить папку"
          ><Trash2 size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto no-scrollbar pb-28">
          {folderItems.length ? folderItems.map((item, index) => (
            <ChatItem key={item.chat.id} item={item} index={index} onClick={() => navigate(`/chat/${item.chat.id}`)} />
          )) : (
            <EmptyState icon={<Users size={32} />} title="В папке пока пусто" hint="Создай другую папку или выбери чаты для этой папки." />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <header className="px-5 pt-5 safe-top pb-5">
        <button type="button" onClick={() => navigate(-1)} className="tcy-press mb-4 flex h-10 w-10 items-center justify-center rounded-full tcy-card border tcy-line tcy-text" aria-label="Назад"><ArrowLeft size={19} /></button>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--tcy-selected-accent) 13%, var(--tcy-card))", color: "var(--tcy-selected-accent)" }}><Folder size={22} /></span>
          <div>
            <h1 className="text-[23px] font-black tcy-text">{step === 1 ? "Новая папка" : "Выбери чаты"}</h1>
            <p className="mt-0.5 text-[12.5px] tcy-dim">{step === 1 ? "Как назовём папку?" : "Выбери личные чаты, которые в неё войдут"}</p>
          </div>
        </div>
      </header>

      {step === 1 ? (
        <section className="mx-4 rounded-[27px] border tcy-line tcy-card p-5">
          <label htmlFor="folder-name" className="mb-2 block text-[14px] font-extrabold tcy-text">Как назовём папку?</label>
          <input
            id="folder-name"
            autoFocus
            value={name}
            onChange={(event) => { setName(event.target.value); setError(""); }}
            maxLength={48}
            placeholder="Например, Друзья"
            className="w-full h-12 rounded-[16px] border tcy-line tcy-input px-4 text-[14px] tcy-text outline-none focus:border-[color:var(--tcy-selected-accent)]"
          />
          {error && <p role="alert" className="mt-2 text-[12px] tcy-danger">{error}</p>}
          <button type="button" onClick={() => { if (!name.trim()) { setError("Введи название папки."); return; } setError(""); setStep(2); }} className="tcy-press mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-[17px] tcy-gradient-accent text-[14px] font-black" style={{ color: "var(--tcy-selected-on-accent)" }}>
            Дальше
          </button>
        </section>
      ) : (
        <>
          <div className="mx-4 mb-2 flex items-center justify-between rounded-[18px] border tcy-line tcy-card px-4 py-3">
            <span className="text-[13.5px] font-extrabold tcy-text">Выбрано чатов</span>
            <span className="flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[13px] font-black" style={{ background: "var(--tcy-selected-accent)", color: "var(--tcy-selected-on-accent)" }}>{selectedDirectIds.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar px-3 pb-3">
            {chatsQuery.isLoading ? (
              <p className="px-3 py-5 text-[13px] tcy-dim">Загружаем список пользователей…</p>
            ) : peopleChats.length === 0 ? (
              <EmptyState icon={<Users size={30} />} title="Пока нет личных чатов" hint="Сначала пообщайся с пользователями — они появятся здесь." />
            ) : (
              <div className="space-y-1.5">
                {peopleChats.map((item) => {
                  const selected = selectedIds.includes(item.chat.id);
                  const title = item.peer?.displayName ?? "Пользователь";
                  return (
                    <button
                      type="button"
                      key={item.chat.id}
                      aria-pressed={selected}
                      onClick={() => toggleChat(item.chat.id)}
                      className="flex w-full items-center gap-3 rounded-[20px] border px-3 py-2.5 text-left transition-colors"
                      style={{
                        background: selected ? "color-mix(in srgb, var(--tcy-selected-accent) 10%, var(--tcy-card))" : "var(--tcy-card)",
                        borderColor: selected ? "var(--tcy-selected-accent)" : "var(--tcy-line)",
                      }}
                    >
                      <Avatar name={title} avatarKey={item.peer?.avatarKey} size={46} lastSeenAt={item.peer?.lastSeenAt} showOnline />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-extrabold tcy-text">{title}</span>
                        <span className="block truncate text-[11.5px] tcy-dim">@{item.peer?.username ?? "username"}</span>
                      </span>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2" style={{ borderColor: selected ? "var(--tcy-selected-accent)" : "var(--tcy-faint)", background: selected ? "var(--tcy-selected-accent)" : "transparent", color: "var(--tcy-selected-on-accent)" }}>
                        {selected && <Check size={14} strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {error && <p role="alert" className="px-2 pt-2 text-[12px] tcy-danger">{error}</p>}
          </div>
          <div className="px-4 pt-2 pb-5 safe-bottom">
            <button
              type="button"
              onClick={() => void create()}
              disabled={saveFolder.isPending}
              className="tcy-press flex h-12 w-full items-center justify-center gap-2 rounded-[17px] tcy-gradient-accent text-[14px] font-black disabled:opacity-50"
              style={{ color: "var(--tcy-selected-on-accent)" }}
            >
              <Plus size={18} /> {saveFolder.isPending ? "Создаём…" : "Создать"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
