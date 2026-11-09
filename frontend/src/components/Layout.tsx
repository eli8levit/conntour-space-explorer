import { useEffect } from "react";
import { Outlet, useMatch } from "react-router-dom";
import { useSearch } from "../hooks/searches";
import { useSource } from "../hooks/sources";
import { useHistoryDrawer } from "../hooks/useHistoryDrawer";
import { useImageParam } from "../hooks/useImageParam";
import { displayTitle } from "../lib/displayTitle";
import { parseId } from "../lib/ids";
import { Header } from "./Header";
import { HistoryDrawer } from "./HistoryDrawer";
import { HistoryTab } from "./HistoryTab";
import { ImageModal } from "./ImageModal";
import { UndoDeleteProvider, UndoToast } from "./UndoDelete";

/**
 * The frame around every page: the fixed header, the History edge tab, and
 * the two overlays that can open over any page (image details and the
 * history drawer). Each page lays out its own full-viewport content.
 */
export function Layout() {
  const { isOpen: drawerOpen } = useHistoryDrawer();
  const onScene = useMatch("/scene") !== null;
  useSlashToSearch();
  useTabTitle(drawerOpen);

  return (
    <UndoDeleteProvider>
      <Header />
      {/* The scene has its own left-edge year rail, so the tab stays off it. */}
      {!onScene && <HistoryTab />}
      <Outlet />
      {/* One overlay at a time. A pasted "/?image=77&history=1" would open both, so the
          drawer wins (opening it from the app already drops ?image=, see openLink). */}
      {!drawerOpen && <ImageModal />}
      {drawerOpen ? <HistoryDrawer /> : <UndoToast drawerOpen={false} />}
    </UndoDeleteProvider>
  );
}

const APP = "Space Explorer";

/**
 * §14 tab titles: what is in front of the user, then the app name. The
 * overlays win over the page under them. Both queries are already cached
 * by the page or the dialog, so this adds no requests.
 */
function useTabTitle(drawerOpen: boolean) {
  const searchId = parseId(useMatch("/search/:id")?.params.id);
  const onScene = useMatch("/scene") !== null;
  const { imageId } = useImageParam();
  const search = useSearch(searchId);
  const image = useSource(drawerOpen ? null : imageId);

  let title = APP;
  if (drawerOpen) title = `History · ${APP}`;
  else if (image.data) title = `${displayTitle(image.data)} · ${APP}`;
  else if (search.data) title = `“${search.data.query}” · ${APP}`;
  else if (onScene) title = `Space view · ${APP}`;

  useEffect(() => {
    document.title = title;
  }, [title]);
}

/** "/" anywhere (outside a text field or an open dialog) jumps to the search box. */
function useSlashToSearch() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      if (document.querySelector("dialog[open]")) return;
      const input = document.getElementById("search-input");
      if (!input) return;
      event.preventDefault(); // otherwise the "/" lands in the box
      input.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
