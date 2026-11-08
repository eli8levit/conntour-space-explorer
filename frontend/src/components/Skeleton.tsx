// Grey placeholder shapes shown while data loads, so the layout does not jump.
import { GRID_CLASSES } from "./ImageGrid";

export function GridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <ul aria-hidden="true" className={GRID_CLASSES}>
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="animate-pulse">
          <div className="aspect-[4/3] rounded-sm bg-raised" />
          <div className="mt-2 h-4 w-3/4 rounded-sm bg-raised" />
          <div className="mt-1 h-3 w-1/2 rounded-sm bg-raised" />
        </li>
      ))}
    </ul>
  );
}

export function ListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul aria-hidden="true" className="divide-y divide-line border-y border-line">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="flex animate-pulse items-center gap-4 py-3">
          <div className="h-9 w-12 rounded-sm bg-raised" />
          <div className="flex-1">
            <div className="h-4 w-1/3 rounded-sm bg-raised" />
            <div className="mt-2 h-3 w-1/4 rounded-sm bg-raised" />
          </div>
        </li>
      ))}
    </ul>
  );
}
