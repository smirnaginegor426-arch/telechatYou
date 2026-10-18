import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Mail,
  Palette,
  Copy,
  Database,
  Eye,
  ExternalLink,
  FileText,
  Globe,
  Ghost,
  Image as ImageIcon,
  Info,
  Keyboard,
  KeyRound,
  Moon,
  Paperclip,
  RefreshCw,
  Smile,
  Sun,
  ShieldCheck,
  Trash2,
  Type,
  UserRound,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Avatar } from "@/components/Avatar";
import { BottomSheet } from "@/components/BottomSheet";
import { SettingsGroup, SettingsRow, Toggle } from "@/components/SettingsRow";
import { TcButton } from "@/components/TcButton";
import { TcInput } from "@/components/TcInput";
import { formatFileSize } from "@/lib/format";
import { useTheme } from "@/hooks/useTheme";
import { ACCENTS } from "@/lib/accents";
import { getMediaSendPreferences, saveMediaSendPreferences, type MediaSendPreferences } from "@/lib/media-send-preferences";
import { useExperimentalUI } from "@/hooks/useExperimentalUI";

/**
 * Settings are split into sections that open as separate pages.
 * This is part of the private experimental interface: everyone else
 * sees the plain flat list, exactly as before.
 */
type SettingsSectionId =
  | "appearance"
  | "notifications"
  | "email"
  | "security"
  | "privacy"
  | "chats"
  | "data"
  | "seasonal"
  | "about";

const SETTINGS_SECTIONS: { id: SettingsSectionId; title: string; subtitle: string; icon: LucideIcon }[] = [
  { id: "appearance", title: "Внешний вид", subtitle: "Тема, акцент и шрифт", icon: Palette },
  { id: "notifications", title: "Уведомления", subtitle: "Звук и превью сообщений", icon: Bell },
  { id: "email", title: "Почта для восстановления", subtitle: "Привязка почты аккаунта", icon: Mail },
  { id: "security", title: "Безопасность аккаунта", subtitle: "Резервный секрет", icon: KeyRound },
  { id: "privacy", title: "Приватность", subtitle: "Статус «в сети» и отметки прочтения", icon: Eye },
  { id: "chats", title: "Чаты и медиа", subtitle: "Клавиатура, медиа и стикеры", icon: Paperclip },
  { id: "data", title: "Данные", subtitle: "Хранилище и язык", icon: Database },
  { id: "seasonal", title: "Сезонное", subtitle: "Halloween и сезонные функции", icon: Ghost },
  { id: "about", title: "О приложении", subtitle: "Версия 1.0.0", icon: Info },
];

/** Названия групп — по одной на три раздела (вкладки). */
const SETTINGS_GROUPS: { heading: string; ids: SettingsSectionId[] }[] = [
  { heading: "Оформление", ids: ["appearance", "notifications", "chats"] },
  { heading: "Аккаунт", ids: ["email", "security", "privacy"] },
  { heading: "Прочее", ids: ["data", "seasonal", "about"] },
];

/** Фигурные блоки вкладок: 1-я — прямой низ, 2-я — слегка прямоугольная, 3-я — прямой верх; далее цикл. */
const sectionShapes = ["22px 22px 0px 0px", "9px", "0px 0px 22px 22px"];

