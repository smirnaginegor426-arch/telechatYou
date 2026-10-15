import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, Mic, Search as SearchIcon, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Avatar } from "@/components/Avatar";
import { TesterBadge } from "@/components/TesterBadge";
import { isTesterUsername } from "@/lib/testers";
import { EmptyState } from "@/components/EmptyState";
import { formatChatTime, isOnline } from "@/lib/format";

export default function Search() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const query = q.trim();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const users = trpc.profile.search.useQuery(
    { query },
    { enabled: query.length >= 2, staleTime: 10_000 },
  );
  const msgSearch = trpc.messages.search.useQuery(
    { query },
    { enabled: query.length >= 2, staleTime: 10_000 },
  );
  const chatList = trpc.chats.list.useQuery(undefined, { staleTime: 15_000 });
  const createDirect = trpc.chats.createDirect.useMutation({
    onSuccess: (r) => navigate(`/chat/${r.chatId}`, { replace: true }),
  });

  const matchedChats = useMemo(() => {
    const all = chatList.data ?? [];
    if (query.length < 1) return [];
    const lower = query.toLowerCase();
    return all.filter((c) => {
      const title =
        c.chat.type === "direct"
          ? `${c.peer?.displayName ?? ""} ${c.peer?.username ?? ""}`
          : c.chat.title ?? "";
      return title.toLowerCase().includes(lower);
    });
  }, [chatList.data, query]);

  const hasResults =
    matchedChats.length > 0 || (users.data?.length ?? 0) > 0 || (msgSearch.data?.length ?? 0) > 0;

  return (
    <div className="relative h-full flex flex-col">
      <header className="relative z-10 flex items-center gap-2.5 px-4 pt-4 safe-top pb-3 border-b tcy-line">
        <button
          onClick={() => navigate(-1)}
          className="tcy-press w-10 h-10 rounded-full flex items-center justify-center tcy-dim shrink-0"
        >
          <ArrowLeft size={19} />
        </button>
        <div className="relative flex-1">
          <SearchIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 tcy-faint" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Чаты, люди, сообщения…"
            className="w-full h-11 pl-11 pr-10 rounded-[18px] tcy-card border tcy-line text-[14px] font-medium tcy-text placeholder:text-[color:var(--tcy-faint)] outline-none focus:border-[color:var(--tcy-selected-accent)] transition-colors"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 tcy-faint tcy-press"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-10 relative z-10">
        {query.length < 2 ? (
          <EmptyState
            icon={<SearchIcon size={30} />}
            title="Глобальный поиск"
            hint="Введите минимум 2 символа — найдём чаты, людей по @username и сообщения."
          />
        ) : !hasResults && !users.isLoading && !msgSearch.isLoading ? (
          <EmptyState
            icon={<SearchIcon size={30} />}
            title="Ничего не найдено"
            hint={`По запросу «${query}» совпадений нет.`}
          />
        ) : (
          <div className="pt-2">
            {matchedChats.length > 0 && (
              <Section title="Чаты">
                {matchedChats.map((c, i) => {
                  const title =
                    c.chat.type === "direct" ? c.peer?.displayName ?? "?" : c.chat.title ?? "Группа";
                  return (
                    <Row key={c.chat.id} index={i} onClick={() => navigate(`/chat/${c.chat.id}`)}>
                      <Avatar
                        name={title}
                        avatarKey={c.chat.type === "direct" ? c.peer?.avatarKey : c.chat.avatarKey}
                        size={44}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5 font-bold text-[14.5px] tcy-text">
                          <span className="truncate">{title}</span>
                          {c.chat.type === "direct" && isTesterUsername(c.peer?.username, c.peer?.userId) && <TesterBadge />}
                        </div>
                        <div className="text-[12px] tcy-faint truncate">
                          {c.chat.type === "direct" ? `@${c.peer?.username}` : `${c.membersCount} участн.`}
                        </div>
                      </div>
                    </Row>
                  );
                })}
              </Section>
            )}
            {(users.data?.length ?? 0) > 0 && (
              <Section title="Люди">
                {users.data!.map((p, i) => (
                  <Row key={p.id} index={i} onClick={() => createDirect.mutate({ userId: p.userId })}>
                    <Avatar
                      name={p.displayName}
                      avatarKey={p.avatarKey}
                      size={44}
                      lastSeenAt={p.lastSeenAt}
                      showOnline
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1.5 font-bold text-[14.5px] tcy-text">
                        <span className="truncate">{p.displayName}</span>
                        {isTesterUsername(p.username, p.userId) && <TesterBadge />}
                      </div>
                      <div className="text-[12px] truncate">
                        <span className="tcy-accent font-semibold">@{p.username}</span>
                        <span className="tcy-faint">
                          {" "}
                          · {isOnline(p.lastSeenAt) ? "в сети" : "не в сети"}
                        </span>
                      </div>
                    </div>
                    <span className="text-[12px] font-bold tcy-accent shrink-0">Написать</span>
                  </Row>
                ))}
              </Section>
            )}
            {(msgSearch.data?.length ?? 0) > 0 && (
              <Section title="Сообщения">
                {msgSearch.data!.map((m, i) => (
                  <Row key={m.id} index={i} onClick={() => navigate(`/chat/${m.chatId}`)}>
                    <span className="w-11 h-11 rounded-full tcy-card flex items-center justify-center shrink-0 tcy-accent">
                      {m.kind === "voice" ? <Mic size={17} /> : <FileText size={17} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-[13.5px] tcy-text truncate">
                        {m.sender?.displayName ?? "Сообщение"}
                      </div>
                      <div className="text-[12.5px] tcy-dim truncate">
                        {m.kind === "voice" ? "Голосовое сообщение" : m.body}
                      </div>
                    </div>
                    <span className="text-[11px] tcy-faint shrink-0">{formatChatTime(m.createdAt)}</span>
                  </Row>
                ))}
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <h4 className="px-5 py-2 text-[12px] font-bold uppercase tracking-[0.08em] tcy-faint">
        {title}
      </h4>
      <div className="px-2">{children}</div>
    </div>
  );
}

function Row({
  children,
  onClick,
  index,
}: {
  children: React.ReactNode;
  onClick: () => void;
  index: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.25) }}
      onClick={onClick}
      className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-[20px] text-left tcy-press active:bg-[color:var(--tcy-card)]"
    >
      {children}
    </motion.button>
  );
}
