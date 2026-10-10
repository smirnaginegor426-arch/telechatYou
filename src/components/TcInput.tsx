import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const TcInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { error?: string }
>(function TcInput({ className, error, ...rest }, ref) {
  return (
    <div className="w-full">
      <input
        ref={ref}
        className={cn(
          "w-full h-13 px-5 rounded-[18px] tcy-card border tcy-line tcy-text",
          "placeholder:text-[color:var(--tcy-faint)] text-[15px] font-medium",
          "outline-none focus:border-[color:var(--tcy-accent)] transition-colors py-3.5",
          error && "border-[color:var(--tcy-danger)]",
          className,
        )}
        {...rest}
      />
      {error && <p className="mt-1.5 text-[12.5px] tcy-danger px-2">{error}</p>}
    </div>
  );
});

export const TcTextarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TcTextarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full px-5 py-3.5 rounded-[18px] tcy-card border tcy-line tcy-text resize-none",
        "placeholder:text-[color:var(--tcy-faint)] text-[15px] font-medium",
        "outline-none focus:border-[color:var(--tcy-accent)] transition-colors",
        className,
      )}
      {...rest}
    />
  );
});
