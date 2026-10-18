import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "soft" | "danger";
  size?: "md" | "lg" | "sm" | "icon";
  loading?: boolean;
};

export const TcButton = forwardRef<HTMLButtonElement, Props>(function TcButton(
  { variant = "primary", size = "md", loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "tcy-press inline-flex items-center justify-center gap-2 font-semibold select-none",
        "disabled:opacity-50 disabled:pointer-events-none outline-none",
        size === "md" && "h-12 px-6 rounded-[18px] text-[15px]",
        size === "lg" && "h-14 px-8 rounded-[22px] text-[16px] w-full",
        size === "sm" && "h-9 px-4 rounded-[14px] text-[13px]",
        size === "icon" && "h-11 w-11 rounded-full",
        variant === "primary" && "tcy-gradient-accent tcy-shadow-accent",
        variant === "soft" && "tcy-card-strong border tcy-line",
        variant === "ghost" && "bg-transparent",
        variant === "danger" && "bg-transparent",
        className,
      )}
      style={
        variant === "primary"
          ? { color: "var(--tcy-on-accent)" }
          : variant === "danger"
            ? { color: "var(--tcy-danger)" }
            : variant === "ghost"
              ? { color: "var(--tcy-accent)" }
              : { color: "var(--tcy-text)" }
      }
      {...rest}
    >
      {loading ? (
        <span className="h-5 w-5 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : (
        children
      )}
    </button>
  );
});
