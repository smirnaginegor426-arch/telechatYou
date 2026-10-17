import { Bell, Database, Info, Palette, Paperclip, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";

export type SettingsTabId =
  | "account"
  | "appearance"
  | "notifications"
  | "privacy"
  | "chats"
  | "data"
  | "other";

export const SETTINGS_TABS: { id: SettingsTabId; label: string; icon: LucideIcon }[] = [
  { id: "account", label: "Аккаунт", icon: UserRound },
  { id: "appearance", label: "Внешний вид", icon: Palette },
  { id: "notifications", label: "Уведомления", icon: Bell },
  { id: "privacy", label: "Приватность", icon: ShieldCheck },
  { id: "chats", label: "Чаты и медиа", icon: Paperclip },
  { id: "data", label: "Данные", icon: Database },
  { id: "other", label: "Прочее", icon: Info },
];

export function SettingsTabs({
  value,
  onChange,
}: {
  value: SettingsTabId;
  onChange: (id: SettingsTabId) => void;
}) {
  return (
    <div className="relative z-10">
      <div
        role="tablist"
        aria-label="Разделы настроек"
        className="flex gap-2 overflow-x-auto no-scrollbar py-1"
      >
        {SETTINGS_TABS.map(({ id, label, icon: Icon }) => {
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(id)}
              className="tcy-press flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12px] font-extrabold transition-colors"
              style={{
                background: active ? "var(--tcy-selected-accent)" : "var(--tcy-card-strong)",
                color: active ? "var(--tcy-selected-on-accent)" : "var(--tcy-dim)",
                borderColor: active ? "transparent" : "var(--tcy-line)",
                boxShadow: active ? "0 8px 20px -12px var(--tcy-selected-accent)" : "none",
              }}
            >
              <Icon size={15} strokeWidth={active ? 2.6 : 2.1} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
