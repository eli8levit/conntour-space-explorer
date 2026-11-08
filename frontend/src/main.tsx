import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Self-hosted fonts (bundled by Vite), so the app makes no request to Google Fonts.
// Latin subset only: all NASA captions here are English.
import "@fontsource/instrument-sans/latin-400.css";
import "@fontsource/instrument-sans/latin-500.css";
import "@fontsource/instrument-sans/latin-600.css";
import "./index.css";

import { ApiError } from "./api/client";
import App from "./App";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The image data does not change while the app is open, and a stored
      // search is a fixed snapshot. Refetching on focus would only add load.
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      // Retry once on network or server errors. A 4xx (e.g. 404 for a deleted
      // search) will not change on retry, so we show it at once.
      retry: (failureCount, error) =>
        failureCount < 1 && !(error instanceof ApiError && error.status < 500),
    },
  },
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* Opt in to the v7 behaviors now: same app behavior, and no deprecation warnings in the console. */}
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
