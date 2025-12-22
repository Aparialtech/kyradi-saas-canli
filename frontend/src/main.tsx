import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import App from "./App.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";
import { LocaleProvider } from "./context/LocaleContext.tsx";
import "./index.css";
import "./styles/ui.css";
import "react-day-picker/src/style.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        // Don't retry on network errors
        if (error?.isNetworkError || error?.code === "ERR_NETWORK_CHANGED") {
          return false;
        }
        // Retry up to 2 times for server errors (5xx)
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
      staleTime: 30000, // 30 seconds
      gcTime: 300000, // 5 minutes (formerly cacheTime)
      refetchOnWindowFocus: false, // Prevent refetch on window focus to reduce network calls
      refetchOnReconnect: true, // Refetch when network reconnects
    },
    mutations: {
      retry: false, // Don't retry mutations by default
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LocaleProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </LocaleProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
