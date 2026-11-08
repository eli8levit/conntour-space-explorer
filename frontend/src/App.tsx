import { lazy, Suspense } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { EmptyState } from "./components/EmptyState";
import { Layout } from "./components/Layout";
import { BrowsePage } from "./pages/BrowsePage";
import { HistoryPage } from "./pages/HistoryPage";
import { SearchResultsPage } from "./pages/SearchResultsPage";

// Lazy: the 3D scene (three.js) is large, so it loads only when /scene opens.
const ScenePage = lazy(() => import("./pages/ScenePage"));

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<BrowsePage />} />
        <Route path="search/:id" element={<SearchResultsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route
          path="scene"
          element={
            <Suspense fallback={<p className="text-sm text-muted">Loading scene…</p>}>
              <ScenePage />
            </Suspense>
          }
        />
        <Route
          path="*"
          element={
            <EmptyState title="Page not found">
              <Link to="/" className="underline underline-offset-4 hover:text-fg">
                Go to Browse
              </Link>
            </EmptyState>
          }
        />
      </Route>
    </Routes>
  );
}
