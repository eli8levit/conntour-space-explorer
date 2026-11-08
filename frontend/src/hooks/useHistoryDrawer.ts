import { useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { OPENED_IN_APP } from "./useImageParam";

// The history drawer lives in the URL as ?history=1 on any route. So the page
// behind it (A1 canvas or A2 results) stays mounted, a reload keeps it open,
// and Back closes it, the same way ?image= works for the details modal.

export function useHistoryDrawer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const isOpen = searchParams.get("history") === "1";

  /** The link target that opens the drawer over the current page. */
  const openLink = (() => {
    const next = new URLSearchParams(searchParams);
    next.set("history", "1");
    next.delete("image"); // one overlay at a time
    return `${location.pathname}?${next.toString()}`;
  })();

  const close = useCallback(() => {
    const openedInApp = (location.state as typeof OPENED_IN_APP | null)?.openedInApp;
    if (openedInApp) {
      navigate(-1); // same as Back: the entry under the drawer
    } else {
      setSearchParams(
        (params) => {
          params.delete("history");
          return params;
        },
        { replace: true },
      );
    }
  }, [location.state, navigate, setSearchParams]);

  return { isOpen, openLink, close };
}
