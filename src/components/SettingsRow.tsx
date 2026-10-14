import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsRow({
  icon,
  title,
  subtitle,
  right,
  onClick,
  danger,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  const content = (
    <>
      <span
        className="tcy-settings-item-icon flex items-center justify-center shrink-0"
        style={{
          background: danger
            ? "color-mix(in srgb, var(--tcy-danger) 14%, transparent)"
            : "color-mix(in srgb, var(--tcy-selected-accent) 24%, transparent)",
          color: danger ? "var(--tcy-danger)" : "var(--tcy-selected-accent)",
        }}
      >
        {icon}
      </span>

      <span className="flex-1 min-w-0">
        <span
          className={cn(
            "tcy-settings-item-title block",
            danger ? "tcy-danger" : "tcy-text",
          )}
        >
          {title}
        </span>

        {subtitle && (
          <span className="tcy-settings-item-subtitle tcy-faint">
            {subtitle}
          </span>
        )}
      </span>
    </>
  );

  return (
    <div className="tcy-settings-item w-full flex items-center gap-3.5 px-4 py-[17px] rounded-[27px] border">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="flex flex-1 min-w-0 items-center gap-3.5 text-left rounded-[20px] transition-colors"
        >
          {content}

          {!right && (
            <ChevronRight
              size={17}
              className="shrink-0"
              style={{ color: "var(--tcy-faint)" }}
            />
          )}
        </button>
      ) : (
        <div className="flex flex-1 min-w-0 items-center gap-3.5">
          {content}
        </div>
      )}

      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      className="relative w-[46px] h-[27px] rounded-full transition-colors duration-200 shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        background: checked
          ? "var(--tcy-selected-accent)"
          : "var(--tcy-card-strong)",
      }}
    >
      <span
        className="absolute left-[3px] top-[3px] w-[21px] h-[21px] rounded-full bg-white transition-transform duration-200"
        style={{
          transform: checked ? "translateX(19px)" : "translateX(0)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
        }}
      />
    </button>
  );
}

export function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-5">
      <h4 className="px-5 pb-2 text-[12px] font-bold uppercase tracking-[0.08em] tcy-faint">
        {title}
      </h4>

      <div className="tcy-settings-panel mx-4 flex flex-col gap-1.5">
        {children}
      </div>
    </div>
  );
}
