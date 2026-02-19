/**
 * Centralized error logging service for frontend.
 * Provides structured error logging with context, severity levels, and optional remote reporting.
 */

export type ErrorSeverity = "low" | "medium" | "high" | "critical";

export const ErrorSeverity: {
  LOW: ErrorSeverity;
  MEDIUM: ErrorSeverity;
  HIGH: ErrorSeverity;
  CRITICAL: ErrorSeverity;
} = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
};

export interface ErrorContext {
  userId?: string;
  tenantId?: string;
  route?: string;
  component?: string;
  action?: string;
  [key: string]: unknown;
}

export interface LoggedError {
  message: string;
  error: Error | unknown;
  severity: ErrorSeverity;
  context?: ErrorContext;
  timestamp: string;
  userAgent: string;
  url: string;
  stack?: string;
}

class ErrorLogger {
  private logs: LoggedError[] = [];
  private maxLogs = 100; // Keep last 100 errors in memory

  /**
   * Log an error with context and severity.
   */
  log(
    error: Error | unknown,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context?: ErrorContext
  ): void {
    const errorMessage = this.extractErrorMessage(error);
    const errorStack = this.extractErrorStack(error);

    const loggedError: LoggedError = {
      message: errorMessage,
      error,
      severity,
      context: {
        ...context,
        route: context?.route || window.location.pathname,
      },
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      stack: errorStack,
    };

    // Add to in-memory log
    this.logs.push(loggedError);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // Remove oldest
    }

    // Console logging based on severity
    const consoleMethod = this.getConsoleMethod(severity);
    const logMessage = this.formatLogMessage(loggedError);

    consoleMethod(logMessage, {
      error,
      context: loggedError.context,
      stack: errorStack,
    });

    // In production, could send to error tracking service (Sentry, LogRocket, etc.)
    if (import.meta.env.PROD && (severity === ErrorSeverity.HIGH || severity === ErrorSeverity.CRITICAL)) {
      this.reportToService(loggedError);
    }
  }

  /**
   * Log a low-severity error (warnings, non-critical issues).
   */
  warn(error: Error | unknown, context?: ErrorContext): void {
    this.log(error, ErrorSeverity.LOW, context);
  }

  /**
   * Log a medium-severity error (common errors, API failures).
   */
  error(error: Error | unknown, context?: ErrorContext): void {
    this.log(error, ErrorSeverity.MEDIUM, context);
  }

  /**
   * Log a high-severity error (critical failures, data loss risks).
   */
  critical(error: Error | unknown, context?: ErrorContext): void {
    this.log(error, ErrorSeverity.HIGH, context);
  }

  /**
   * Get recent error logs.
   */
  getRecentLogs(count: number = 10): LoggedError[] {
    return this.logs.slice(-count).reverse();
  }

  /**
   * Clear all logs.
   */
  clear(): void {
    this.logs = [];
  }

  private extractErrorMessage(error: Error | unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "string") {
      return error;
    }
    if (error && typeof error === "object" && "message" in error) {
      return String((error as { message: unknown }).message);
    }
    return "Unknown error";
  }

  private extractErrorStack(error: Error | unknown): string | undefined {
    if (error instanceof Error && error.stack) {
      return error.stack;
    }
    return undefined;
  }

  private getConsoleMethod(severity: ErrorSeverity): typeof console.error {
    switch (severity) {
      case ErrorSeverity.LOW:
        return console.warn;
      case ErrorSeverity.MEDIUM:
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        return console.error;
      default:
        return console.error;
    }
  }

  private formatLogMessage(loggedError: LoggedError): string {
    const parts = [
      `[${loggedError.severity.toUpperCase()}]`,
      loggedError.message,
    ];

    if (loggedError.context?.component) {
      parts.push(`[${loggedError.context.component}]`);
    }
    if (loggedError.context?.action) {
      parts.push(`[${loggedError.context.action}]`);
    }

    return parts.join(" ");
  }

  private reportToService(loggedError: LoggedError): void {
    // TODO: Integrate with error tracking service (Sentry, LogRocket, etc.)
    // For now, just log to console in production
    if (import.meta.env.DEV) {
      console.info("[ErrorLogger] Would report to service:", loggedError);
    }
  }
}

// Singleton instance
export const errorLogger = new ErrorLogger();

/**
 * Setup global error handlers.
 */
export function setupGlobalErrorHandlers(): void {
  // Handle unhandled JavaScript errors
  window.addEventListener("error", (event) => {
    errorLogger.critical(event.error || new Error(event.message), {
      component: "GlobalErrorHandler",
      action: "unhandledError",
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  // Handle unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    errorLogger.critical(event.reason, {
      component: "GlobalErrorHandler",
      action: "unhandledRejection",
    });
  });

  // Log to console that handlers are set up
  if (import.meta.env.DEV) {
    console.info("[ErrorLogger] Global error handlers initialized");
  }
}

