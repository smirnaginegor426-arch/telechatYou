import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Send, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Avatar } from "@/components/Avatar";
import type { MessageItem } from "@/types/api";

export function ChannelCommentsSheet({
  open,
  onClose,
  chatId,
  post,
}: {
  open: boolean;
  onClose: () => void;
  chatId: number;
  post: MessageItem | null;
}) {
  const postId = post?.id ?? 0;
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();
  const comments = trpc.channels.listComments.useQuery(
    { chatId, postId },
    { enabled: open && !!post, refetchInterval: open ? 7000 : false },
  );

  const addComment = trpc.channels.addComment.useMutation({
    onSuccess: async () => {
      setDraft("");
      await Promise.all([
        utils.channels.listComments.invalidate({ chatId, postId }),
        utils.channels.commentCounts.invalidate({ chatId }),
      ]);
    },
    onError: (error) => toast.error(error.message || "Не удалось отправить комментарий"),
  });

  useEffect(() => {
    if (!open) setDraft("");
  }, [open, postId]);

  useEffect(() => {
    const element = listRef.current;
    if (!element || !open) return;
    element.scrollTop = element.scrollHeight;
  }, [open, comments.data?.length]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !post || addComment.isPending) return;
    addComment.mutate({ chatId, postId: post.id, body });
  };

  const postPreview = post?.body?.trim()
    || (post?.kind === "image" ? "Фото" : post?.kind === "file" ? (post.attachmentName ?? "Файл") : post?.kind === "voice" ? "Голосовое сообщение" : "Публикация");

  return createPortal(
    <AnimatePresence>
      {open && post && (
        <>
          <motion.button
            key="channel-comments-backdrop"
            type="button"
            aria-label="Закрыть комментарии"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[120] cursor-default"
            style={{ background: "rgba(0,0,0,.56)", backdropFilter: "blur(5px)" }}
          />
          <motion.section
            key={`channel-comments-${post.id}`}
            role="dialog"
            aria-modal="true"
            aria-label="Комментарии к публикации"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="fixed bottom-0 left-0 right-0 z-[121] mx-auto flex h-[76dvh] max-h-[760px] min-h-[420px] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-b-0 tcy-line tcy-solid"
            style={{ boxShadow: "0 -16px 50px rgba(0,0,0,.22)" }}
          >
            <div className="flex shrink-0 justify-center pb-2 pt-3" aria-hidden="true">
              <span className="h-1.5 w-10 rounded-full" style={{ background: "var(--tcy-line-strong)" }} />
            </div>
            <header className="flex shrink-0 items-center gap-3 px-4 pb-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]"
                style={{ background: "color-mix(in srgb, var(--tcy-selected-accent) 15%, var(--tcy-card))", color: "var(--tcy-selected-accent)" }}
              >
                <MessageCircle size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[16px] font-extrabold tcy-text">Комментарии</h2>
                <p className="text-[11.5px] tcy-faint">Обсуждение публикации</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Закрыть" className="tcy-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full tcy-card tcy-dim">
                <X size={18} />
              </button>
            </header>

            <div className="mx-4 mb-1 shrink-0 rounded-[15px] border tcy-line tcy-card px-3 py-2.5">
              <p className="text-[10.5px] font-bold tcy-accent">Публикация</p>
              <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-[12.5px] tcy-dim">{postPreview}</p>
            </div>

            <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {comments.isLoading ? (
                <div className="flex h-24 items-center justify-center">
                  <span className="h-6 w-6 animate-spin rounded-full border-2 tcy-line border-t-[color:var(--tcy-accent)]" />
                </div>
              ) : comments.isError ? (
                <div className="px-3 py-8 text-center text-[12.5px] tcy-dim">
                  Не удалось загрузить комментарии. Закрой окно и попробуй снова.
                </div>
              ) : comments.data?.length ? (
                <div className="space-y-4">
                  {comments.data.map((comment) => (
                    <article key={comment.id} className="flex items-start gap-2.5">
                      <Avatar
                        name={comment.sender?.displayName ?? "Пользователь"}
                        avatarKey={comment.sender?.avatarKey ?? null}
                        size={34}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-baseline gap-2">
                          <span className="truncate text-[12.5px] font-bold tcy-text">{comment.sender?.displayName ?? "Пользователь"}</span>
                          <time className="shrink-0 text-[10px] tcy-faint">
                            {comment.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </time>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed tcy-text">{comment.body}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="flex h-full min-h-[140px] flex-col items-center justify-center px-5 text-center">
                  <MessageCircle size={27} className="mb-2 tcy-faint" />
                  <p className="text-[13px] font-bold tcy-text">Пока нет комментариев</p>
                  <p className="mt-1 text-[11.5px] tcy-faint">Будь первым, кто обсудит эту публикацию</p>
                </div>
              )}
            </div>

            <form onSubmit={submit} className="flex shrink-0 items-end gap-2 border-t tcy-line px-3 py-3 safe-bottom">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={2000}
                rows={1}
                placeholder="Написать комментарий…"
                aria-label="Текст комментария"
                className="min-h-[42px] max-h-[104px] min-w-0 flex-1 resize-none rounded-[21px] border tcy-line tcy-card px-4 py-3 text-[13.5px] leading-relaxed tcy-text outline-none"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <button
                type="submit"
                disabled={!draft.trim() || addComment.isPending}
                aria-label="Отправить комментарий"
                className="tcy-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full tcy-gradient-accent disabled:opacity-45"
                style={{ color: "var(--tcy-on-accent)" }}
              >
                <Send size={18} />
              </button>
            </form>
          </motion.section>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
