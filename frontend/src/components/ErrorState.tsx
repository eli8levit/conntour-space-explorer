import { describeError } from "../api/client";

interface ErrorStateProps {
  title: string;
  /** What to do next. Defaults to the error's own message. */
  message?: string;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}

/** A calm error block in the dock style: dark panel, one line of help, a retry link. */
export function ErrorState({ title, message, error, onRetry, className = "" }: ErrorStateProps) {
  return (
    <div role="alert" className={`border border-line-strong bg-[#0B0B0C] px-5 py-4 shadow-dock ${className}`}>
      <p className="text-[15px] text-fg">{title}</p>
      <p className="mt-1 text-[13px] text-muted">{message ?? describeError(error)}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 text-[13px] text-fg underline underline-offset-2 hover:text-accent-text">
          Try again
        </button>
      )}
    </div>
  );
}
