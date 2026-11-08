import { useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

// The open image lives in the URL as ?image=<id>. So a detail view can be
// linked, survives a reload, and the browser Back button closes it.

interface ModalState {
  /** Set when the app itself opened the modal (vs. a pasted link). */
  openedInApp?: boolean;
}

export function useImageParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const raw = searchParams.get("image");
  const imageId = raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;

  /** Opens an image as a new history entry, so Back closes it. */
  const openImage = useCallback(
    (id: number) => {
      setSearchParams(
        (params) => {
          params.set("image", String(id));
          return params;
        },
        { state: { openedInApp: true } satisfies ModalState },
      );
    },
    [setSearchParams],
  );

  /** Swaps the open image ("More like this") without adding a history entry. */
  const replaceImage = useCallback(
    (id: number) => {
      setSearchParams(
        (params) => {
          params.set("image", String(id));
          return params;
        },
        { replace: true, state: location.state },
      );
    },
    [setSearchParams, location.state],
  );

  const closeImage = useCallback(() => {
    if ((location.state as ModalState | null)?.openedInApp) {
      // Same as pressing Back: the URL returns to the page under the modal.
      navigate(-1);
    } else {
      // Opened from a pasted link: there is no app entry to go back to.
      setSearchParams(
        (params) => {
          params.delete("image");
          return params;
        },
        { replace: true },
      );
    }
  }, [location.state, navigate, setSearchParams]);

  return { imageId, openImage, replaceImage, closeImage };
}
