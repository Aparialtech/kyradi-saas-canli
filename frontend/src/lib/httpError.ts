import axios, { type AxiosError } from "axios";

/**
 * Turkish translations for common API error messages.
 * Maps English error messages to user-friendly Turkish messages.
 */
const errorTranslations: Record<string, string> = {
  // Plan limits
  "Plan limit reached: maximum locations for this tenant": 
    "Plan limitine ulaşıldı. Bu otel için en fazla izin verilen lokasyon sayısına ulaştınız. Planınızı yükselterek daha fazla lokasyon ekleyebilirsiniz.",
  "Plan limit reached: maximum storages for this tenant": 
    "Plan limitine ulaşıldı. Bu otel için en fazla izin verilen depo sayısına ulaştınız. Planınızı yükselterek daha fazla depo ekleyebilirsiniz.",
  "Plan limit reached: maximum staff for this tenant": 
    "Plan limitine ulaşıldı. Bu otel için en fazla izin verilen personel sayısına ulaştınız. Planınızı yükselterek daha fazla personel ekleyebilirsiniz.",
  "Plan limit reached: maximum users for this tenant": 
    "Plan limitine ulaşıldı. Bu otel için en fazla izin verilen kullanıcı sayısına ulaştınız. Planınızı yükselterek daha fazla kullanıcı ekleyebilirsiniz.",
  "Plan limit reached: maximum active users": 
    "Plan limitine ulaşıldı. Bu otel için en fazla izin verilen aktif kullanıcı sayısına ulaştınız. Bir kullanıcıyı pasifleştirin veya planınızı yükseltin.",
  "Plan limit reached": 
    "Plan limitine ulaşıldı. Daha fazla kayıt eklemek için planınızı yükseltin.",
  "User limit exceeded for tenant": 
    "Bu otel için kullanıcı limitine ulaşıldı. Daha fazla kullanıcı eklemek için planınızı yükseltin.",
  "Location limit exceeded for tenant": 
    "Bu otel için lokasyon limitine ulaşıldı. Daha fazla lokasyon eklemek için planınızı yükseltin.",
  "Storage limit exceeded for tenant": 
    "Bu otel için depo limitine ulaşıldı. Daha fazla depo eklemek için planınızı yükseltin.",
  "Staff limit exceeded for tenant": 
    "Bu otel için personel limitine ulaşıldı. Daha fazla personel eklemek için planınızı yükseltin.",
  
  // Auth errors
  "Invalid credentials": "Geçersiz kullanıcı bilgileri. E-posta veya şifre hatalı.",
  "User not found": "Kullanıcı bulunamadı.",
  "Email already exists": "Bu e-posta adresi zaten kayıtlı.",
  "Email already registered": "Bu e-posta adresi zaten kayıtlı. Farklı bir e-posta adresi kullanın.",
  "Incorrect password": "Hatalı şifre.",
  "Token expired": "Oturum süresi doldu. Lütfen tekrar giriş yapın.",
  "Invalid token": "Geçersiz oturum. Lütfen tekrar giriş yapın.",
  "Unauthorized": "Bu işlem için yetkiniz bulunmuyor.",
  
  // Permission errors
  "Not authorized": "Bu işlem için yetkiniz bulunmuyor.",
  "Access denied": "Erişim reddedildi.",
  "Permission denied": "İzin reddedildi.",
  "Bu domain için yetki bulunmuyor": 
    "Bu domain için yetki bulunmuyor. Lütfen widget ayarlarını kontrol edin.",
  "Invalid role for tenant user": 
    "Bu rol tenant kullanıcısı için geçersiz.",
  
  // Validation errors
  "Invalid email format": "Geçersiz e-posta formatı.",
  "Password too short": "Şifre çok kısa. En az 8 karakter olmalı.",
  "Required field missing": "Zorunlu alan eksik.",
  "Validation error": "Doğrulama hatası. Lütfen formu kontrol edin.",
  "String should have at least 8 characters": "Şifre en az 8 karakter olmalı.",
  "value is not a valid email address": "Geçerli bir e-posta adresi girin.",
  "Field required": "Bu alan zorunludur.",
  
  // Network errors
  "Network Error": "Bağlantı hatası. İnternet bağlantınızı kontrol edin.",
  "Request failed": "İstek başarısız oldu. Lütfen tekrar deneyin.",
  "Server error": "Sunucu hatası. Lütfen daha sonra tekrar deneyin.",
  "timeout of": "İstek zaman aşımına uğradı. Lütfen tekrar deneyin.",
  "ECONNREFUSED": "Sunucuya bağlanılamıyor. Lütfen daha sonra tekrar deneyin.",
  
  // Resource errors
  "Not found": "Kaynak bulunamadı.",
  "Resource not found": "Kaynak bulunamadı.",
  "Already exists": "Bu kayıt zaten mevcut.",
  "Duplicate entry": "Bu kayıt zaten mevcut.",
  "UNIQUE constraint failed": "Bu kayıt zaten mevcut.",
  "duplicate key value violates unique constraint": "Bu kayıt zaten mevcut.",
  
  // Widget errors
  "Widget yapılandırması bulunamadı": "Widget yapılandırması bulunamadı. Lütfen widget ayarlarını kontrol edin.",
  "Tenant bulunamadı": "Otel bulunamadı. Lütfen doğru ID kullandığınızdan emin olun.",
  
  // Payment errors
  "Payment failed": "Ödeme başarısız oldu.",
  "Payment already exists": "Bu rezervasyon için zaten bir ödeme mevcut.",
  "Invalid payment mode": "Geçersiz ödeme modu.",
  
  // Staff errors
  "Staff not found": "Personel bulunamadı.",
  "Staff assignment already exists": "Bu personel için zaten bir atama mevcut.",
  "No assignable users found": "Atanabilir kullanıcı bulunamadı. Önce kullanıcı ekleyin.",
  
  // Location/Storage errors
  "Location not found": "Lokasyon bulunamadı.",
  "Storage not found": "Depo bulunamadı.",
  "Storage code already exists": "Bu depo kodu zaten kullanılıyor.",
  
  // Reservation errors
  "Reservation not found": "Rezervasyon bulunamadı.",
  "Reservation already cancelled": "Bu rezervasyon zaten iptal edilmiş.",
  "Cannot complete reservation": "Rezervasyon tamamlanamıyor.",
  "Only active reservations can be completed": "Sadece aktif rezervasyonlar tamamlanabilir.",
  "Only reserved or active reservations can be completed": "Sadece rezerve edilmiş veya aktif rezervasyonlar tamamlanabilir.",
  "Cannot complete reservation with status": "Bu durumdaki rezervasyon tamamlanamaz.",
  
  // Generic
  "Something went wrong": "Bir şeyler yanlış gitti. Lütfen tekrar deneyin.",
  "Internal server error": "Sunucu hatası. Lütfen daha sonra tekrar deneyin.",
  "An error occurred": "Bir hata oluştu. Lütfen tekrar deneyin.",
};

