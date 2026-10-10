import { useFileUrl } from "@/hooks/useFileUrl";
import { avatarGradient, initials, isOnline } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  avatarKey?: string | null;
  size?: number;
  lastSeenAt?: Date | string | null;
  showOnline?: boolean;
  className?: string;
};

export function Avatar({
  name,
  avatarKey,
  size = 48,
  lastSeenAt,
  showOnline = false,
  className,
}: Props) {
  const url = useFileUrl(avatarKey);
  const online = showOnline && isOnline(lastSeenAt);
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      {url ? (
        <img
          src={url}
          alt={name}
          draggable={false}
          className="w-full h-full object-cover rounded-full"
          style={{ borderRadius: size >= 56 ? "30%" : "50%" }}
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center font-bold select-none"
          style={{
            borderRadius: size >= 56 ? "30%" : "50%",
            background: avatarGradient(name || "?"),
            fontSize: size * 0.36,
            color: "rgba(255,255,255,0.92)",
          }}
        >
          {initials(name || "?")}
        </div>
      )}
      {showOnline && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-2",
            online ? "tcy-online-pulse" : "",
          )}
          style={{
            width: Math.max(10, size * 0.26),
            height: Math.max(10, size * 0.26),
            borderColor: "var(--tcy-bg)",
            background: online ? "var(--tcy-accent)" : "var(--tcy-faint)",
          }}
        />
      )}
    </div>
  );
}
