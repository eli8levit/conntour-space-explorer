import { describeError } from "../api/client";
import { Button } from "./Button";

interface ErrorStateProps {
  title?: string;
  error: unknown;
  onRetry?: () => void;
}

export function ErrorState({ title = "Something went wrong", error, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="rounded border border-line px-6 py-10 text-center">
      <h2 className="text-base font-medium">{title}</h2>
      <p className="mt-2 text-sm text-danger">{describeError(error)}</p>
      {onRetry && (
        <Button className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
