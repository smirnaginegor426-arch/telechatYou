import { useEffect, useState } from "react";
import { BarChart3, Check, LockKeyhole, Send, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import type { MessageItem } from "@/types/api";

type PollData = NonNullable<MessageItem["poll"]>;

export function PollCard({ poll, own }: { poll: PollData; own: boolean }) {
  const utils = trpc.useUtils();
  const [selectedIds, setSelectedIds] = useState<number[]>(poll.votedOptionIds);
  const [error, setError] = useState("");
  const vote = trpc.messages.votePoll.useMutation({
    onSuccess: async () => {
      setError("");
      await utils.messages.list.invalidate({ chatId: poll.chatId });
    },
    onError: (cause) => setError(cause.message),
  });
  const close = trpc.messages.closePoll.useMutation({
    onSuccess: async () => {
      setError("");
      await utils.messages.list.invalidate({ chatId: poll.chatId });
    },
    onError: (cause) => setError(cause.message),
  });

  useEffect(() => {
    setSelectedIds(poll.votedOptionIds);
  }, [poll.votedOptionIds.join(",")]);

  const closed = Boolean(poll.closedAt);
  const hasVoted = poll.votedOptionIds.length > 0;
  const maxVotes = Math.max(1, ...poll.options.map((option) => option.votes));

  const toggle = (id: number) => {
    if (closed || vote.isPending) return;
    setSelectedIds((current) => {
      if (!poll.allowMultiple) return [id];
      return current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    });
  };

  return (
    <section
      className="my-1 w-[min(280px,76vw)] rounded-[18px] border p-3.5 space-y-3"
      style={{ background: "var(--tcy-card)", borderColor: "var(--tcy-line)", color: "var(--tcy-text)" }}
      aria-label="Опрос"
    >
      <div className="flex items-start gap-2.5">
        <span className="w-9 h-9 shrink-0 rounded-[12px] flex items-center justify-center" style={{ background: "var(--tcy-card-strong)", color: "var(--tcy-accent)" }}>
          <BarChart3 size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-extrabold leading-snug break-words">{poll.question}</h3>
          <p className="text-[10.5px] tcy-faint mt-1">
            {poll.allowMultiple ? "Можно выбрать несколько вариантов" : "Выберите один вариант"}
          </p>
        </div>
        {closed && <LockKeyhole size={15} className="tcy-faint shrink-0 mt-1" />}
      </div>

      <div className="space-y-2">
        {poll.options.map((option) => {
          const picked = selectedIds.includes(option.id);
          const voted = poll.votedOptionIds.includes(option.id);
          const percentage = poll.totalVotes ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
          const showResults = hasVoted || closed;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => toggle(option.id)}
              disabled={closed || vote.isPending}
              className="relative w-full min-h-10 rounded-[12px] border px-3 py-2 text-left overflow-hidden disabled:cursor-default"
              style={{
                borderColor: picked || voted ? "var(--tcy-accent)" : "var(--tcy-line)",
                background: "var(--tcy-card)",
              }}
            >
              {showResults && (
                <span
                  className="absolute inset-y-0 left-0 pointer-events-none"
                  style={{
                    width: `${percentage}%`,
                    background: "color-mix(in srgb, var(--tcy-accent) 13%, transparent)",
                  }}
                />
              )}
              <span className="relative flex items-center gap-2">
                <span
                  className="w-[17px] h-[17px] shrink-0 rounded-full border flex items-center justify-center"
                  style={{ borderColor: picked || voted ? "var(--tcy-accent)" : "var(--tcy-line-strong)" }}
                >
                  {(picked || voted) && <span className="w-2 h-2 rounded-full" style={{ background: "var(--tcy-accent)" }} />}
                </span>
                <span className="text-[12.5px] flex-1 break-words">{option.text}</span>
                {showResults && <span className="text-[11px] font-bold shrink-0">{percentage}%</span>}
                {voted && <Check size={13} className="tcy-accent shrink-0" />}
              </span>
              {showResults && (
                <span className="relative block text-[10px] tcy-faint mt-1 pl-6">
                  {option.votes} {option.votes === 1 ? "голос" : option.votes >= 2 && option.votes <= 4 ? "голоса" : "голосов"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] tcy-faint">{poll.totalVotes} голос(ов){hasVoted ? " · вы проголосовали" : ""}</span>
        {!closed && !hasVoted && (
          <button
            type="button"
            onClick={() => vote.mutate({ pollId: poll.id, optionIds: selectedIds })}
            disabled={!selectedIds.length || vote.isPending}
            className="tcy-press inline-flex items-center gap-1.5 h-8 px-3 rounded-[11px] tcy-gradient-accent text-[11.5px] font-bold disabled:opacity-50"
            style={{ color: "var(--tcy-on-accent)" }}
          >
            <Send size={12} /> Голосовать
          </button>
        )}
        {!closed && hasVoted && (
          <button
            type="button"
            onClick={() => vote.mutate({ pollId: poll.id, optionIds: selectedIds })}
            disabled={!selectedIds.length || vote.isPending}
            className="tcy-press inline-flex items-center h-8 px-3 rounded-[11px] tcy-card border tcy-line text-[11.5px] font-bold disabled:opacity-50"
          >
            Изменить голос
          </button>
        )}
        {closed && <span className="text-[11px] font-bold tcy-faint">Завершён</span>}
      </div>

      {own && !closed && (
        <button
          type="button"
          onClick={() => close.mutate({ pollId: poll.id })}
          disabled={close.isPending}
          className="tcy-press text-[11px] font-semibold tcy-faint inline-flex items-center gap-1"
        >
          <X size={12} /> Закрыть опрос
        </button>
      )}
      {error && <p role="alert" className="text-[11px]" style={{ color: "var(--tcy-danger)" }}>{error}</p>}
    </section>
  );
}
