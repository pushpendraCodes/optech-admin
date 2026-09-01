import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

const variants = {
  primary:
    "border-accent/40 bg-accent/15 text-accent hover:bg-accent/25",
  ghost: "border-white/12 bg-white/5 text-foreground hover:bg-white/10",
  danger: "border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return (
    <button
      className={clsx(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
