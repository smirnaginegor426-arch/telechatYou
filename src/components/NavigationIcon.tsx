type NavigationIconProps = {
  to: string;
  size?: number;
};

/** Filled white glyphs for the liquid-glass navigation island. */
export function NavigationIcon({ to, size = 23 }: NavigationIconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true as const,
    focusable: false as const,
    style: { display: "block", flexShrink: 0 },
  };

  if (to === "/") {
    return (
      <svg {...common}>
        <path
          fill="#FFFFFF"
          d="M12 2.8C6.72 2.8 2.4 6.38 2.4 10.8c0 2.47 1.3 4.66 3.35 6.06l-.83 3.33 3.59-1.68c1.08.3 2.24.46 3.49.46 5.28 0 9.6-3.58 9.6-7.99S17.28 2.8 12 2.8Z"
        />
      </svg>
    );
  }

  if (to === "/contacts") {
    return (
      <svg {...common}>
        <circle cx="8.7" cy="8" r="3.45" fill="#FFFFFF" />
        <circle cx="17.1" cy="9.1" r="2.75" fill="#FFFFFF" />
        <path fill="#FFFFFF" d="M2.35 19.55c.42-3.7 2.77-5.9 6.35-5.9 3.59 0 5.94 2.2 6.36 5.9H2.35Z" />
        <path fill="#FFFFFF" d="M14.2 14.2c3.89-.91 7.04 1.23 7.45 5.35h-4.65c-.22-2.14-1.12-3.94-2.8-5.35Z" />
      </svg>
    );
  }

  if (to === "/profile") {
    return (
      <svg {...common}>
        <circle cx="12" cy="7.5" r="4.15" fill="#FFFFFF" />
        <path fill="#FFFFFF" d="M3.2 21c.38-4.4 3.57-7.1 8.8-7.1s8.42 2.7 8.8 7.1H3.2Z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path
        fill="#FFFFFF"
        d="M4 5.1h16a1.35 1.35 0 0 1 0 2.7H4a1.35 1.35 0 0 1 0-2.7Zm0 5.55h16a1.35 1.35 0 0 1 0 2.7H4a1.35 1.35 0 0 1 0-2.7Zm0 5.55h16a1.35 1.35 0 0 1 0 2.7H4a1.35 1.35 0 0 1 0-2.7Z"
      />
      <circle cx="8" cy="6.45" r="2.35" fill="#FFFFFF" />
      <circle cx="16" cy="11.85" r="2.35" fill="#FFFFFF" />
      <circle cx="10" cy="17.25" r="2.35" fill="#FFFFFF" />
    </svg>
  );
}
