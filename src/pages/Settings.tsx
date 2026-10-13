import { useState } from "react";
import {
  Bell,
  Check,
  Database,
  Eye,
  Globe,
  Image as ImageIcon,
  Info,
  Keyboard,
  Moon,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  Volume2,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Avatar } from "@/components/Avatar";
import { BottomSheet } from "@/components/BottomSheet";
import { SettingsGroup, SettingsRow, Toggle } from "@/components/SettingsRow";
import { TcButton } from "@/components/TcButton";
import { formatFileSize } from "@/lib/format";

export default function Settings() {
  const utils = trpc.useUtils();
  const me = trpc.profile.me.useQuery();
  const settingsQuery = trpc.settings.get.useQuery();
  const myFiles = trpc.storage.mine.useQuery();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);

  const update = trpc.settings.update.useMutation({
    onSuccess: (s) => utils.settings.get.setData(undefined, s),
  });
  const removeMany = trpc.storage.removeMany.useMutation({
    onSuccess: () => utils.storage.mine.invalidate(),
  });

  const s = settingsQuery.data;
  const patch = (p: Parameters<typeof update.mutate>[0]) => update.mutate(p);

  const files = myFiles.data ?? [];
  const totalSize = files.reduce((sum, f) => sum + Number(f.size), 0);

  return (
    <div className="relative h-full overflow-y-auto no-scrollbar pb-32">
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
          icon={<Moon size={17} />}
          title="Тема"
          subtitle="Чёрная · графитовые элементы"
          right={
            <span className="px-3 py-1.5 rounded-full tcy-card-strong text-[11.5px] font-bold tcy-text">
              Включена
            </span>
          }
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
        <SettingsRow icon={<Globe size={17} />} title="Язык" subtitle="Русский" />
      </SettingsGroup>

      <SettingsGroup title="О приложении">
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
            <span className="w-16 h-16 rounded-[22px] tcy-gradient-accent flex items-center justify-center text-[26px] font-black" style={{ color: "var(--tcy-on-accent)" }}>
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
