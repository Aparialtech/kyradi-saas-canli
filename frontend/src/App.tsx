import { AppRouter } from "./routes/AppRouter";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { FloatingChatWidget } from "./components/FloatingChatWidget";

export default function App() {
  return (
    <ErrorBoundary>
      <AppRouter />
      <FloatingChatWidget />
    </ErrorBoundary>
  );
}
