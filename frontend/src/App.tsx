import { lazy, Suspense } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { EmptyState } from "./components/EmptyState";
import { Layout } from "./components/Layout";
import { BrowsePage } from "./pages/BrowsePage";
import { SearchResultsPage } from "./pages/SearchResultsPage";

// Lazy: the 3D scene (three.js) is large, so it loads only when /scene opens.
const ScenePage = lazy(() => import("./pages/ScenePage"));

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<BrowsePage />} />
        <Route path="search/:id" element={<SearchResultsPage />} />
        {/* History is a drawer over any page (?history=1). The old URL still works. */}
        <Route path="history" element={<Navigate to="/?history=1" replace />} />
        <Route
          path="scene"
          element={
            // The scene owns the whole viewport under the 64px header.
            <main className="fixed inset-x-0 bottom-0 top-16">
              <Suspense fallback={<p className="p-8 text-[13px] text-muted">Loading the Space view…</p>}>
                <ScenePage />
              </Suspense>
            </main>
          }
        />
        <Route
          path="*"
          element={
            <main className="flex min-h-screen items-center justify-center px-6">
              <EmptyState title="Page not found.">
                <Link to="/" className="text-fg underline underline-offset-2">
                  Back to the archive
                </Link>
              </EmptyState>
            </main>
          }
        />
      </Route>
    </Routes>
  );
}
