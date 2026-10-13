import { useState } from "react";
import { EMOJI_GROUPS } from "@/lib/emoji";
import { AppleEmoji } from "./AppleEmoji";

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [group, setGroup] = useState(0);
  return (
    <div className="px-3 pt-1 pb-2">
      <div className="flex gap-1 overflow-x-auto no-scrollbar pb-2">
        {EMOJI_GROUPS.map((g, i) => (
          <button
            key={g.label}
            onClick={() => setGroup(i)}
            className="tcy-press px-3 h-8 rounded-full text-[12px] font-semibold whitespace-nowrap"
            style={{
              background: i === group ? "var(--tcy-accent)" : "var(--tcy-card)",
              color: i === group ? "var(--tcy-on-accent)" : "var(--tcy-dim)",
            }}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-0.5 max-h-[216px] overflow-y-auto no-scrollbar">
        {EMOJI_GROUPS[group].emojis.map((e) => (
          <button
            key={e}
            onClick={() => onPick(e)}
            className="tcy-press text-[24px] h-10 flex items-center justify-center rounded-xl hover:bg-[color:var(--tcy-card)]"
          >
            <AppleEmoji emoji={e} size={26} />
          </button>
        ))}
      </div>
    </div>
  );
}
