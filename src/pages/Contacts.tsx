import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Search, UserRound, Users } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Avatar } from "@/components/Avatar";
import { TesterBadge } from "@/components/TesterBadge";
import { isTesterUsername } from "@/lib/testers";
import { EmptyState } from "@/components/EmptyState";
import { formatLastSeen, isOnline } from "@/lib/format";

export default function Contacts() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const directory = trpc.profile.directory.useQuery(undefined, { staleTime: 30_000 });
  const search = trpc.profile.search.useQuery(
    { query: q },
    { enabled: q.trim().length >= 2, staleTime: 10_000 },
  );
  const createDirect = trpc.chats.createDirect.useMutation({
    onSuccess: (r) => navigate(`/chat/${r.chatId}`),
  });

  const list = q.trim().length >= 2 ? (search.data ?? []) : (directory.data ?? []);

  return (
    <div className="relative h-full flex flex-col">
      <header className="relative z-10 px-5 pt-5 safe-top pb-3">
        <h1 className="text-[24px] font-extrabold tcy-text">Люди</h1>
        <div className="mt-3.5 relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 tcy-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Найти по имени или @username"
            className="w-full h-11 pl-11 pr-4 rounded-[18px] tcy-card border tcy-line text-[14px] font-medium tcy-text placeholder:text-[color:var(--tcy-faint)] outline-none focus:border-[color:var(--tcy-accent)] transition-colors"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-28 relative z-10">
        <div className="px-5 py-2 text-[12px] font-bold uppercase tracking-[0.08em] tcy-faint">
          {q.trim().length >= 2 ? "Результаты поиска" : "Все пользователи"}
        </div>
        {directory.isLoading && q.trim().length < 2 ? (
          <div className="space-y-1 px-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3.5 px-3 py-2.5">
                <div className="tcy-skeleton w-12 h-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="tcy-skeleton h-3 rounded-full w-1/3" />
                  <div className="tcy-skeleton h-2.5 rounded-full w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Users size={32} />}
            title={q ? "Никого не нашли" : "Пока никого нет"}
            hint={
              q
                ? "Проверьте написание username — регистр не важен."
                : "Пригласите друзей в TeleChatYou — и они появятся здесь."
            }
          />
        ) : (
          <div className="px-2">
            {list.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.25) }}
                className="flex items-center gap-3.5 px-3 py-2.5 rounded-[20px] active:bg-[color:var(--tcy-card)]"
              >
                <button
                  onClick={() => navigate(`/user/${p.userId}`)}
                  className="flex items-center gap-3.5 flex-1 min-w-0 text-left tcy-press"
                >
                  <Avatar
                    name={p.displayName}
                    avatarKey={p.avatarKey}
                    size={48}
                    lastSeenAt={p.lastSeenAt}
                    showOnline
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5 font-bold text-[14.5px] tcy-text">
                      <span className="truncate">{p.displayName}</span>
                      {isTesterUsername(p.username, p.userId) && <TesterBadge />}
                    </div>
                    <div className="text-[12.5px] tcy-faint truncate">
                      @{p.username} ·{" "}
                      <span style={{ color: isOnline(p.lastSeenAt) ? "var(--tcy-accent)" : undefined }}>
                        {formatLastSeen(p.lastSeenAt)}
                      </span>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => createDirect.mutate({ userId: p.userId })}
                  disabled={createDirect.isPending}
                  className="tcy-press h-9 px-4 rounded-full tcy-card-strong text-[12.5px] font-bold tcy-accent shrink-0"
                >
                  Написать
                </button>
              </motion.div>
            ))}
          </div>
        )}
        {list.length === 0 && !directory.isLoading && q.trim().length < 2 && (
          <div className="flex justify-center pt-2">
            <UserRound size={0} className="hidden" />
          </div>
        )}
      </div>
    </div>
  );
}
