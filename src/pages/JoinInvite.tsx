import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Check, Link2Off, Users } from "lucide-react";
import { motion } from "framer-motion";
import { trpc } from "@/providers/trpc";
import { Avatar } from "@/components/Avatar";
import { TcButton } from "@/components/TcButton";

/** Landing page for chat/channel invite links: /invite/:token */
export default function JoinInvite() {
  const navigate = useNavigate();
  const { token = "" } = useParams();
  const utils = trpc.useUtils();
  const [error, setError] = useState("");

  const preview = trpc.channels.invitePreview.useQuery(
    { token },
    { retry: false, refetchOnWindowFocus: false },
  );
  const join = trpc.channels.joinByInvite.useMutation();

  const open = (chatId: number) => {
    utils.chats.list.invalidate();
    navigate(`/chat/${chatId}`, { replace: true });
  };

  const accept = async () => {
    setError("");
    try {
      const result = await join.mutateAsync({ token });
      await utils.chats.list.invalidate();
      open(result.chatId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось присоединиться. Попробуй ещё раз.");
    }
  };

  return (
    <div className="relative h-full flex flex-col items-center justify-center overflow-hidden px-5">
      <button
        type="button"
        onClick={() => navigate("/", { replace: true })}
        aria-label="На главную"
        className="tcy-press absolute w-10 h-10 rounded-full tcy-card border tcy-line flex items-center justify-center tcy-dim"
        style={{ top: "max(16px, env(safe-area-inset-top))", left: "max(16px, env(safe-area-inset-left))" }}
      >
        <ArrowLeft size={19} />
      </button>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-56"
        style={{
          background:
            "radial-gradient(90% 100% at 50% 100%, color-mix(in srgb, var(--tcy-selected-accent) 16%, transparent) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      {preview.isLoading && (
        <div className="relative z-10 flex flex-col items-center gap-4 text-center">
          <div className="h-24 w-24 rounded-[30px] border tcy-line tcy-card animate-pulse" />
          <div className="h-6 w-44 rounded-full tcy-card animate-pulse" />
          <p className="text-[12.5px] tcy-faint">Открываем приглашение…</p>
        </div>
      )}

      {preview.isError && !preview.isLoading && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex max-w-[340px] flex-col items-center text-center"
        >
          <span className="flex h-24 w-24 items-center justify-center rounded-[30px] border tcy-line tcy-card">
            <Link2Off size={40} className="tcy-faint" />
          </span>
          <h1 className="mt-6 text-[22px] font-black tcy-text">Ссылка не работает</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed tcy-dim">
            Приглашение недействительно или его создатель убрал канал. Попроси новую ссылку у того, кто ей поделился.
          </p>
          <div className="mt-7 w-full">
            <TcButton size="lg" className="w-full" onClick={() => navigate("/", { replace: true })}>
              На главную
            </TcButton>
          </div>
        </motion.section>
      )}

      {preview.data && (
        <motion.section
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 250, damping: 26 }}
          className="relative z-10 flex w-full max-w-[360px] flex-col items-center text-center"
        >
          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.2em] tcy-accent">
            Приглашение
          </p>
          <div className="mt-5">
            <Avatar
              name={preview.data.title}
              avatarKey={preview.data.avatarKey}
              size={96}
            />
          </div>
          <h1 className="mt-5 text-[24px] font-black leading-tight tcy-text">
            {preview.data.title}
          </h1>
          <p
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border tcy-line px-3 py-1.5 text-[11.5px] font-bold"
            style={{
              background: "var(--tcy-card)",
              color: "var(--tcy-dim)",
            }}
          >
            <Users size={14} className="tcy-faint" />
            {preview.data.membersCount} {preview.data.membersCount === 1 ? "участник" : preview.data.membersCount < 5 ? "участника" : "участников"}
          </p>

          {error && (
            <p role="alert" className="mt-4 rounded-[15px] border px-3.5 py-2.5 text-[12.5px]" style={{ borderColor: "var(--tcy-danger)", color: "var(--tcy-danger)" }}>
              {error}
            </p>
          )}

          <div className="mt-7 w-full space-y-2.5">
            {preview.data.joined ? (
              <TcButton size="lg" className="w-full" onClick={() => open(preview.data!.chatId)}>
                <Check size={18} /> Открыть {preview.data.kind === "group" ? "группу" : "канал"}
              </TcButton>
            ) : (
              <TcButton size="lg" className="w-full" loading={join.isPending} onClick={() => void accept()}>
                Присоединиться
              </TcButton>
            )}
          </div>
        </motion.section>
      )}
    </div>
  );
}
