import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  CircleHelp,
  Copy,
  Globe2,
  Link2,
  LockKeyhole,
  Radio,
  Search,
  Users,
  UserRoundPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Avatar } from "@/components/Avatar";
import { AvatarEditor } from "@/components/AvatarEditor";
import { TcButton } from "@/components/TcButton";
import { TcInput } from "@/components/TcInput";
import { fileToBase64 } from "@/lib/format";
import { useExperimentalUI } from "@/hooks/useExperimentalUI";
import { cn } from "@/lib/utils";

type CommunityKind = "channel" | "group";
type WizardStep = "choose" | "details" | "avatar" | "success" | "members";

const backgroundShapes = [
  { x: "7%", y: "12%", size: 34, radius: 10, rotate: 18 },
  { x: "82%", y: "9%", size: 23, radius: 50, rotate: -20 },
  { x: "72%", y: "28%", size: 46, radius: 15, rotate: 32 },
  { x: "12%", y: "39%", size: 20, radius: 50, rotate: 0 },
  { x: "88%", y: "48%", size: 31, radius: 8, rotate: 44 },
  { x: "21%", y: "66%", size: 42, radius: 50, rotate: -15 },
  { x: "77%", y: "76%", size: 21, radius: 6, rotate: 20 },
  { x: "9%", y: "86%", size: 29, radius: 9, rotate: 55 },
  { x: "48%", y: "15%", size: 17, radius: 50, rotate: 0 },
  { x: "54%", y: "84%", size: 36, radius: 12, rotate: -32 },
];

/**
 * Create flow router. The private experimental account gets the simple
 * wizard («Как назовем канал?» → «Каким ты хочешь сделать канал?»), while
 * everyone else keeps the classic step-by-step creation screen.
 */
export default function CreateCommunity() {
  const { enabled: experimentalUI } = useExperimentalUI();
  return experimentalUI ? <SimpleChannelWizard /> : <ClassicCreateWizard />;
}

type WizardChoice = "private" | "public";

