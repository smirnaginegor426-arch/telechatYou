import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Bell,
  Check,
  Palette,
  Copy,
  Database,
  Eye,
  Globe,
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

export default function Settings() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { theme, setTheme, accent } = useTheme();
  const me = trpc.profile.me.useQuery();
  const settingsQuery = trpc.settings.get.useQuery();
  const recoverySecretStatus = trpc.auth.recoverySecretStatus.useQuery();
  const myFiles = trpc.storage.mine.useQuery();
  const [recoverySecretValue, setRecoverySecretValue] = useState("");
  const [recoverySecretError, setRecoverySecretError] = useState("");
  const [recoverySecretNotice, setRecoverySecretNotice] = useState("");
  const [rotationOpen, setRotationOpen] = useState(false);
  const [currentPasswordForRotation, setCurrentPasswordForRotation] = useState("");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const [mediaPreferences, setMediaPreferences] = useState<MediaSendPreferences>(getMediaSendPreferences);

  useEffect(() => {
    setMediaPreferences(getMediaSendPreferences());
  }, []);

  const update = trpc.settings.update.useMutation({
    onSuccess: (s) => utils.settings.get.setData(undefined, s),
  });
  const removeMany = trpc.storage.removeMany.useMutation({
    onSuccess: () => utils.storage.mine.invalidate(),
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

      <SettingsGroup title="Внешний вид">
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
      </SettingsGroup>

      <SettingsGroup title="Уведомления">
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
      </SettingsGroup>

      <SettingsGroup title="Безопасность аккаунта">
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
      </SettingsGroup>

      <SettingsGroup title="Приватность">
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
      </SettingsGroup>

      <SettingsGroup title="Чаты и медиа">
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
      </SettingsGroup>

      <SettingsGroup title="Данные">
        <SettingsRow
          icon={<Database size={17} />}
          title="Хранилище"
          subtitle={`${files.length} файлов · ${formatFileSize(totalSize)}`}
          onClick={() => setStorageOpen(true)}
        />
        <SettingsRow icon={<Globe size={17} />} title="Мой язык" subtitle="Создать, изменить и сохранить свой язык" onClick={() => navigate("/language")} />
      </SettingsGroup>

      <SettingsGroup title="О приложении">
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
      </SettingsGroup>

      <p className="text-center text-[11px] tcy-faint pt-2">
        TeleChatYou · сделано с любовью к общению
      </p>

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
      <BottomSheet open={storageOpen} onClose={() => setStorageOpen(false)} title="Хранилище">
        <div className="px-5 space-y-4">
          <div className="rounded-[20px] tcy-card border tcy-line p-4 flex items-center justify-between">
            <div>
              <div className="text-[15px] font-bold tcy-text">{formatFileSize(totalSize)}</div>
              <div className="text-[12px] tcy-faint">{files.length} загруженных файлов</div>
            </div>
            <Database size={22} className="tcy-accent" />
          </div>
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
    </div>
  );
}
