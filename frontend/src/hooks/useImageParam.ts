import { useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { parseId } from "../lib/ids";

// The open image lives in the URL as ?image=<id>. So a detail view can be
// linked, survives a reload, and the browser Back button closes it.
// Cards are real links to "?image=<id>" (middle-click opens a new tab).

/** Router state that a card link sets, so we know the modal was opened inside the app. */
export const OPENED_IN_APP = { openedInApp: true } as const;

export function useImageParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const imageId = parseId(searchParams.get("image"));

  /** The link target for one image: the current URL plus ?image=<id> (filters stay). */
  const imageLink = useCallback(
    (id: number) => {
      const next = new URLSearchParams(searchParams);
      next.set("image", String(id));
      return `?${next.toString()}`;
    },
    [searchParams],
  );

  const closeImage = useCallback(() => {
    const openedInApp = (location.state as typeof OPENED_IN_APP | null)?.openedInApp;
    if (openedInApp) {
      // Same as pressing Back: we return to the page entry under the modal.
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

  return { imageId, imageLink, closeImage };
}
