import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  /** Explanation and next steps (links, suggestion buttons). */
  children?: ReactNode;
}

export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <div className="rounded border border-dashed border-line px-6 py-12 text-center">
      <h2 className="text-base font-medium">{title}</h2>
      {children && <div className="mt-3 text-sm text-muted">{children}</div>}
    </div>
  );
}