function SimpleChannelWizard() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [step, setStep] = useState<"choose" | "name" | "type">("choose");
  const [kind, setKind] = useState<CommunityKind>("channel");
  const [title, setTitle] = useState("");
  const [choice, setChoice] = useState<WizardChoice | null>(null);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ chatId: number; inviteUrl: string | null } | null>(null);

  const createChannel = trpc.channels.create.useMutation();

  const trimmedTitle = title.trim();
  const isChannel = kind === "channel";
  const kindRole = isChannel ? "подписчики" : "участники";
  const normalizedUsername = username.trim().replace(/^@/, "").toLowerCase();
  const usernameIsValid = /^[a-z0-9_]{3,32}$/.test(normalizedUsername);
  const usernameCheck = trpc.channels.usernameAvailable.useQuery(
    { username: normalizedUsername },
    {
      enabled: choice === "public" && usernameIsValid && !done,
      staleTime: 2_000,
      retry: false,
    },
  );
  const usernameAvailable =
    usernameCheck.data?.username === normalizedUsername && usernameCheck.data.available === true;
  const busy = createChannel.isPending;

  const back = () => {
    setError("");
    if (done) {
      navigate(`/chat/${done.chatId}`, { replace: true });
      return;
    }
    if (step === "type") {
      setChoice(null);
      setUsername("");
      setStep("name");
      return;
    }
    if (step === "name") {
      setTitle("");
      setStep("choose");
      return;
    }
    navigate(-1);
  };

  const copyInvite = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(isChannel ? "Ссылка на канал скопирована" : "Ссылка на группу скопирована");
    } catch {
      toast.error("Не удалось скопировать ссылку. Выдели её и скопируй вручную.");
    }
  };

  const selectPrivate = async () => {
    if (done || busy || choice === "private") return;
    setError("");
    setChoice("private");
    try {
      const result = await createChannel.mutateAsync({
        kind,
        title: trimmedTitle,
        description: "",
        isPublic: false,
      });
      await utils.chats.list.invalidate();
      setDone({
        chatId: result.chatId,
        inviteUrl: result.inviteToken
          ? `${window.location.origin}/invite/${result.inviteToken}`
          : null,
      });
    } catch (cause) {
      setChoice(null);
      setError(cause instanceof Error ? cause.message : isChannel ? "Не удалось создать канал. Попробуй ещё раз." : "Не удалось создать группу. Попробуй ещё раз.");
    }
  };

  const finishPublic = async () => {
    if (done || busy || choice !== "public") return;
    setError("");
    if (!usernameIsValid) {
      setError("Username: от 3 до 32 символов — латинские буквы, цифры и _.");
      return;
    }
    if (!usernameAvailable) {
      setError("Проверь Username: имя занято или ещё проверяется.");
      return;
    }
    try {
      const result = await createChannel.mutateAsync({
        kind,
        title: trimmedTitle,
        description: "",
        isPublic: true,
        username: normalizedUsername,
      });
      await utils.chats.list.invalidate();
      navigate(`/chat/${result.chatId}`, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : isChannel ? "Не удалось создать канал. Попробуй ещё раз." : "Не удалось создать группу. Попробуй ещё раз.");
    }
  };

  const choiceCard = (variant: WizardChoice) => {
    const selected = choice === variant;
    const isPrivate = variant === "private";
    const creating = selected && busy;
    return (
      <button
        type="button"
        onClick={isPrivate ? () => void selectPrivate() : () => { setError(""); setChoice("public"); }}
        disabled={Boolean(done) || (busy && choice !== null)}
        className="tcy-press w-full rounded-[24px] border p-4 text-left transition-colors disabled:opacity-90"
        style={{
          borderColor: selected ? "var(--tcy-selected-accent)" : "var(--tcy-line)",
          background: selected
            ? "color-mix(in srgb, var(--tcy-selected-accent) 10%, var(--tcy-card))"
            : "var(--tcy-card)",
        }}
      >
        <div className="flex items-center gap-3.5">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px]"
            style={{
              background: selected
                ? "var(--tcy-selected-accent)"
                : "color-mix(in srgb, var(--tcy-selected-accent) 14%, var(--tcy-card))",
              color: selected ? "var(--tcy-selected-on-accent)" : "var(--tcy-selected-accent)",
            }}
          >
            {isPrivate ? <LockKeyhole size={21} /> : <Globe2 size={21} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15.5px] font-extrabold tcy-text">
              {isPrivate ? "Частный" : "Публичный"}
            </span>
            <span className="block text-[11.5px] tcy-faint">
              {creating
                ? (isChannel ? "Создаём канал…" : "Создаём группу…")
                : isPrivate
                  ? "Только по ссылке-приглашению"
                  : "Найдётся по Username"}
            </span>
          </span>
          {selected && (
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
              style={{ background: "var(--tcy-selected-accent)", color: "var(--tcy-selected-on-accent)" }}
            >
              <Check size={15} strokeWidth={3} />
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {/* размытый водяной знак «TeleChatYou» по всему фону экрана создания */}
        <div
          className="absolute -left-1/2 -top-1/2 w-[300%] h-[300%]"
          style={{
            transform: "rotate(-22deg)",
            transformOrigin: "center",
            opacity: 0.18,
            filter: "blur(3px)",
            color: "var(--tcy-text)",
          }}
        >
          <svg className="h-full w-full" aria-hidden="true">
            <defs>
              <pattern id="tcy-create-watermark" width="400" height="110" patternUnits="userSpaceOnUse">
                <text x="14" y="48" fontSize="28" fontWeight="900" fill="currentColor">
                  TeleChatYou
                </text>
                <text x="214" y="100" fontSize="28" fontWeight="900" fill="currentColor">
                  TeleChatYou
                </text>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#tcy-create-watermark)" />
          </svg>
        </div>
        {backgroundShapes.map((shape, index) => (
          <motion.span
            key={index}
            className="absolute border"
            initial={{ opacity: 0, rotate: shape.rotate, scale: 0.72 }}
            animate={{
              opacity: [0.08, 0.22, 0.1],
              rotate: [shape.rotate, shape.rotate + 28, shape.rotate - 12, shape.rotate],
              y: [0, -10, 9, 0],
              scale: [0.92, 1.06, 0.96, 0.92],
            }}
            transition={{ duration: 8 + (index % 4) * 1.7, repeat: Infinity, delay: index * 0.22, ease: "easeInOut" }}
            style={{
              left: shape.x,
              top: shape.y,
              width: shape.size,
              height: shape.size,
              borderRadius: shape.radius,
              borderColor: "color-mix(in srgb, var(--tcy-selected-accent) 46%, transparent)",
              background: "color-mix(in srgb, var(--tcy-selected-accent) 7%, transparent)",
            }}
          />
        ))}
      </div>

      <header className="relative z-10 flex items-center gap-3 px-4 pt-5 safe-top pb-3">
        <button
          type="button"
          onClick={back}
          aria-label="Назад"
          className="tcy-press w-10 h-10 rounded-full tcy-card border tcy-line flex items-center justify-center tcy-dim"
        >
          <ArrowLeft size={19} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.16em] font-extrabold tcy-faint">TeleChat You</p>
          <h1 className="text-[18px] font-extrabold tcy-text">
            {step === "choose"
              ? "Создание"
              : step === "name"
                ? (isChannel ? "Новый канал" : "Новая группа")
                : (isChannel ? "Тип канала" : "Тип группы")}
          </h1>
        </div>
      </header>

      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto no-scrollbar px-4 pb-8">
        <AnimatePresence mode="wait" initial={false}>
          {step === "choose" && (
            <motion.section
              key="choose"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22 }}
              className="flex min-h-[52vh] flex-col items-center justify-center text-center"
            >
              <h2 className="text-[27px] leading-tight font-black tcy-text">Что создаём?</h2>
              <p className="mt-2.5 max-w-[320px] text-[13.5px] leading-relaxed tcy-dim">
                Выбери формат — дальше придумаем название.
              </p>
              <div className="mt-8 grid w-full max-w-[420px] gap-2.5">
                <button
                  type="button"
                  onClick={() => { setError(""); setKind("channel"); setStep("name"); }}
                  className="tcy-press flex w-full items-center gap-3.5 rounded-[22px] border tcy-line tcy-card px-4 py-3.5 text-left"
                >
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px]"
                    style={{
                      background: "color-mix(in srgb, var(--tcy-selected-accent) 16%, var(--tcy-card))",
                      color: "var(--tcy-selected-accent)",
                    }}
                  >
                    <Radio size={22} strokeWidth={2.1} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-extrabold tcy-text">Канал</span>
                    <span className="block text-[11.5px] tcy-faint">Публикации для подписчиков</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 tcy-faint" />
                </button>

                <button
                  type="button"
                  onClick={() => { setError(""); setKind("group"); setStep("name"); }}
                  className="tcy-press flex w-full items-center gap-3.5 rounded-[22px] border tcy-line tcy-card px-4 py-3.5 text-left"
                >
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px]"
                    style={{
                      background: "color-mix(in srgb, var(--tcy-selected-accent) 16%, var(--tcy-card))",
                      color: "var(--tcy-selected-accent)",
                    }}
                  >
                    <Users size={22} strokeWidth={2.1} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-extrabold tcy-text">Группа</span>
                    <span className="block text-[11.5px] tcy-faint">Общий чат для общения</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 tcy-faint" />
                </button>
              </div>
            </motion.section>
          )}

          {step === "name" && (
            <motion.section
              key="name"
              initial={{ opacity: 0, x: 22 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
              className="flex min-h-[52vh] flex-col items-center justify-center text-center"
            >
              <span
                className="flex h-20 w-20 items-center justify-center rounded-[26px]"
                style={{
                  background: "color-mix(in srgb, var(--tcy-selected-accent) 16%, var(--tcy-card))",
                  color: "var(--tcy-selected-accent)",
                }}
              >
                {isChannel ? <Radio size={40} strokeWidth={2} /> : <Users size={40} strokeWidth={2} />}
              </span>
              <h2 className="mt-7 text-[27px] leading-tight font-black tcy-text">
                {isChannel ? "Как назовем канал?" : "Как назовем группу?"}
              </h2>
              <div className="mt-5 w-full max-w-[420px] text-left">
                <TcInput
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 96))}
                  maxLength={96}
                  placeholder={isChannel ? "Название канала" : "Название группы"}
                  autoFocus
                  autoComplete="off"
                  onKeyDown={(e) => { if (e.key === "Enter" && trimmedTitle) setStep("type"); }}
                />
              </div>
              <p className="mt-3 max-w-[320px] text-[13.5px] leading-relaxed tcy-dim">
                Название увидят {kindRole} — его можно будет изменить в любой момент.
              </p>
            </motion.section>
          )}

          {step === "type" && (
            <motion.section
              key="type"
              initial={{ opacity: 0, x: 22 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
              className="mx-auto w-full max-w-[560px] pt-2"
            >
              <h2 className="text-[25px] leading-tight font-black tcy-text">
                {isChannel ? "Каким ты хочешь сделать канал?" : "Каким ты хочешь сделать группу?"}
              </h2>
              <p className="mt-1.5 text-[13px] tcy-dim">
                Название: «{trimmedTitle}» — позже можно поменять.
              </p>

              <div className="mt-5 grid gap-2.5">
                {choiceCard("private")}
                {choiceCard("public")}
              </div>

              {choice === "public" && !done && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-3.5 rounded-[22px] border tcy-line tcy-card p-4 space-y-2"
                >
                  <span className="block text-[12px] font-bold tcy-dim">
                    {isChannel ? "Ссылка канала" : "Ссылка группы"} (Username)
                  </span>
                  <div className="flex h-12 items-center rounded-[16px] tcy-card border tcy-line px-3.5 focus-within:border-[color:var(--tcy-accent)]">
                    <span className="text-[14px] tcy-faint">@</span>
                    <input
                      value={username}
                      onChange={(event) =>
                        setUsername(event.target.value.replace(/[^a-zA-Z0-9_@]/g, "").replace(/^@+/, "").slice(0, 32))
                      }
                      maxLength={32}
                      placeholder={isChannel ? "my_channel" : "my_group"}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      className="h-full min-w-0 flex-1 bg-transparent px-2 text-[14px] tcy-text outline-none"
                    />
                    {usernameIsValid && usernameCheck.data?.username === normalizedUsername && (
                      usernameCheck.data.available
                        ? <Check size={17} className="shrink-0" style={{ color: "var(--tcy-selected-accent)" }} />
                        : <X size={17} className="shrink-0" style={{ color: "var(--tcy-danger)" }} />
                    )}
                  </div>
                  <span className="block text-[11px] tcy-faint">
                    {!usernameIsValid
                      ? "От 3 до 32 символов: латиница, цифры и _."
                      : usernameCheck.isFetching || usernameCheck.data?.username !== normalizedUsername
                        ? "Проверяем доступность Username…"
                        : usernameCheck.data.available
                          ? (isChannel ? "Имя свободно — по нему откроется канал." : "Имя свободно — по нему откроется группа.")
                          : "Такое имя уже занято. Попробуй другое."}
                  </span>
                </motion.div>
              )}

              {done && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-3.5 rounded-[22px] border tcy-line tcy-card p-4 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: "color-mix(in srgb, var(--tcy-selected-accent) 16%, var(--tcy-card))",
                        color: "var(--tcy-selected-accent)",
                      }}
                    >
                      <Link2 size={18} />
                    </span>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-[14px] font-extrabold tcy-text">
                        {isChannel ? "Канал создан!" : "Группа создана!"}
                      </p>
                      <p className="text-[11.5px] tcy-faint">Ссылка-приглашение для подписки</p>
                    </div>
                  </div>
                  {done.inviteUrl && (
                    <div
                      className="flex items-center gap-2.5 rounded-[16px] border tcy-line px-3.5 py-3"
                      style={{ background: "var(--tcy-card-strong)" }}
                    >
                      <span className="min-w-0 flex-1 truncate font-mono text-[12px] tcy-text">
                        {done.inviteUrl}
                      </span>
                      <button
                        type="button"
                        onClick={() => void copyInvite(done.inviteUrl!)}
                        className="tcy-press flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11.5px] font-extrabold"
                        style={{
                          background: "color-mix(in srgb, var(--tcy-selected-accent) 16%, transparent)",
                          color: "var(--tcy-selected-accent)",
                        }}
                      >
                        <Copy size={14} /> Копировать
                      </button>
                    </div>
                  )}
                  <p className="text-left text-[11.5px] leading-relaxed tcy-faint">
                    {isChannel
                      ? "Отправь ссылку друзьям — по ней они сразу подпишутся на закрытый канал."
                      : "Отправь ссылку друзьям — по ней они сразу присоединятся к закрытой группе."}
                  </p>
                </motion.div>
              )}

              {error && (
                <p role="alert" className="mt-4 rounded-[15px] border px-3.5 py-3 text-[12.5px]" style={{ borderColor: "var(--tcy-danger)", color: "var(--tcy-danger)" }}>
                  {error}
                </p>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {step !== "choose" && (
        <footer
          className="relative z-20 shrink-0 border-t tcy-line px-4 pt-3"
          style={{
            background: "color-mix(in srgb, var(--tcy-bg) 91%, transparent)",
            backdropFilter: "blur(20px)",
            paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
          }}
        >
        <div className="mx-auto w-full max-w-[560px]">
          {step === "name" && (
            <TcButton
              size="lg"
              disabled={!trimmedTitle}
              onClick={() => { setError(""); setStep("type"); }}
            >
              Продолжить <ChevronRight size={18} />
            </TcButton>
          )}
          {step === "type" &&
            (done ? (
              <TcButton
                size="lg"
                onClick={() => navigate(`/chat/${done.chatId}`, { replace: true })}
              >
                Завершить <Check size={18} />
              </TcButton>
            ) : choice === "public" ? (
              <TcButton
                size="lg"
                loading={busy}
                disabled={!usernameAvailable}
                onClick={() => void finishPublic()}
              >
                Завершить <Check size={18} />
              </TcButton>
            ) : choice === null && !error ? (
              <p className="py-2 text-center text-[12px] tcy-dim">Выбери тип: «Частный» или «Публичный».</p>
            ) : null)}
        </div>
        </footer>
      )}
    </div>
  );
}

