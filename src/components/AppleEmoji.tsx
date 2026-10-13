import { Fragment, useState } from "react";

const APPLE_EMOJI_BASE =
  "https://cdn.jsdelivr.net/npm/emoji-datasource-apple@16.0.0/img/apple/64/";

const emojiPattern = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3]/u;
const graphemeSegmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

function emojiImageName(emoji: string) {
  return (
    Array.from(emoji, (character) => character.codePointAt(0)?.toString(16) ?? "")
      .filter(Boolean)
      .join("-") + ".png"
  );
}

type AppleEmojiProps = {
  emoji: string;
  size?: number | string;
  className?: string;
};

export function AppleEmoji({ emoji, size = "1.15em", className }: AppleEmojiProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const dimension = typeof size === "number" ? size + "px" : size;

  if (imageFailed) {
    return (
      <span className={className} role="img" aria-label={emoji}>
        {emoji}
      </span>
    );
  }

  return (
    <img
      src={APPLE_EMOJI_BASE + emojiImageName(emoji)}
      alt={emoji}
      draggable={false}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => setImageFailed(true)}
      style={{
        display: "inline-block",
        width: dimension,
        height: dimension,
        objectFit: "contain",
        verticalAlign: typeof size === "number" ? "middle" : "-0.16em",
        flexShrink: 0,
      }}
    />
  );
}

export function EmojiText({ text }: { text: string }) {
  // Keep native rendering in older browsers that do not support grapheme segmentation.
  if (!graphemeSegmenter) return <>{text}</>;

  const segments = Array.from(graphemeSegmenter.segment(text), (part) => part.segment);

  return (
    <>
      {segments.map((segment, index) =>
        emojiPattern.test(segment) ? (
          <AppleEmoji key={index} emoji={segment} />
        ) : (
          <Fragment key={index}>{segment}</Fragment>
        ),
      )}
    </>
  );
}
