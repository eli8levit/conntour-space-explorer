import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  /** Explanation and next steps (links, suggestions). */
  children?: ReactNode;
  className?: string;
}

/** A plain message: one line in `fg`, the explanation in `muted`. No boxes, no icons. */
export function EmptyState({ title, children, className = "" }: EmptyStateProps) {
  return (
    <div className={className}>
      <p className="text-[15px] text-fg">{title}</p>
      {children && <div className="mt-1.5 text-[13px] leading-normal text-muted">{children}</div>}
    </div>
  );
}
