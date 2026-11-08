import type { ButtonHTMLAttributes } from "react";

/** The one button style: thin outline that turns white on hover. */
export function Button({ className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`rounded-sm border border-line-strong px-3 py-1.5 text-sm text-fg transition-colors hover:border-fg disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
