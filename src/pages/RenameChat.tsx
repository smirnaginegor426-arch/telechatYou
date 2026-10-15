import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Check, Pencil } from "lucide-react";
import { trpc } from "@/providers/trpc";

export default function RenameChat() {
  const { chatId: rawChatId } = useParams<{ chatId: string }>();
  const chatId = Number(rawChatId);
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const info = trpc.chats.info.useQuery({ chatId }, { enabled: Number.isSafeInteger(chatId) && chatId > 0 });
  const contactNamesQuery = trpc.accountData.contactNames.get.useQuery();
  const [name, setName] = useState("");
  const [initializedFor, setInitializedFor] = useState<number | null>(null);

  const peer = info.data?.peer;
  const names = contactNamesQuery.data?.names ?? {};

  useEffect(() => {
    if (!peer || initializedFor === peer.userId) return;
    setName(names[String(peer.userId)] ?? peer.displayName);
    setInitializedFor(peer.userId);
  }, [peer?.userId, peer?.displayName, names, initializedFor]);

  const save = trpc.accountData.contactNames.save.useMutation({
    onSuccess: async ({ names: savedNames }) => {
      utils.accountData.contactNames.get.setData(undefined, { names: savedNames });
      await utils.chats.list.invalidate();
      navigate(-1);
    },
  });

  const originalName = peer?.displayName ?? "";
  const canSave = !!peer && !!name.trim() && name.trim().length <= 64 && name.trim() !== (names[String(peer.userId)] ?? originalName);

  const saveName = () => {
    if (!peer || !canSave) return;
    const next = { ...names };
    const clean = name.trim();
    if (clean === originalName) delete next[String(peer.userId)];
    else next[String(peer.userId)] = clean;
    save.mutate({ names: next });
  };

  return (
    <div className="relative flex h-full flex-col overflow-y-auto no-scrollbar">
      <header className="flex items-center gap-3 px-4 pt-4 pb-3 safe-top">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Назад"
          className="tcy-press flex h-10 w-10 items-center justify-center rounded-full tcy-card border tcy-line tcy-dim"
        >
          <ArrowLeft size={19} />
        </button>
        <h1 className="text-[20px] font-extrabold tcy-text">Изменить имя</h1>
      </header>

      <div className="mx-4 mt-5 rounded-[24px] border tcy-line tcy-card p-5">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[16px]" style={{ background: "color-mix(in srgb, var(--tcy-selected-accent) 14%, var(--tcy-card))", color: "var(--tcy-selected-accent)" }}>
          <Pencil size={21} />
        </div>
        <p className="text-[14px] leading-relaxed tcy-dim">
          Измените имя пользователя (изменённое имя видно только вам)
        </p>
        <label htmlFor="private-contact-name" className="mt-5 mb-2 block text-[12.5px] font-bold tcy-text">
          Имя пользователя
        </label>
        <input
          id="private-contact-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={64}
          autoComplete="off"
          placeholder="Введите имя"
          disabled={info.isLoading || !peer}
          className="h-12 w-full rounded-[16px] border tcy-line tcy-card-strong px-4 text-[14px] tcy-text outline-none focus:border-[color:var(--tcy-selected-accent)]"
          onKeyDown={(event) => {
            if (event.key === "Enter") saveName();
          }}
        />
        <p className="mt-2 text-[11.5px] tcy-faint">
          Это имя будет отображаться в твоих чатах и списке людей. Настоящее имя пользователя не изменится.
        </p>
        <button
          type="button"
          disabled={!canSave || save.isPending}
          onClick={saveName}
          className="tcy-press mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full tcy-gradient-accent text-[14px] font-bold disabled:opacity-45"
          style={{ color: "var(--tcy-selected-on-accent)" }}
        >
          <Check size={18} />
          {save.isPending ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
