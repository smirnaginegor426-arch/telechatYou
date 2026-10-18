import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Brand mark: deep blue tile with a light blue double-blob figure
 * and the condensed TELECHAT / YOU lettering, as in the app icon.
 */
export function TeleChatYouIcon({
  size = 104,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const bgId = "tcy-icon-bg-" + uid;
  const blobId = "tcy-icon-blob-" + uid;
  const shadowId = "tcy-icon-shadow-" + uid;
  const textId = "tcy-icon-text-" + uid;

  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      className={cn("block", className)}
      role="img"
      aria-label="TeleChatYou"
    >
      <defs>
        <radialGradient id={bgId} cx="50%" cy="42%" r="78%">
          <stop offset="0%" stopColor="#2d25ef" />
          <stop offset="60%" stopColor="#2119dd" />
          <stop offset="100%" stopColor="#1710b6" />
        </radialGradient>
        <linearGradient id={blobId} x1="18%" y1="0%" x2="82%" y2="100%">
          <stop offset="0%" stopColor="#4bb0ff" />
          <stop offset="55%" stopColor="#2196fb" />
          <stop offset="100%" stopColor="#147ff0" />
        </linearGradient>
        <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1" dy="1.4" stdDeviation="1.1" floodColor="#0a4bb0" floodOpacity="0.42" />
        </filter>
        <linearGradient id={textId} x1="12%" y1="8%" x2="88%" y2="92%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#eaf7ff" />
          <stop offset="100%" stopColor="#a9e0ff" />
        </linearGradient>
      </defs>

      <rect width="96" height="96" rx="24" fill={"url(#" + bgId + ")"} />

      {/* double-blob figure */}
      <g fill={"url(#" + blobId + ")"}>
        <rect x="10" y="5" width="76" height="48" rx="23" />
        <rect x="10" y="43" width="76" height="48" rx="23" />
      </g>

      {/* lettering */}
      <g
        fill={"url(#" + textId + ")"}
        filter={"url(#" + shadowId + ")"}
        fontFamily="'Arial Narrow', 'Roboto Condensed', 'Helvetica Neue Condensed', Arial, sans-serif"
        fontWeight={700}
        textAnchor="middle"
      >
        <text transform="translate(48 39) scale(0.6 1)" fontSize="30" letterSpacing="0.3">
          TELECHAT
        </text>
        <text transform="translate(48 83) scale(0.78 1)" fontSize="44" letterSpacing="0.2">
          YOU
        </text>
      </g>
    </svg>
  );
}
