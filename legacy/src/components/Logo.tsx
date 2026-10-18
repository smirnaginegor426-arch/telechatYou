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
    <span className="font-extrabold tracking-tight text-[20px] tcy-text select-none">
      TeleChat<span className="tcy-accent">You</span>
    </span>
  );
}
