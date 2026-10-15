import { Check } from "lucide-react";

/** Small, accessible badge for accounts included in the tester allowlist. */
export function TesterBadge() {
  return (
    <span
      role="img"
      aria-label="Тестер TeleChat You"
      title="Тестер TeleChat You"
      className="inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full align-middle"
      style={{ background: "#3498db", color: "#ffffff" }}
    >
      <Check size={10} strokeWidth={3.5} />
    </span>
  );
}
