export const getApiBase = (): string => {
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.origin;
};
