export const getApiBase = (): string => {
  if (typeof window === "undefined") {
    return "";
  }
  const origin = window.location.origin;
  if (origin.startsWith("http://")) {
    return origin.replace("http://", "https://");
  }
  return origin;
};
