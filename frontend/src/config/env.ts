// Demo tenant ID - matches backend seeding in db/utils.py
const DEFAULT_TENANT_ID = "7d7417b7-17fe-4857-ab14-dd3f390ec497";

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

export const env = {
  TENANT_ID: (import.meta.env.VITE_TENANT_ID || DEFAULT_TENANT_ID).trim(),
  ENABLE_INTERNAL_RESERVATIONS: parseBoolean(import.meta.env.VITE_ENABLE_INTERNAL_RESERVATIONS, false),
  PUBLIC_CDN_BASE: import.meta.env.VITE_PUBLIC_CDN_BASE ?? "",
} as const;