function SettingsInner({ sectionId }: { sectionId?: SettingsSectionId }) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { theme, setTheme, accent } = useTheme();
  const me = trpc.profile.me.useQuery();
  const settingsQuery = trpc.settings.get.useQuery();
  const recoverySecretStatus = trpc.auth.recoverySecretStatus.useQuery();
  const emailStatus = trpc.auth.emailStatus.useQuery();
  const myFiles = trpc.storage.mine.useQuery();
  const [recoverySecretValue, setRecoverySecretValue] = useState("");
  const [recoverySecretError, setRecoverySecretError] = useState("");
  const [recoverySecretNotice, setRecoverySecretNotice] = useState("");
  const [rotationOpen, setRotationOpen] = useState(false);
  const [currentPasswordForRotation, setCurrentPasswordForRotation] = useState("");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const [storageView, setStorageView] = useState(false);
  const [mediaPreferences, setMediaPreferences] = useState<MediaSendPreferences>(getMediaSendPreferences);
  const [emailPanelOpen, setEmailPanelOpen] = useState(false);
  const [unlinkMessage, setUnlinkMessage] = useState("");
  const { enabled: experimentalUI } = useExperimentalUI();

  useEffect(() => {
    setMediaPreferences(getMediaSendPreferences());
  }, []);

  const update = trpc.settings.update.useMutation({
    onSuccess: (s) => utils.settings.get.setData(undefined, s),
  });
  const removeMany = trpc.storage.removeMany.useMutation({
    onSuccess: () => utils.storage.mine.invalidate(),
  });
  const removeFile = trpc.storage.remove.useMutation({
    onSuccess: async () => {
      await utils.storage.mine.invalidate();
      await utils.storage.urls.invalidate();
    },
  });

  const unlinkEmail = trpc.auth.unlinkEmail.useMutation({
    onSuccess: async () => {
      await utils.auth.emailStatus.invalidate();
      setUnlinkMessage("Почта отвязана. Теперь этот адрес можно привязать к другому аккаунту.");
    },
    onError: (e) => setUnlinkMessage(e.message),
  });

  const handleRecoverySecretReady = async (secret: string) => {
    setRecoverySecretValue(secret);
    setRecoverySecretError("");
    setRecoverySecretNotice("Сохрани секрет сейчас. Позже его нельзя будет посмотреть — только заменить.");
    setCurrentPasswordForRotation("");
    setRotationOpen(false);
    await utils.auth.recoverySecretStatus.invalidate();
  };

  const createRecoverySecret = trpc.auth.createRecoverySecret.useMutation({
    onSuccess: async ({ secret }) => handleRecoverySecretReady(secret),
    onError: (e) => setRecoverySecretError(e.message),
  });

  const rotateRecoverySecret = trpc.auth.rotateRecoverySecret.useMutation({
    onSuccess: async ({ secret }) => handleRecoverySecretReady(secret),
    onError: (e) => setRecoverySecretError(e.message),
  });

  const formattedRecoverySecret = recoverySecretValue.match(/.{1,8}/g)?.join("-") ?? recoverySecretValue;

  const copyRecoverySecret = async () => {
    try {
      await navigator.clipboard.writeText(formattedRecoverySecret);
      setRecoverySecretNotice("Резервный секрет скопирован. Сохрани его в надёжном месте.");
    } catch {
      setRecoverySecretNotice("Не удалось скопировать автоматически. Выдели секрет и скопируй его вручную.");
    }
  };

  const s = settingsQuery.data;
  const patch = (p: Parameters<typeof update.mutate>[0]) => update.mutate(p);
  const updateMediaPreference = (key: keyof MediaSendPreferences, value: boolean) => {
    const next = { ...mediaPreferences, [key]: value };
    setMediaPreferences(next);
    saveMediaSendPreferences(next);
  };

  const files = myFiles.data ?? [];
  const totalSize = files.reduce((sum, f) => sum + Number(f.size), 0);
  const storageKeys = files.map((file) => file.key);
  const storageUrls = trpc.storage.urls.useQuery(
    { keys: storageKeys },
    { enabled: storageOpen && storageView && storageKeys.length > 0, staleTime: 60_000 },
  );

  /* section row sets (shared between the flat list and the section pages) */
  const appearanceRows = (
    <>
      <SettingsRow
        icon={theme === "dark" ? <Moon size={17} /> : <Sun size={17} />}
        title="Тема"
        subtitle={theme === "dark" ? "Тёмная тема" : "Светлая тема"}
        right={
          <div className="flex items-center gap-1 rounded-full tcy-card-strong p-1">
            {(["dark", "light"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={theme === value}
                onClick={() => setTheme(value)}
                className="px-3 py-1.5 rounded-full text-[11.5px] font-bold transition-colors"
                style={{
                  background: theme === value ? "var(--tcy-selected-accent)" : "transparent",
                  color: theme === value ? "var(--tcy-selected-on-accent)" : "var(--tcy-dim)",
                }}
              >
                {value === "dark" ? "Тёмная" : "Светлая"}
              </button>
            ))}
          </div>
        }
      />

      <SettingsRow
        icon={<Palette size={17} />}
        title="Акцент"
        subtitle={`Текущий цвет: ${ACCENTS.find((option) => option.id === accent)?.name ?? "Фиолетовый"}`}
        onClick={() => navigate("/accent")}
        right={
          <span
            aria-hidden="true"
            className="h-7 w-7 rounded-full border flex items-center justify-center"
            style={{
              background: "var(--tcy-selected-accent)",
              borderColor: "var(--tcy-glass-line)",
              boxShadow: "0 0 0 3px color-mix(in srgb, var(--tcy-selected-accent) 18%, transparent)",
            }}
          >
            <Check size={14} strokeWidth={3} color="var(--tcy-selected-on-accent)" />
          </span>
        }
      />
      <SettingsRow
        icon={<Type size={17} />}
        title="Шрифт"
        subtitle="Толщина текста и пример переписки"
        onClick={() => navigate("/font")}
      />
    </>
  );

  const notificationsRows = (
    <>
      <SettingsRow
        icon={<Bell size={17} />}
        title="Уведомления"
        subtitle="Новые сообщения"
        right={
          <Toggle
            checked={s?.notificationsEnabled ?? true}
            onChange={(v) => patch({ notificationsEnabled: v })}
          />
        }
      />
      <SettingsRow
        icon={<Eye size={17} />}
        title="Превью сообщений"
        subtitle="Показывать текст в уведомлении"
        right={
          <Toggle checked={s?.messagePreview ?? true} onChange={(v) => patch({ messagePreview: v })} />
        }
      />
      <SettingsRow
        icon={<Volume2 size={17} />}
        title="Звук"
        right={
          <Toggle checked={s?.soundEnabled ?? true} onChange={(v) => patch({ soundEnabled: v })} />
        }
      />
    </>
  );

  const emailRows = (
    <>
      <SettingsRow
        icon={<Mail size={17} />}
        title="Почта аккаунта"
        subtitle={
          emailStatus.isLoading
            ? "Проверяем привязку…"
            : emailStatus.data?.verified
              ? "Почта подтверждена и защищает аккаунт"
              : "Привяжи почту, чтобы не потерять доступ"
        }
        right={
          <span className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: emailStatus.data?.verified ? "#369b78" : "var(--tcy-dim)" }}>
            {emailStatus.data?.verified ? <ShieldCheck size={17} /> : <Mail size={16} />}
            {emailStatus.data?.verified ? "Защищена" : "Не привязана"}
          </span>
        }
      />
      <div className="mx-4 mb-3 overflow-hidden rounded-[18px] border tcy-line tcy-card">
        <button
          type="button"
          onClick={() => setEmailPanelOpen((open) => !open)}
          aria-expanded={emailPanelOpen}
          aria-label={emailPanelOpen ? "Свернуть" : "Развернуть"}
          className="tcy-press flex w-full items-center justify-center py-2.5"
        >
          <motion.span
            animate={{ rotate: emailPanelOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex"
          >
            <ChevronDown size={18} style={{ color: "var(--tcy-selected-accent)" }} />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {emailPanelOpen && (
            <motion.div
              key="email-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="flex min-w-0 items-center gap-2.5 px-3 pb-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold tcy-text">
                    {emailStatus.isLoading ? "Проверяем…" : emailStatus.data?.verified && emailStatus.data.email
                      ? emailStatus.data.email
                      : "Пу-Пу-Пусто"}
                  </p>
                  <p className="mt-0.5 text-[10.5px] tcy-faint">
                    {emailStatus.data?.verified ? "Привязанный адрес" : "Почта ещё не привязана"}
                  </p>
                </div>
                <TcButton size="sm" onClick={() => navigate("/email-binding")}>
                  <Mail size={15} /> Привязать почту
                </TcButton>
              </div>
              {emailStatus.data?.email && (
                <div className="px-3 pb-3">
                  <TcButton
                    size="sm"
                    variant="soft"
                    className="w-full"
                    loading={unlinkEmail.isPending}
                    onClick={() => {
                      setUnlinkMessage("");
                      unlinkEmail.mutate();
                    }}
                  >
                    <Trash2 size={15} /> Отвязать почту
                  </TcButton>
                </div>
              )}
              {unlinkMessage && (
                <p className="px-3 pb-3 text-[11.5px] leading-relaxed tcy-dim">{unlinkMessage}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );

  const securityRows = (
    <>
      <SettingsRow
        icon={<KeyRound size={17} />}
        title="Резервный секрет"
        subtitle={
          recoverySecretStatus.isLoading
            ? "Проверяем состояние защиты…"
            : recoverySecretStatus.data?.configured
              ? "Дополнительная проверка для восстановления входа включена"
              : "Создай секрет сейчас, пока ты вошёл в аккаунт"
        }
        right={
          <TcButton
            size="sm"
            variant="soft"
            disabled={recoverySecretStatus.isLoading || createRecoverySecret.isPending || rotateRecoverySecret.isPending}
            loading={createRecoverySecret.isPending || rotateRecoverySecret.isPending}
            onClick={() => {
              setRecoverySecretError("");
              setRecoverySecretNotice("");
              setRecoverySecretValue("");
              if (recoverySecretStatus.data?.configured) {
                setRotationOpen((open) => !open);
              } else {
                createRecoverySecret.mutate();
              }
            }}
          >
            {recoverySecretStatus.data?.configured ? "Заменить" : "Создать"}
          </TcButton>
        }
      />
      {rotationOpen && (
        <div className="mx-4 mb-3 rounded-[18px] tcy-card border tcy-line p-4 space-y-3">
          <p className="text-[12.5px] tcy-dim leading-relaxed">
            Введи текущий пароль, чтобы заменить секрет. Предыдущий секрет сразу перестанет работать.
          </p>
          <TcInput
            type="password"
            value={currentPasswordForRotation}
            onChange={(e) => setCurrentPasswordForRotation(e.target.value)}
            autoComplete="current-password"
            maxLength={128}
            placeholder="Текущий пароль"
          />
          <TcButton
            size="md"
            loading={rotateRecoverySecret.isPending}
            disabled={!currentPasswordForRotation}
            onClick={() => {
              setRecoverySecretError("");
              rotateRecoverySecret.mutate({ currentPassword: currentPasswordForRotation });
            }}
          >
            Подтвердить и заменить
          </TcButton>
        </div>
      )}
      {recoverySecretValue && (
        <div className="mx-4 mb-3 rounded-[18px] tcy-card border tcy-line p-4 space-y-3">
          <p className="text-[13px] font-bold tcy-text">Твой резервный секрет</p>
          <p className="break-all rounded-xl tcy-card-strong px-3 py-3 text-center font-mono text-[13px] tracking-wide tcy-text select-all">
            {formattedRecoverySecret}
          </p>
          <TcButton size="md" variant="soft" onClick={copyRecoverySecret}>
            <Copy size={16} /> Скопировать секрет
          </TcButton>
          <p className="text-[11.5px] tcy-dim leading-relaxed">
            Он показан только один раз. Сохрани его вне TeleChat — без него восстановление входа не сработает.
          </p>
          <button
            type="button"
            className="w-full text-[12px] font-semibold tcy-accent"
            onClick={() => {
              setRecoverySecretValue("");
              setRecoverySecretNotice("Секрет скрыт на этом экране. Храни сохранённую копию в надёжном месте.");
            }}
          >
            Я сохранил секрет
          </button>
        </div>
      )}
      {recoverySecretError && (
        <p role="alert" className="mx-5 mb-3 text-[12px] tcy-danger">{recoverySecretError}</p>
      )}
      {recoverySecretNotice && (
        <p role="status" className="mx-5 mb-3 text-[12px] tcy-accent">{recoverySecretNotice}</p>
      )}
    </>
  );

  const privacyRows = (
    <>
      <SettingsRow
        icon={<Eye size={17} />}
        title="Статус «в сети»"
        subtitle="Другие видят, когда вы онлайн"
        right={<Toggle checked={s?.showOnline ?? true} onChange={(v) => patch({ showOnline: v })} />}
      />
      <SettingsRow
        icon={<ShieldCheck size={17} />}
        title="Время последнего визита"
        right={
          <Toggle checked={s?.showLastSeen ?? true} onChange={(v) => patch({ showLastSeen: v })} />
        }
      />
      <SettingsRow
        icon={<Check size={17} />}
        title="Отчёты о прочтении"
        subtitle="Галочки прочтения в личных чатах"
        right={
          <Toggle checked={s?.readReceipts ?? true} onChange={(v) => patch({ readReceipts: v })} />
        }
      />
    </>
  );

  const chatsRows = (
    <>
      <SettingsRow
        icon={<Keyboard size={17} />}
        title="Enter отправляет"
        subtitle="Иначе Enter — новая строка"
        right={<Toggle checked={s?.enterToSend ?? false} onChange={(v) => patch({ enterToSend: v })} />}
      />
      <SettingsRow
        icon={<ImageIcon size={17} />}
        title="Сжимать фото"
        subtitle="Уменьшать размер JPG, PNG и WebP"
        right={<Toggle checked={mediaPreferences.compressPhotos} onChange={(v) => updateMediaPreference("compressPhotos", v)} />}
      />
      <SettingsRow
        icon={<Paperclip size={17} />}
        title="Подтверждать отправку"
        subtitle="Спрашивать перед отправкой фото и файлов"
        right={<Toggle checked={mediaPreferences.confirmBeforeSend} onChange={(v) => updateMediaPreference("confirmBeforeSend", v)} />}
      />
      <SettingsRow
        icon={<Smile size={17} />}
        title="Стикеры"
        subtitle="Показывать кнопку стикеров рядом с полем ввода"
        right={<Toggle checked={mediaPreferences.stickersEnabled} onChange={(v) => updateMediaPreference("stickersEnabled", v)} />}
      />
      <SettingsRow
        icon={<ImageIcon size={17} />}
        title="Автозагрузка медиа"
        subtitle="Фото и файлы по Wi-Fi"
        right={<Toggle checked={s?.autoplayMedia ?? true} onChange={(v) => patch({ autoplayMedia: v })} />}
      />
    </>
  );

  const dataRows = (
    <>
      <SettingsRow
        icon={<Database size={17} />}
        title="Хранилище"
        subtitle={`${files.length} файлов · ${formatFileSize(totalSize)}`}
        onClick={() => { setStorageView(false); setStorageOpen(true); }}
      />
      <SettingsRow icon={<Globe size={17} />} title="Мой язык" subtitle="Создать, изменить и сохранить свой язык" onClick={() => navigate("/language")} />
    </>
  );

  const seasonalRows = (
    <SettingsRow
      icon={<Ghost size={17} />}
      title="Halloween"
      subtitle="Обратный отсчёт и хэллоуинская анимация"
      onClick={() => navigate("/halloween")}
    />
  );

  const aboutRows = (
    <>
      <SettingsRow
        icon={<RefreshCw size={17} />}
        title="Системное обновление"
        subtitle="Версия приложения и состояние обновлений"
        onClick={() => navigate("/system-update")}
      />
      <SettingsRow
        icon={<Info size={17} />}
        title="О TeleChatYou"
        subtitle="Версия 1.0.0"
        onClick={() => setAboutOpen(true)}
      />
    </>
  );

  /* bottom sheets shared by the list view and the section pages */
  const bottomSheets = (
    <>
      {/* about */}
      <BottomSheet open={aboutOpen} onClose={() => setAboutOpen(false)} title="О TeleChatYou">
        <div className="px-6 text-center space-y-3 pb-4">
          <div className="flex justify-center">
            <span className="w-16 h-16 rounded-[22px] tcy-gradient-accent flex items-center justify-center text-[26px] font-black" style={{ color: "var(--tcy-selected-on-accent)" }}>
              T
            </span>
          </div>
          <p className="text-[14px] font-bold tcy-text">TeleChatYou 1.0.0</p>
          <p className="text-[13px] tcy-dim leading-relaxed">
            Современный мессенджер с голосовыми сообщениями, группами, темами и живыми
            анимациями. Самостоятельный продукт — спроектирован и собран с нуля.
          </p>
        </div>
      </BottomSheet>

      {/* storage */}
      <BottomSheet open={storageOpen} onClose={() => { setStorageOpen(false); setStorageView(false); }} title="Хранилище">
        <div className="px-5 space-y-4">
          <div className="rounded-[20px] tcy-card border tcy-line p-4 flex items-center justify-between">
            <div>
              <div className="text-[15px] font-bold tcy-text">{formatFileSize(totalSize)}</div>
              <div className="text-[12px] tcy-faint">{files.length} загруженных файлов</div>
            </div>
            <Database size={22} className="tcy-accent" />
          </div>
          <TcButton
            variant="soft"
            size="lg"
            className="w-full"
            onClick={() => setStorageView((open) => !open)}
          >
            <Eye size={16} /> {storageView ? "Скрыть файлы" : "Просмотреть"}
          </TcButton>
          {storageView && (
            <div className="space-y-2">
              {myFiles.isLoading && (
                <p className="py-4 text-center text-[12.5px] tcy-dim">Загружаем список файлов…</p>
              )}
              {!myFiles.isLoading && files.length === 0 && (
                <p className="py-5 text-center text-[12.5px] tcy-dim">Хранилище пустое</p>
              )}
              {files.map((file) => {
                const url = storageUrls.data?.urls?.[file.key];
                const isImage = !!file.contentType?.startsWith("image/");
                return (
                  <div key={file.key} className="flex min-w-0 items-center gap-3 rounded-[17px] border tcy-line tcy-card p-2.5">
                    {isImage && url ? (
                      <a href={url} target="_blank" rel="noreferrer" className="block h-12 w-12 shrink-0 overflow-hidden rounded-[12px] tcy-card-strong">
                        <img src={url} alt={file.name} className="h-full w-full object-cover" loading="lazy" />
                      </a>
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] tcy-card-strong tcy-accent">
                        <FileText size={19} />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <a
                        href={url ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => { if (!url) event.preventDefault(); }}
                        className="block truncate text-[12.5px] font-bold tcy-text"
                        title={file.name}
                      >
                        {file.name}
                      </a>
                      <p className="mt-1 truncate text-[10.5px] tcy-faint">
                        {formatFileSize(Number(file.size))}{file.contentType ? " · " + file.contentType : ""}
                      </p>
                      {!url && <p className="mt-0.5 text-[10px] tcy-faint">Ссылка готовится…</p>}
                    </div>
                    {url && (
                      <a href={url} target="_blank" rel="noreferrer" aria-label={"Открыть " + file.name} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full tcy-card-strong tcy-dim">
                        <ExternalLink size={16} />
                      </a>
                    )}
                    <button
                      type="button"
                      aria-label={"Удалить " + file.name}
                      title="Удалить файл"
                      disabled={removeFile.isPending}
                      onClick={() => {
                        if (window.confirm("Удалить файл «" + file.name + "»? Сообщения с ним перестанут открываться.")) {
                          removeFile.mutate({ key: file.key });
                        }
                      }}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full tcy-card-strong tcy-danger disabled:opacity-40"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {files.length > 0 && (
            <TcButton
              variant="danger"
              size="lg"
              className="border tcy-line"
              loading={removeMany.isPending}
              onClick={() => {
                if (confirm("Удалить все загруженные файлы? Сообщения с ними перестанут открываться.")) {
                  removeMany.mutate({ keys: files.map((f) => f.key) });
                }
              }}
            >
              <Trash2 size={16} /> Очистить хранилище
            </TcButton>
          )}
          <p className="text-[12px] tcy-faint text-center leading-relaxed">
            Файлы хранятся в облачном хранилище и доступны по временным ссылкам.
          </p>
        </div>
      </BottomSheet>
    </>
  );

  const footer = (
    <p className="text-center text-[11px] tcy-faint pt-2">
      TeleChatYou · сделано с любовью к общению
    </p>
  );

  const sectionRows: Record<SettingsSectionId, ReactNode> = {
    appearance: appearanceRows,
    notifications: notificationsRows,
    email: emailRows,
    security: securityRows,
    privacy: privacyRows,
    chats: chatsRows,
    data: dataRows,
    seasonal: seasonalRows,
    about: aboutRows,
  };

  /* Separate screen for one section — opened from the list above */
  if (sectionId) {
    if (!experimentalUI) return <Navigate to="/settings" replace />;
    const meta = SETTINGS_SECTIONS.find((item) => item.id === sectionId);

    return (
      <div className="tcy-settings-page relative h-full overflow-y-auto no-scrollbar pb-32">
        <motion.div
          key={"settings-screen-" + sectionId}
          initial={{ opacity: 0, x: 26 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <header className="relative z-10 flex items-center gap-3 px-5 pt-5 safe-top pb-4">
            <button
              type="button"
              onClick={() => navigate("/settings")}
              aria-label="Назад к настройкам"
              className="tcy-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full tcy-card border tcy-line tcy-dim"
            >
              <ArrowLeft size={19} />
            </button>
            <div className="min-w-0">
              <h1 className="text-[22px] font-extrabold tcy-text truncate">
                {meta?.title ?? "Настройки"}
              </h1>
              {meta?.subtitle && (
                <p className="text-[12.5px] tcy-faint truncate">{meta.subtitle}</p>
              )}
            </div>
          </header>

          <SettingsGroup>{sectionRows[sectionId]}</SettingsGroup>

          {footer}
        </motion.div>
        {bottomSheets}
      </div>
    );
  }

  /* Flat list — the stable settings screen, unchanged for everyone */
  /* except the private experimental account. */
  if (!experimentalUI) {
    return (
      <div className="tcy-settings-page relative h-full overflow-y-auto no-scrollbar pb-32">
        <header className="relative z-10 px-5 pt-5 safe-top pb-4">
          <h1 className="text-[24px] font-extrabold tcy-text">Настройки</h1>
        </header>

        {/* account card */}
        <div className="mx-4 mb-5 rounded-[24px] tcy-card border tcy-line p-4 flex items-center gap-4">
          <Avatar
            name={me.data?.profile?.displayName ?? "?"}
            avatarKey={me.data?.profile?.avatarKey}
            size={56}
            lastSeenAt={me.data?.profile?.lastSeenAt}
            showOnline
          />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[16px] tcy-text truncate">
              {me.data?.profile?.displayName ?? "…"}
            </div>
            <div className="text-[12.5px] tcy-accent font-semibold">
              @{me.data?.profile?.username}
            </div>
          </div>
          <UserRound size={18} className="tcy-faint" />
        </div>

        <SettingsGroup title="Внешний вид">{appearanceRows}</SettingsGroup>
        <SettingsGroup title="Уведомления">{notificationsRows}</SettingsGroup>
        <SettingsGroup title="Почта для восстановления">{emailRows}</SettingsGroup>
        <SettingsGroup title="Безопасность аккаунта">{securityRows}</SettingsGroup>
        <SettingsGroup title="Приватность">{privacyRows}</SettingsGroup>
        <SettingsGroup title="Чаты и медиа">{chatsRows}</SettingsGroup>
        <SettingsGroup title="Данные">{dataRows}</SettingsGroup>
        <SettingsGroup title="Сезонное">{seasonalRows}</SettingsGroup>
        <SettingsGroup title="О приложении">{aboutRows}</SettingsGroup>

        {footer}
        {bottomSheets}
      </div>
    );
  }

  /* Main settings screen — sections as buttons that expand in place */
  return (
    <div className="tcy-settings-page relative h-full overflow-y-auto no-scrollbar pb-32">
      <motion.div
        key="root"
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <header className="relative z-10 px-5 pt-5 safe-top pb-4">
          <h1 className="text-[24px] font-extrabold tcy-text">Настройки</h1>
        </header>

        {/* account card */}
        <div className="mx-4 mb-5 rounded-[24px] tcy-card border tcy-line p-4 flex items-center gap-4">
          <Avatar
            name={me.data?.profile?.displayName ?? "?"}
            avatarKey={me.data?.profile?.avatarKey}
            size={56}
            lastSeenAt={me.data?.profile?.lastSeenAt}
            showOnline
          />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[16px] tcy-text truncate">
              {me.data?.profile?.displayName ?? "…"}
            </div>
            <div className="text-[12.5px] tcy-accent font-semibold">
              @{me.data?.profile?.username}
            </div>
          </div>
          <UserRound size={18} className="tcy-faint" />
        </div>

        <div className="mx-4 mb-5 flex flex-col gap-8">
          {SETTINGS_GROUPS.map(({ heading, ids }) => (
            <div key={heading}>
              <h4 className="px-1.5 pb-2 text-[11.5px] font-bold uppercase tracking-[0.08em] tcy-faint">
                {heading}
              </h4>
              <div className="flex flex-col gap-[1mm]">
                {ids.map((id, index) => {
                  const section = SETTINGS_SECTIONS.find((item) => item.id === id)!;
                  const { title, subtitle, icon: Icon } = section;
                  return (
                    <div key={id} id={"settings-section-" + id}>
                      <SettingsRow
                        style={{
                          borderRadius: sectionShapes[index % sectionShapes.length],
                          padding: "10px 15px",
                        }}
                        icon={<Icon size={17} />}
                        title={title}
                        subtitle={subtitle}
                        onClick={() => navigate("/settings/" + id)}
                        right={
                          <span className="flex" style={{ color: "var(--tcy-faint)" }}>
                            <ChevronRight size={17} />
                          </span>
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {footer}
      </motion.div>
      {bottomSheets}
    </div>
  );
}

export default function Settings() {
  return <SettingsInner />;
}

/** Separate screen for one settings section: /settings/:section */
export function SettingsSectionScreen() {
  const params = useParams();
  const known = SETTINGS_SECTIONS.some((item) => item.id === params.section);
  if (!known) return <Navigate to="/settings" replace />;
  return <SettingsInner sectionId={params.section as SettingsSectionId} />;
}
