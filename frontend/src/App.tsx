import { AppRouter } from "./routes/AppRouter";
import { ErrorBoundary } from "./components/common/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary>
      <AppRouter />
    </ErrorBoundary>
  );
}