/**
 * Translate an error message to Turkish if a translation exists.
 */
function translateError(message: string): string {
  // Check for exact match
  if (errorTranslations[message]) {
    return errorTranslations[message];
  }
  
  // Check for partial matches (case-insensitive)
  const lowerMessage = message.toLowerCase();
  for (const [key, value] of Object.entries(errorTranslations)) {
    if (lowerMessage.includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return message;
}

function extractDetail(detail: unknown): string | null {
  if (!detail) return null;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as Record<string, unknown>).msg);
        }
        return JSON.stringify(item);
      })
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.join(", ");
    }
  }
  if (typeof detail === "object") {
    const messageLike = (detail as Record<string, unknown>).message;
    if (typeof messageLike === "string") {
      return messageLike;
    }
    return JSON.stringify(detail);
  }
  return null;
}

export function getErrorMessage(error: unknown): string {
  let message = "Beklenmeyen bir hata oluştu.";
  
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    if (responseData != null) {
      if (typeof responseData === "string") {
        message = responseData;
      } else {
        const detail = extractDetail((responseData as Record<string, unknown>).detail);
        if (detail) {
          message = detail;
        }
      }
    } else {
      const fallback = (error as AxiosError).message;
      if (fallback) {
        message = fallback;
      }
    }
  } else if (error instanceof Error) {
    message = error.message;
  }

  // Translate the message to Turkish if possible
  return translateError(message);
}

/**
 * Get a user-friendly error message for display in UI.
 * Returns both the translated message and the original for logging.
 */
export function getErrorDetails(error: unknown): { message: string; original: string } {
  let original = "Unknown error";
  
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    if (responseData != null) {
      if (typeof responseData === "string") {
        original = responseData;
      } else {
        const detail = extractDetail((responseData as Record<string, unknown>).detail);
        if (detail) {
          original = detail;
        }
      }
    } else if (error.message) {
      original = error.message;
    }
  } else if (error instanceof Error) {
    original = error.message;
  }

  return {
    message: translateError(original),
    original,
  };
}
