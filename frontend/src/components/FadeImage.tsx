import { useState, type ImgHTMLAttributes } from "react";

type Status = "loading" | "loaded" | "failed";

/**
 * A photo that fades in once loaded (opacity 0 -> 1, 200ms) over the `raised`
 * placeholder, so a loading canvas shows calm grey blocks, not spinners. If
 * the image fails, it stays hidden and the grey block (and its captions) remain.
 */
export function FadeImage({ className = "", src, onLoad, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  // Remember which src the status belongs to: a new src (A3 prev/next) starts at "loading" again.
  const [status, setStatus] = useState<{ src?: string; value: Status }>({ src, value: "loading" });
  const current: Status = status.src === src ? status.value : "loading";

  if (current === "failed") return null;
  return (
    <img
      alt=""
      draggable={false}
      {...props}
      src={src}
      onLoad={(event) => {
        setStatus({ src, value: "loaded" });
        onLoad?.(event);
      }}
      onError={() => setStatus({ src, value: "failed" })}
      className={`transition-opacity duration-200 ${current === "loaded" ? "" : "opacity-0"} ${className}`}
    />
  );
}
