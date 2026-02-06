import { useMemo } from "react";
import { useTranslation } from "../../hooks/useTranslation";
import { Modal } from "../common/Modal";

interface StaffDetail {
  id: string;
  user_id: string;
  assigned_storage_ids: string[];
  assigned_location_ids: string[];
  created_at?: string;
}

interface User {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  last_login_at?: string | null;
  created_at?: string | null;
}

interface Storage {
  id: string;
  code: string;
  status?: string | null;
  location_id: string;
}

interface Location {
  id: string;
  name: string;
  address?: string | null;
}

interface StaffDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffDetail | null;
  users: Map<string, User>;
  storages: Map<string, Storage>;
  locations: Map<string, Location>;
}

export function StaffDetailModal({
  isOpen,
  onClose,
  staff,
  users,
  storages,
  locations,
}: StaffDetailModalProps) {
  const { t } = useTranslation();

  const user = useMemo(() => {
    if (!staff) return null;
    return users.get(staff.user_id) ?? null;
  }, [staff, users]);

  const assignedStorages = useMemo(() => {
    if (!staff) return [];
    return staff.assigned_storage_ids
      .map((id) => storages.get(id))
      .filter(Boolean) as Storage[];
  }, [staff, storages]);

  const assignedLocations = useMemo(() => {
    if (!staff) return [];
    return staff.assigned_location_ids
      .map((id) => locations.get(id))
      .filter(Boolean) as Location[];
  }, [staff, locations]);

  const roleLabels: Record<string, string> = {
    storage_operator: t("users.roleLabels.partner_staff"),
    hotel_manager: t("users.roleLabels.partner_admin"),
    accounting: t("staff.role.manager"),
    staff: t("staff.role.staff"),
    tenant_admin: t("users.roleLabels.partner_admin"),
    partner_admin: t("users.roleLabels.partner_admin"),
    partner_user: t("users.roleLabels.partner_user"),
    partner_staff: t("users.roleLabels.partner_staff"),
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleString("tr-TR", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return dateStr;
    }
  };

  if (!staff) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("staff.detailTitle")} width="560px">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* User Info */}
        <div>
          <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-muted)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {t("staff.userInfo")}
          </h4>
          <div style={{ background: "var(--color-surface-muted)", borderRadius: "12px", padding: "1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>{t("users.email")}</span>
                <p style={{ fontWeight: 600, margin: "0.25rem 0 0" }}>{user?.email ?? "-"}</p>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>{t("users.role")}</span>
                <p style={{ margin: "0.25rem 0 0" }}>
                  <span className="badge badge--info">{roleLabels[user?.role ?? ""] ?? user?.role ?? "-"}</span>
                </p>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>{t("users.status")}</span>
                <p style={{ margin: "0.25rem 0 0" }}>
                  <span className={`badge ${user?.is_active ? "badge--success" : "badge--danger"}`}>
                    {user?.is_active ? t("common.active") : t("common.passive")}
                  </span>
                </p>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>{t("users.lastLogin")}</span>
                <p style={{ fontWeight: 500, margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
                  {formatDate(user?.last_login_at)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Assigned Storages */}
        <div>
          <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-muted)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {t("staff.assignedStorages")} ({assignedStorages.length})
          </h4>
          {assignedStorages.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {assignedStorages.map((storage) => {
                const location = locations.get(storage.location_id);
                return (
                  <div
                    key={storage.id}
                    style={{
                      background: "var(--color-primary-soft)",
                      borderRadius: "8px",
                      padding: "0.5rem 0.75rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <span style={{ fontSize: "1rem" }}>📦</span>
                    <div>
                      <p style={{ fontWeight: 600, margin: 0, fontSize: "0.875rem" }}>{storage.code}</p>
                      {location && (
                        <p style={{ fontSize: "0.75rem", color: "var(--color-muted)", margin: 0 }}>
                          {location.name}
                        </p>
                      )}
                    </div>
                    {storage.status && (
                      <span
                        className={`badge badge--${
                          storage.status === "idle" 
                            ? "success" // Yeşil - Boş
                            : storage.status === "occupied" 
                            ? "danger" // Kırmızı - Dolu
                            : storage.status === "reserved"
                            ? "warning" // Kahverengi - Rezervasyon
                            : "danger" // Arızalı
                        }`}
                        style={{ fontSize: "0.65rem", marginLeft: "auto" }}
                      >
                        {storage.status === "idle" 
                          ? t("storages.status.idle") 
                          : storage.status === "occupied" 
                          ? t("storages.status.occupied") 
                          : storage.status === "reserved"
                          ? t("storages.status.reserved")
                          : t("storages.status.faulty")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: "var(--color-muted)", fontStyle: "italic", margin: 0 }}>
              {t("staff.noAssignedStorages")}
            </p>
          )}
        </div>

        {/* Assigned Locations */}
        <div>
          <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-muted)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {t("staff.assignedLocations")} ({assignedLocations.length})
          </h4>
          {assignedLocations.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {assignedLocations.map((location) => (
                <div
                  key={location.id}
                  style={{
                    background: "var(--color-secondary-soft)",
                    borderRadius: "8px",
                    padding: "0.5rem 0.75rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span style={{ fontSize: "1rem" }}>📍</span>
                  <div>
                    <p style={{ fontWeight: 600, margin: 0, fontSize: "0.875rem" }}>{location.name}</p>
                    {location.address && (
                      <p style={{ fontSize: "0.75rem", color: "var(--color-muted)", margin: 0 }}>
                        {location.address}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--color-muted)", fontStyle: "italic", margin: 0 }}>
              {t("staff.noAssignedLocations")}
            </p>
          )}
        </div>

        {/* Timestamps */}
        <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--color-muted)" }}>
            <span>{t("common.createdAt")}: {formatDate(staff.created_at)}</span>
            <span>ID: {staff.id.slice(0, 8)}...</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
