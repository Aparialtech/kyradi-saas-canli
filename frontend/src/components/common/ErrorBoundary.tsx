import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "../../lib/lucide";
import { errorLogger, ErrorSeverity } from "../../lib/errorLogger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error with full context
    errorLogger.critical(error, {
      component: this.props.componentName || "ErrorBoundary",
      action: "componentDidCatch",
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "400px",
            padding: "var(--space-8)",
            textAlign: "center",
          }}
        >
          <AlertTriangle className="h-12 w-12" style={{ color: "#dc2626", marginBottom: "var(--space-4)" }} />
          <h2 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "var(--space-2)", color: "var(--color-text)" }}>
            Bir hata oluştu
          </h2>
          <p style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-4)" }}>
            {this.state.error?.message || "Beklenmeyen bir hata oluştu. Lütfen sayfayı yenileyin."}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              padding: "var(--space-3) var(--space-6)",
              background: "var(--color-primary)",
              color: "white",
              border: "none",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Sayfayı Yenile
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

