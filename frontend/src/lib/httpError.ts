import axios, { type AxiosError } from "axios";

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
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    if (responseData != null) {
      if (typeof responseData === "string") {
        return responseData;
      }
      const detail = extractDetail((responseData as Record<string, unknown>).detail);
      if (detail) {
        return detail;
      }
    }
    const fallback = (error as AxiosError).message;
    if (fallback) {
      return fallback;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Beklenmeyen bir hata oluştu.";
}