function ClassicCreateWizard() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const me = trpc.profile.me.useQuery(undefined, { staleTime: 30_000 });
  const displayName = me.data?.profile?.displayName ?? me.data?.user?.username ?? "друг";

  const [step, setStep] = useState<WizardStep>("choose");
  const [kind, setKind] = useState<CommunityKind>("channel");
  const [isPublic, setIsPublic] = useState(true);
  const [username, setUsername] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarToEdit, setAvatarToEdit] = useState<File | null>(null);
  const [createdChatId, setCreatedChatId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!avatarPreview) return;
    return () => URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  const normalizedUsername = username.trim().replace(/^@/, "").toLowerCase();
  const usernameIsValid = /^[a-z0-9_]{3,32}$/.test(normalizedUsername);
  const usernameCheck = trpc.channels.usernameAvailable.useQuery(
    { username: normalizedUsername },
    {
      enabled: isPublic && usernameIsValid,
      staleTime: 2_000,
      retry: false,
    },
  );
  const directory = trpc.profile.directory.useQuery(undefined, {
    enabled: step === "members",
    staleTime: 30_000,
  });
  const contactNamesQuery = trpc.accountData.contactNames.get.useQuery();
  const contactNames = contactNamesQuery.data?.names ?? {};
  const upload = trpc.storage.upload.useMutation();
  const createCommunity = trpc.channels.create.useMutation();
  const addMembers = trpc.chats.addMembers.useMutation();

  const busy = upload.isPending || createCommunity.isPending || addMembers.isPending;
  const isChannel = kind === "channel";
  const kindLabel = isChannel ? "канала" : "группы";
  const communityLabel = isChannel ? "канал" : "группа";

  const filteredPeople = useMemo(() => {
    const query = memberSearch.trim().replace(/^@/, "").toLowerCase();
    return (directory.data ?? []).filter((person) => {
      if (person.userId === me.data?.profile?.userId) return false;
      if (!query) return true;
      const localName = contactNames[String(person.userId)] ?? person.displayName;
      return localName.toLowerCase().includes(query) || person.username.toLowerCase().includes(query);
    });
  }, [directory.data, memberSearch, contactNames, me.data?.profile?.userId]);

  const back = () => {
    setError("");
    if (step === "choose") {
      navigate(-1);
      return;
    }
    if (step === "details") setStep("choose");
    else if (step === "avatar") setStep("details");
    else if (step === "members") {
      if (createdChatId) navigate(`/chat/${createdChatId}`, { replace: true });
      else setStep("success");
    }
  };

  const chooseKind = (next: CommunityKind) => {
    setKind(next);
    setIsPublic(true);
    setUsername("");
    setTitle("");
    setDescription("");
    setError("");
    setStep("details");
  };

  const continueToAvatar = () => {
    setError("");
    if (!title.trim()) {
      setError(`Укажи название ${kindLabel}.`);
      return;
    }
    if (isPublic) {
      if (!usernameIsValid) {
        setError("Username должен содержать от 3 до 32 символов: латинские буквы, цифры или _.");
        return;
      }
      const availability = usernameCheck.data;
      if (usernameCheck.isFetching || !availability || availability.username !== normalizedUsername) {
        setError("Проверяем Username. Подожди секунду и нажми «Создать!» ещё раз.");
        return;
      }
      if (!availability.available) {
        setError("Этот Username уже занят. Придумай другой.");
        return;
      }
    }
    setStep("avatar");
  };

  const create = async () => {
    setError("");
    if (!title.trim()) {
      setError(`Укажи название ${kindLabel}.`);
      setStep("details");
      return;
    }
    if (isPublic && !usernameIsValid) {
      setError("Проверь Username: от 3 до 32 символов, латиница, цифры и _.");
      setStep("details");
      return;
    }

    try {
      let avatarKey: string | undefined;
      if (avatarFile) {
        const uploaded = await upload.mutateAsync({
          name: avatarFile.name || `${kind}-avatar.jpg`,
          contentBase64: await fileToBase64(avatarFile),
          contentType: avatarFile.type,
          folder: "avatars",
        });
        avatarKey = uploaded.key;
      }

      const result = await createCommunity.mutateAsync({
        kind,
        title: title.trim(),
        description: description.trim(),
        avatarKey,
        isPublic,
        username: isPublic ? normalizedUsername : undefined,
      });
      setCreatedChatId(result.chatId);
      await utils.chats.list.invalidate();
      setStep("success");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : `Не удалось создать ${kindLabel}.`;
      setError(message);
      toast.error(message);
      if (/username.*занят/i.test(message)) setStep("details");
    }
  };

  const finish = () => {
    if (!createdChatId) return;
    if (kind === "group") {
      setSelectedMembers([]);
      setMemberSearch("");
      setError("");
      setStep("members");
    } else {
      void utils.chats.list.invalidate();
      navigate(`/chat/${createdChatId}`, { replace: true });
    }
  };

  const finishMembers = async () => {
    if (!createdChatId) return;
    setError("");
    try {
      if (selectedMembers.length) {
        await addMembers.mutateAsync({ chatId: createdChatId, memberIds: selectedMembers });
      }
      await utils.chats.list.invalidate();
      navigate(`/chat/${createdChatId}`, { replace: true });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Не получилось добавить участников.";
      setError(message);
      toast.error(message);
    }
  };

  const toggleMember = (id: number) => {
    setSelectedMembers((current) => {
      if (current.includes(id)) return current.filter((memberId) => memberId !== id);
      if (current.length >= 50) {
        toast.error("В одну группу можно добавить до 50 человек за раз.");
        return current;
      }
      return [...current, id];
    });
  };

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {backgroundShapes.map((shape, index) => (
          <motion.span
            key={index}
            className="absolute border"
            initial={{ opacity: 0, rotate: shape.rotate, scale: 0.72 }}
            animate={{
              opacity: [0.08, 0.22, 0.1],
              rotate: [shape.rotate, shape.rotate + 28, shape.rotate - 12, shape.rotate],
              y: [0, -10, 9, 0],
              scale: [0.92, 1.06, 0.96, 0.92],
            }}
            transition={{ duration: 8 + (index % 4) * 1.7, repeat: Infinity, delay: index * 0.22, ease: "easeInOut" }}
            style={{
              left: shape.x,
              top: shape.y,
              width: shape.size,
              height: shape.size,
              borderRadius: shape.radius,
              borderColor: "color-mix(in srgb, var(--tcy-selected-accent) 46%, transparent)",
              background: "color-mix(in srgb, var(--tcy-selected-accent) 7%, transparent)",
            }}
          />
        ))}
      </div>

      <header className="relative z-10 flex items-center gap-3 px-4 pt-5 safe-top pb-3">
        <button
          type="button"
          onClick={back}
          aria-label="Назад"
          className="tcy-press w-10 h-10 rounded-full tcy-card border tcy-line flex items-center justify-center tcy-dim"
        >
          <ArrowLeft size={19} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.16em] font-extrabold tcy-faint">TeleChat You</p>
          <h1 className="text-[18px] font-extrabold tcy-text">
            {step === "choose" ? "Создание" : step === "members" ? "Участники" : isChannel ? "Новый канал" : "Новая группа"}
          </h1>
        </div>
        {step === "members" && (
          <span className="rounded-full px-3 py-1.5 text-[12px] font-extrabold" style={{ background: "var(--tcy-card-strong)", color: "var(--tcy-selected-accent)" }}>
            {selectedMembers.length} выбрано
          </span>
        )}
      </header>

      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto no-scrollbar px-4 pb-8">
        <AnimatePresence mode="wait" initial={false}>
          {step === "choose" && (
            <motion.section
              key="choose"
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.985 }}
              transition={{ duration: 0.24 }}
              className="flex min-h-[min(66vh,620px)] flex-col justify-center"
            >
              <div className="mb-9 max-w-[620px]">
                <p className="text-[11px] font-extrabold tracking-[0.16em] uppercase tcy-accent">Новый проект</p>
                <h2 className="mt-3 text-[30px] sm:text-[38px] leading-[1.08] font-black tracking-[-0.04em] tcy-text">
                  Что хочешь создать, {displayName}?
                </h2>
                <p className="mt-3 text-[14px] leading-relaxed tcy-dim">
                  Выбери формат — следующие шаги помогут оформить его и настроить доступ.
                </p>
              </div>

              <div className="mx-auto grid w-full max-w-[720px] grid-cols-1 sm:grid-cols-2 gap-3">
                <motion.button
                  whileTap={{ scale: 0.975 }}
                  onClick={() => chooseKind("channel")}
                  className="group relative overflow-hidden rounded-[28px] border tcy-line tcy-card p-5 sm:p-6 text-left tcy-shadow-soft"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-14 w-14 items-center justify-center rounded-[20px]" style={{ background: "color-mix(in srgb, var(--tcy-selected-accent) 16%, var(--tcy-card))", color: "var(--tcy-selected-accent)" }}>
                      <Radio size={27} strokeWidth={2.1} />
                    </span>
                    <ChevronRight size={22} className="tcy-faint transition-transform duration-200 group-hover:translate-x-1" />
                  </div>
                  <h3 className="mt-6 text-[21px] font-black tcy-text">Канал</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed tcy-dim">Публикуй новости, фотографии и записи для подписчиков.</p>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.975 }}
                  onClick={() => chooseKind("group")}
                  className="group relative overflow-hidden rounded-[28px] border tcy-line tcy-card p-5 sm:p-6 text-left tcy-shadow-soft"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-14 w-14 items-center justify-center rounded-[20px]" style={{ background: "color-mix(in srgb, var(--tcy-selected-accent) 16%, var(--tcy-card))", color: "var(--tcy-selected-accent)" }}>
                      <Users size={27} strokeWidth={2.1} />
                    </span>
                    <ChevronRight size={22} className="tcy-faint transition-transform duration-200 group-hover:translate-x-1" />
                  </div>
                  <h3 className="mt-6 text-[21px] font-black tcy-text">Группу</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed tcy-dim">Собери людей в одном чате и общайтесь вместе.</p>
                </motion.button>
              </div>

              <button type="button" onClick={() => navigate("/new")} className="mt-6 inline-flex items-center justify-center gap-2 text-[13px] font-bold tcy-dim tcy-press">
                <CircleHelp size={16} /> Мне нужен личный чат
              </button>
            </motion.section>
          )}

          {step === "details" && (
            <motion.section
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.22 }}
              className="mx-auto w-full max-w-[640px] space-y-5 pt-4"
            >
              <div className="mb-1">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] tcy-accent">Шаг 1 из 3</p>
                <h2 className="mt-2 text-[27px] leading-tight font-black tcy-text">Заполни данные {kindLabel}</h2>
                <p className="mt-2 text-[13px] tcy-dim">Имя и описание можно будет изменить позднее.</p>
              </div>

              <section className="rounded-[24px] border tcy-line tcy-card p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPublic(true)}
                    className="rounded-[17px] border p-3.5 text-left flex items-center gap-2.5 transition-colors"
                    style={{
                      borderColor: isPublic ? "var(--tcy-selected-accent)" : "var(--tcy-line)",
                      background: isPublic ? "color-mix(in srgb, var(--tcy-selected-accent) 10%, var(--tcy-card))" : "var(--tcy-card)",
                    }}
                  >
                    <Globe2 size={19} className={isPublic ? "tcy-accent" : "tcy-faint"} />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-extrabold tcy-text">Публичный</span>
                      <span className="block text-[10.5px] tcy-faint">По Username</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPublic(false)}
                    className="rounded-[17px] border p-3.5 text-left flex items-center gap-2.5 transition-colors"
                    style={{
                      borderColor: !isPublic ? "var(--tcy-selected-accent)" : "var(--tcy-line)",
                      background: !isPublic ? "color-mix(in srgb, var(--tcy-selected-accent) 10%, var(--tcy-card))" : "var(--tcy-card)",
                    }}
                  >
                    <LockKeyhole size={19} className={!isPublic ? "tcy-accent" : "tcy-faint"} />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-extrabold tcy-text">Частный</span>
                      <span className="block text-[10.5px] tcy-faint">По приглашению</span>
                    </span>
                  </button>
                </div>

                {isPublic && (
                  <label className="block space-y-1.5">
                    <span className="text-[12px] font-bold tcy-dim">Username {isChannel ? "канала" : "группы"}</span>
                    <div className="flex h-12 items-center rounded-[16px] tcy-card border tcy-line px-3.5 focus-within:border-[color:var(--tcy-accent)]">
                      <span className="text-[14px] tcy-faint">@</span>
                      <input
                        value={username}
                        onChange={(event) => setUsername(event.target.value.replace(/[^a-zA-Z0-9_@]/g, "").replace(/^@+/, "").slice(0, 32))}
                        minLength={3}
                        maxLength={32}
                        placeholder={isChannel ? "my_channel" : "my_group"}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        className="h-full min-w-0 flex-1 bg-transparent px-2 text-[14px] tcy-text outline-none"
                      />
                      {usernameIsValid && usernameCheck.data?.username === normalizedUsername && (
                        usernameCheck.data.available
                          ? <Check size={17} className="shrink-0" style={{ color: "var(--tcy-selected-accent)" }} />
                          : <X size={17} className="shrink-0" style={{ color: "var(--tcy-danger)" }} />
                      )}
                    </div>
                    <span className="block text-[11px] tcy-faint">
                      {!usernameIsValid
                        ? "От 3 до 32 символов: латиница, цифры и _."
                        : usernameCheck.isFetching || usernameCheck.data?.username !== normalizedUsername
                          ? "Проверяем доступность Username…"
                          : usernameCheck.data.available
                            ? "Имя свободно. На него будет вести ссылка TeleChat You."
                            : "Такое имя уже используется. Попробуй другое."}
                    </span>
                  </label>
                )}
              </section>

              <section className="rounded-[24px] border tcy-line tcy-card p-4 space-y-2.5">
                <h3 className="text-[16px] font-extrabold tcy-text">Давай создадим имя {isChannel ? "каналу" : "группе"}!</h3>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={96}
                  placeholder={isChannel ? "Название канала" : "Название группы"}
                  className="w-full h-12 rounded-[16px] tcy-card border tcy-line px-4 text-[14px] tcy-text outline-none focus:border-[color:var(--tcy-accent)]"
                />
              </section>

              <section className="rounded-[24px] border tcy-line tcy-card p-4 space-y-2.5">
                <h3 className="text-[16px] font-extrabold tcy-text">О {isChannel ? "канале" : "группе"}</h3>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={280}
                  rows={3}
                  placeholder={isChannel ? "О канале (необязательно)" : "О группе (необязательно)"}
                  className="w-full resize-none rounded-[16px] tcy-card border tcy-line p-3.5 text-[13.5px] tcy-text outline-none focus:border-[color:var(--tcy-accent)]"
                />
                <p className="text-right text-[10.5px] tcy-faint">{description.length}/280</p>
              </section>

              {error && <p role="alert" className="rounded-[15px] border px-3.5 py-3 text-[12.5px]" style={{ borderColor: "var(--tcy-danger)", color: "var(--tcy-danger)" }}>{error}</p>}

            </motion.section>
          )}

          {step === "avatar" && (
            <motion.section
              key="avatar"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22 }}
              className="mx-auto flex min-h-[min(67vh,660px)] w-full max-w-[620px] flex-col items-center justify-center text-center"
            >
              <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] tcy-accent">Шаг 2 из 3</p>
              <h2 className="mt-3 max-w-[520px] text-[27px] sm:text-[34px] leading-tight font-black tcy-text">
                Теперь давай сделаем аватарку {kind === "channel" ? "каналу" : "группе"}!
              </h2>
              <p className="mt-2 max-w-[360px] text-[13px] tcy-dim">Выбери изображение из галереи. Аватарку можно добавить и позже.</p>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) setAvatarToEdit(file);
                  event.currentTarget.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="tcy-press group relative mt-8 flex h-44 w-44 items-center justify-center overflow-hidden rounded-[36%] border-2 border-dashed tcy-line tcy-card"
                aria-label="Выбрать аватарку"
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Предпросмотр аватарки" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-3 tcy-dim">
                    <Camera size={32} className="tcy-accent" />
                    <span className="text-[12px] font-bold">Выбрать фото</span>
                  </span>
                )}
                {avatarPreview && <span className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full tcy-gradient-accent" style={{ color: "var(--tcy-on-accent)" }}><Camera size={16} /></span>}
              </button>
              {avatarPreview && (
                <button
                  type="button"
                  onClick={() => { setAvatarFile(null); setAvatarPreview(null); }}
                  className="mt-3 text-[12px] font-bold"
                  style={{ color: "var(--tcy-danger)" }}
                >
                  Удалить аватарку
                </button>
              )}

              {error && <p role="alert" className="mt-5 text-[12.5px]" style={{ color: "var(--tcy-danger)" }}>{error}</p>}
            </motion.section>
          )}

          {step === "success" && createdChatId !== null && (
            <motion.section
              key="success"
              initial={{ opacity: 0, scale: 0.96, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 250, damping: 24 }}
              className="mx-auto flex min-h-[min(67vh,660px)] w-full max-w-[600px] flex-col items-center justify-center text-center"
            >
              <motion.div
                initial={{ scale: 0.6, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 250, damping: 17 }}
                className="flex h-24 w-24 items-center justify-center rounded-[30px] border tcy-line"
                style={{ background: "color-mix(in srgb, var(--tcy-selected-accent) 16%, var(--tcy-card))", color: "var(--tcy-selected-accent)" }}
              >
                {isChannel ? <Radio size={43} /> : <Users size={43} />}
              </motion.div>
              <h2 className="mt-7 text-[28px] sm:text-[34px] leading-tight font-black tcy-text">
                Ваш {communityLabel} — {title.trim()}.
              </h2>
              <p className="mt-3 text-[15px] font-semibold tcy-accent">Успешно создан!</p>
              {isPublic && <p className="mt-2 text-[13px] tcy-dim">@{normalizedUsername}</p>}
            </motion.section>
          )}

          {step === "members" && createdChatId !== null && (
            <motion.section
              key="members"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.22 }}
              className="mx-auto w-full max-w-[640px] pt-3"
            >
              <div className="mb-5">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] tcy-accent">Последний шаг</p>
                <h2 className="mt-2 text-[27px] leading-tight font-black tcy-text">Кого добавим в группу?</h2>
                <p className="mt-2 text-[13px] tcy-dim">Выбери людей сейчас или пропусти этот шаг и пригласи их позже.</p>
              </div>

              <div className="mb-3 flex h-12 items-center gap-2.5 rounded-[16px] tcy-card border tcy-line px-3.5">
                <Search size={17} className="tcy-faint shrink-0" />
                <input
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                  placeholder="Поиск по имени или username"
                  className="flex-1 min-w-0 bg-transparent outline-none text-[13.5px] tcy-text"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>

              {directory.isLoading ? (
                <div className="py-10 text-center text-[13px] tcy-dim">Загружаем пользователей…</div>
              ) : filteredPeople.length === 0 ? (
                <div className="rounded-[20px] border tcy-line tcy-card px-4 py-7 text-center">
                  <Users size={26} className="mx-auto tcy-faint" />
                  <p className="mt-2 text-[13px] font-bold tcy-text">Пользователи не найдены</p>
                  <p className="mt-1 text-[11.5px] tcy-faint">Измени поиск или добавь людей позднее.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredPeople.map((person, index) => {
                    const active = selectedMembers.includes(person.userId);
                    const localName = contactNames[String(person.userId)] ?? person.displayName;
                    return (
                      <motion.button
                        key={person.userId}
                        type="button"
                        initial={{ opacity: 0, y: 7 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index * 0.018, 0.18) }}
                        onClick={() => toggleMember(person.userId)}
                        className={cn("tcy-press flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-left", active && "tcy-card")}
                      >
                        <Avatar name={localName} avatarKey={person.avatarKey} size={44} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-bold tcy-text">{localName}</span>
                          <span className="block truncate text-[12px] tcy-faint">@{person.username}</span>
                        </span>
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors"
                          style={{
                            borderColor: active ? "var(--tcy-selected-accent)" : "var(--tcy-line-strong)",
                            background: active ? "var(--tcy-selected-accent)" : "transparent",
                            color: "var(--tcy-selected-on-accent)",
                          }}
                        >
                          {active && <Check size={14} strokeWidth={3} />}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {error && <p role="alert" className="mt-4 rounded-[15px] border px-3.5 py-3 text-[12.5px]" style={{ borderColor: "var(--tcy-danger)", color: "var(--tcy-danger)" }}>{error}</p>}
              {selectedMembers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedMembers([])}
                  className="mt-5 rounded-[18px] px-4 py-3 text-[12.5px] font-bold tcy-dim tcy-press"
                >
                  Очистить выбор
                </button>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {step !== "choose" && (
        <footer
          className="relative z-20 shrink-0 border-t tcy-line px-4 pt-3"
          style={{
            background: "color-mix(in srgb, var(--tcy-bg) 91%, transparent)",
            backdropFilter: "blur(20px)",
            paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
          }}
        >
          <div className="mx-auto w-full max-w-[640px]">
            {step === "details" && (
              <TcButton size="lg" disabled={!title.trim()} onClick={continueToAvatar}>
                Создать! <ChevronRight size={18} />
              </TcButton>
            )}
            {step === "avatar" && (
              <TcButton size="lg" loading={busy} onClick={() => void create()}>
                Далее! <ChevronRight size={18} />
              </TcButton>
            )}
            {step === "success" && (
              <TcButton size="lg" onClick={finish}>
                Завершить <Check size={18} />
              </TcButton>
            )}
            {step === "members" && (
              <TcButton size="lg" loading={busy} onClick={() => void finishMembers()}>
                <UserRoundPlus size={18} /> {selectedMembers.length ? `Добавить участников (${selectedMembers.length})` : "Перейти в группу"}
              </TcButton>
            )}
          </div>
        </footer>
      )}

      <AvatarEditor
        file={avatarToEdit}
        onCancel={() => setAvatarToEdit(null)}
        onSave={(edited) => {
          setAvatarFile(edited);
          setAvatarPreview(URL.createObjectURL(edited));
          setError("");
        }}
      />
    </div>
  );
}
