export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-label="TeleChatYou">
      <defs>
        <linearGradient id="tcy-lg" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--tcy-accent)" />
          <stop offset="1" stopColor="var(--tcy-accent-deep)" />
        </linearGradient>
      </defs>
      <path
        d="M24 3.5c11.3 0 20.5 8.4 20.5 18.8 0 10.3-9.2 18.7-20.5 18.7-2 0-3.9-.2-5.7-.7l-8.5 4.2c-.9.4-1.9-.4-1.6-1.4l2.4-7.4C6.6 32 3.5 27.4 3.5 22.3 3.5 11.9 12.7 3.5 24 3.5Z"
        fill="url(#tcy-lg)"
      />
      <path
        d="M15 24.5c0-.8.7-1.5 1.5-1.5h15c.8 0 1.5.7 1.5 1.5s-.7 1.5-1.5 1.5h-15c-.8 0-1.5-.7-1.5-1.5Z"
        fill="var(--tcy-on-accent)"
        opacity=".95"
      />
      <circle cx="24" cy="16.5" r="1.8" fill="var(--tcy-on-accent)" opacity=".95" />
      <path
        d="M18.5 31c0-.8.7-1.5 1.5-1.5h8c.8 0 1.5.7 1.5 1.5s-.7 1.5-1.5 1.5h-8c-.8 0-1.5-.7-1.5-1.5Z"
        fill="var(--tcy-on-accent)"
        opacity=".7"
      />
    </svg>
  );
}

export function Wordmark() {
  return (
    <svg
      role="img"
      aria-label="TeleChat You"
      viewBox="0 0 370 58"
      className="h-auto w-[min(100%,300px)] select-none overflow-visible"
    >
      <defs>
        <linearGradient id="tcy-pumpkin-skin" x1="0" y1="0" x2="0.18" y2="1">
          <stop offset="0" stopColor="#ffd27a" />
          <stop offset="0.28" stopColor="#ff9f32" />
          <stop offset="0.68" stopColor="#f47718" />
          <stop offset="1" stopColor="#a83b12" />
        </linearGradient>
        <linearGradient id="tcy-pumpkin-edge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7c2d12" />
          <stop offset="1" stopColor="#431407" />
        </linearGradient>
        <filter id="tcy-pumpkin-shadow" x="-10%" y="-20%" width="125%" height="150%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.8" />
          <feOffset dx="0" dy="2" />
          <feComponentTransfer><feFuncA type="linear" slope=".45" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <clipPath id="tcy-pumpkin-letters">
          <text x="6" y="43" fontFamily="Trebuchet MS, Arial Black, sans-serif" fontSize="37" fontWeight="900" textLength="258" lengthAdjust="spacingAndGlyphs">TeleChat</text>
          <text x="271" y="43" fontFamily="Trebuchet MS, Arial Black, sans-serif" fontSize="37" fontWeight="900" textLength="91" lengthAdjust="spacingAndGlyphs">You</text>
        </clipPath>
        <mask id="tcy-pumpkin-bites">
          <rect width="370" height="58" fill="white" />
          <circle cx="10" cy="18" r="4.5" fill="black" />
          <circle cx="42" cy="44" r="3.8" fill="black" />
          <circle cx="105" cy="44" r="4.4" fill="black" />
          <circle cx="178" cy="13" r="4.2" fill="black" />
          <circle cx="259" cy="29" r="5" fill="black" />
          <circle cx="292" cy="13" r="4" fill="black" />
          <circle cx="347" cy="44" r="4.2" fill="black" />
          <path d="M 225 8 l 5 3 -3 5 -5 -2 Z" fill="black" />
        </mask>
      </defs>
      <g mask="url(#tcy-pumpkin-bites)" filter="url(#tcy-pumpkin-shadow)">
        <g
          fill="url(#tcy-pumpkin-skin)"
          stroke="url(#tcy-pumpkin-edge)"
          strokeWidth="1.7"
          strokeLinejoin="round"
          paintOrder="stroke"
        >
          <text x="6" y="43" fontFamily="Trebuchet MS, Arial Black, sans-serif" fontSize="37" fontWeight="900" textLength="258" lengthAdjust="spacingAndGlyphs">TeleChat</text>
          <text x="271" y="43" fontFamily="Trebuchet MS, Arial Black, sans-serif" fontSize="37" fontWeight="900" textLength="91" lengthAdjust="spacingAndGlyphs">You</text>
        </g>
        <g clipPath="url(#tcy-pumpkin-letters)" fill="none" stroke="#7c2d12" strokeWidth="1.35" opacity=".38">
          <path d="M 19 5 C 31 16, 31 29, 19 48" />
          <path d="M 49 3 C 61 16, 61 30, 49 49" />
          <path d="M 81 4 C 92 16, 92 30, 81 48" />
          <path d="M 112 3 C 124 16, 124 30, 112 49" />
          <path d="M 143 3 C 155 16, 155 30, 143 49" />
          <path d="M 176 3 C 188 16, 188 30, 176 49" />
          <path d="M 208 3 C 220 16, 220 30, 208 49" />
          <path d="M 239 3 C 251 16, 251 30, 239 49" />
          <path d="M 284 3 C 295 16, 295 30, 284 49" />
          <path d="M 314 3 C 326 16, 326 30, 314 49" />
          <path d="M 344 3 C 354 16, 354 30, 344 49" />
        </g>
      </g>
      <path d="M 78 8 C 78 1, 86 1, 88 5 C 84 5, 82 8, 82 12" fill="none" stroke="#49752c" strokeWidth="3" strokeLinecap="round" />
      <path d="M 311 8 C 311 2, 319 1, 322 5 C 318 5, 315 8, 315 12" fill="none" stroke="#49752c" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
