import type { ReactNode } from "react";

interface DataStateWrapperProps<T> {
  isLoading: boolean;
  isError: boolean;
  data: T | undefined | null;
  isEmpty?: boolean;
  loadingIcon?: string;
  loadingTitle?: string;
  loadingDescription?: string;
  errorIcon?: string;
  errorTitle?: string;
  errorDescription?: string;
  onRetry?: () => void;
  emptyIcon?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  children: (data: T) => ReactNode;
}

/**
 * Reusable component to handle loading/error/empty states consistently.
 * 
 * Usage:
 * ```tsx
 * <DataStateWrapper
 *   isLoading={query.isLoading}
 *   isError={query.isError}
 *   data={query.data}
 *   onRetry={() => query.refetch()}
 * >
 *   {(data) => <YourComponent data={data} />}
 * </DataStateWrapper>
 * ```
 */
export function DataStateWrapper<T>({
  isLoading,
  isError,
  data,
  isEmpty,
  loadingIcon = "⏳",
  loadingTitle = "Veriler yükleniyor...",
  loadingDescription = "Lütfen bekleyin",
  errorIcon = "⚠️",
  errorTitle = "Veriler yüklenirken bir hata oluştu",
  errorDescription = "Lütfen tekrar deneyin veya sayfayı yenileyin.",
  onRetry,
  emptyIcon = "📋",
  emptyTitle = "Henüz kayıt bulunmuyor",
  emptyDescription = "Bu kriterlere uygun kayıt bulunamadı.",
  children,
}: DataStateWrapperProps<T>) {
  // Loading state
  if (isLoading) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>
          {loadingIcon}
        </div>
        <h3 className="empty-state__title">{loadingTitle}</h3>
        <p className="empty-state__description">{loadingDescription}</p>
        <div className="loading-skeleton" style={{ marginTop: "1rem" }}>
          <div className="skeleton-row" style={{ height: "1rem", width: "80%", margin: "0.5rem auto", background: "#e5e7eb", borderRadius: "0.25rem" }} />
          <div className="skeleton-row" style={{ height: "1rem", width: "60%", margin: "0.5rem auto", background: "#e5e7eb", borderRadius: "0.25rem" }} />
          <div className="skeleton-row" style={{ height: "1rem", width: "70%", margin: "0.5rem auto", background: "#e5e7eb", borderRadius: "0.25rem" }} />
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>
          {errorIcon}
        </div>
        <h3 className="empty-state__title">{errorTitle}</h3>
        <p className="empty-state__description">{errorDescription}</p>
        {onRetry && (
          <button
            type="button"
            className="btn btn--primary"
            onClick={onRetry}
            style={{ marginTop: "1rem" }}
          >
            Tekrar Dene
          </button>
        )}
      </div>
    );
  }

  // Check for empty data
  const isDataEmpty = isEmpty ?? (
    data === undefined ||
    data === null ||
    (Array.isArray(data) && data.length === 0)
  );

  if (isDataEmpty) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>
          {emptyIcon}
        </div>
        <h3 className="empty-state__title">{emptyTitle}</h3>
        <p className="empty-state__description">{emptyDescription}</p>
      </div>
    );
  }

  // Success state - render children with data
  return <>{children(data as T)}</>;
}

/**
 * Turkish error message translations for common API errors.
 */
export const errorMessagesTR: Record<string, string> = {
  // Plan limits
  "Plan limit reached: maximum locations for this tenant": "Plan limitine ulaşıldı. Bu otel için en fazla izin verilen lokasyon sayısına ulaştınız.",
  "Plan limit reached: maximum storages for this tenant": "Plan limitine ulaşıldı. Bu otel için en fazla izin verilen depo sayısına ulaştınız.",
  "Plan limit reached: maximum staff for this tenant": "Plan limitine ulaşıldı. Bu otel için en fazla izin verilen personel sayısına ulaştınız.",
  "Plan limit reached: maximum users for this tenant": "Plan limitine ulaşıldı. Bu otel için en fazla izin verilen kullanıcı sayısına ulaştınız.",
  
  // Auth errors
  "Invalid credentials": "Geçersiz kullanıcı bilgileri",
  "User not found": "Kullanıcı bulunamadı",
  "Email already exists": "Bu e-posta adresi zaten kayıtlı",
  "Incorrect password": "Hatalı şifre",
  "Token expired": "Oturum süresi doldu, lütfen tekrar giriş yapın",
  
  // Permission errors
  "Not authorized": "Bu işlem için yetkiniz bulunmuyor",
  "Access denied": "Erişim reddedildi",
  "Bu domain için yetki bulunmuyor": "Bu domain için yetki bulunmuyor. Lütfen widget ayarlarını kontrol edin.",
  
  // Validation errors
  "Invalid email format": "Geçersiz e-posta formatı",
  "Password too short": "Şifre çok kısa",
  "Required field missing": "Zorunlu alan eksik",
  
  // Network errors
  "Network Error": "Bağlantı hatası. İnternet bağlantınızı kontrol edin.",
  "Request failed": "İstek başarısız oldu. Lütfen tekrar deneyin.",
  "Server error": "Sunucu hatası. Lütfen daha sonra tekrar deneyin.",
  
  // Generic
  "Something went wrong": "Bir şeyler yanlış gitti. Lütfen tekrar deneyin.",
};

/**
 * Translate an error message to Turkish if a translation exists.
 */
export function translateError(message: string): string {
  // Check for exact match
  if (errorMessagesTR[message]) {
    return errorMessagesTR[message];
  }
  
  // Check for partial matches
  for (const [key, value] of Object.entries(errorMessagesTR)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return message;
}

