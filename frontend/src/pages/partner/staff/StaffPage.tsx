import { useState, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { staffService, type Staff, type StaffPayload } from "../../../services/partner/staff";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { SearchInput } from "../../../components/common/SearchInput";
import { StaffDetailModal } from "../../../components/staff/StaffDetailModal";
import { useToast } from "../../../hooks/useToast";
import { useTranslation } from "../../../hooks/useTranslation";
import { getErrorMessage } from "../../../lib/httpError";
import { http } from "../../../lib/http";

interface User {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface Storage {
  id: string;
  code: string;
  location_id: string;
}

interface Location {
  id: string;
  name: string;
}

// Role labels will be handled via i18n in component

export function StaffPage() {
  const { t } = useTranslation();
  const { messages, push } = useToast();
  const queryClient = useQueryClient();
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [viewingStaff, setViewingStaff] = useState<Staff | null>(null);

  const staffQuery = useQuery({
    queryKey: ["staff"],
    queryFn: () => staffService.list(),
  });

  // Tüm kullanıcıları al (staff listesi için eşleştirme)
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await http.get<User[]>("/users");
      return response.data;
    },
  });

  // Atanabilir kullanıcıları al (henüz staff ataması yapılmamış)
  const assignableUsersQuery = useQuery({
    queryKey: ["users", "assignable"],
    queryFn: async () => {
      const response = await http.get<User[]>("/users/assignable");
      return response.data;
    },
  });

  const storagesQuery = useQuery({
    queryKey: ["storages"],
    queryFn: async () => {
      const response = await http.get<Storage[]>("/storages");
      return response.data;
    },
  });

  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const response = await http.get<Location[]>("/locations");
      return response.data;
    },
  });

  // Maps for quick lookup
  const usersById = useMemo(
    () => new Map(usersQuery.data?.map((u) => [u.id, u]) ?? []),
    [usersQuery.data]
  );
  const storagesById = useMemo(
    () => new Map(storagesQuery.data?.map((s) => [s.id, s]) ?? []),
    [storagesQuery.data]
  );
  const locationsById = useMemo(
    () => new Map(locationsQuery.data?.map((l) => [l.id, l]) ?? []),
    [locationsQuery.data]
  );

  // Filter staff by search term
  const filteredStaff = useMemo(() => {
    const staffList = staffQuery.data ?? [];
    if (!searchTerm.trim()) return staffList;

    const term = searchTerm.toLowerCase();
    return staffList.filter((staff) => {
      const user = usersById.get(staff.user_id);
      const email = (user?.email ?? "").toLowerCase();
      const storageNames = staff.assigned_storage_ids
        .map((id) => storagesById.get(id)?.code ?? "")
        .join(" ")
        .toLowerCase();
      const locationNames = staff.assigned_location_ids
        .map((id) => locationsById.get(id)?.name ?? "")
        .join(" ")
        .toLowerCase();

      return email.includes(term) || storageNames.includes(term) || locationNames.includes(term);
    });
  }, [staffQuery.data, searchTerm, usersById, storagesById, locationsById]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  // Role labels using i18n
  const getRoleLabel = useCallback((role: string) => {
    const roleMap: Record<string, string> = {
      storage_operator: t("users.roleLabels.partner_staff"),
      hotel_manager: t("users.roleLabels.partner_admin"),
      accounting: t("staff.role.manager"),
      staff: t("staff.role.staff"),
      tenant_admin: t("users.roleLabels.partner_admin"),
      partner_admin: t("users.roleLabels.partner_admin"),
      partner_user: t("users.roleLabels.partner_user"),
      partner_staff: t("users.roleLabels.partner_staff"),
    };
    return roleMap[role] ?? role;
  }, [t]);

  const createMutation = useMutation({
    mutationFn: (payload: StaffPayload) => staffService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
      void queryClient.invalidateQueries({ queryKey: ["users", "assignable"] });
      push({ title: t("staff.assignmentCreated"), type: "success" });
      reset({ user_id: "", storage_ids: [], location_ids: [] });
      setEditingStaff(null);
    },
    onError: (error: unknown) => {
      push({ title: t("staff.assignmentError"), description: getErrorMessage(error), type: "error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<StaffPayload> }) =>
      staffService.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
      push({ title: t("staff.assignmentUpdated"), type: "success" });
      reset({ user_id: "", storage_ids: [], location_ids: [] });
      setEditingStaff(null);
    },
    onError: (error: unknown) => {
      push({ title: t("staff.assignmentError"), description: getErrorMessage(error), type: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => staffService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
      void queryClient.invalidateQueries({ queryKey: ["users", "assignable"] });
      push({ title: t("staff.assignmentDeleted"), type: "info" });
    },
    onError: (error: unknown) => {
      push({ title: t("staff.assignmentError"), description: getErrorMessage(error), type: "error" });
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StaffPayload>({
    defaultValues: {
      user_id: "",
      storage_ids: [],
      location_ids: [],
    },
  });

  const submit = handleSubmit(async (values) => {
    if (!values.user_id) {
      push({ title: "Kullanıcı seçin", type: "error" });
      return;
    }
    if (editingStaff) {
      await updateMutation.mutateAsync({ id: editingStaff.id, payload: values });
    } else {
      await createMutation.mutateAsync(values);
    }
  });

  const handleNew = () => {
    setEditingStaff(null);
    reset({ user_id: "", storage_ids: [], location_ids: [] });
  };

  return (
    <section className="page">
      <ToastContainer messages={messages} />
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("staff.title")}</h1>
          <p className="page-subtitle">{t("staff.subtitle")}</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn--primary" onClick={handleNew}>
            {t("staff.newAssignment")}
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="panel">
        <div className="panel__header">
          <div>
            <h2 className="panel__title">
              {editingStaff ? t("staff.editAssignment") : t("staff.newAssignment")}
            </h2>
            <p className="panel__subtitle">{t("staff.formSubtitle")}</p>
          </div>
        </div>

        <form className="form-grid" onSubmit={submit}>
          <label className="form-field">
            <span className="form-field__label">
              {t("staff.personnel")} <span style={{ color: "var(--color-danger)" }}>*</span>
            </span>
            {assignableUsersQuery.isLoading ? (
              <div className="form-field__hint">{t("staff.loadingUsers")}</div>
            ) : assignableUsersQuery.data && assignableUsersQuery.data.length > 0 ? (
              <select {...register("user_id", { required: t("staff.userRequired") })} disabled={Boolean(editingStaff)}>
                <option value="">{t("staff.selectPlaceholder")}</option>
                {assignableUsersQuery.data.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email} ({getRoleLabel(user.role)})
                  </option>
                ))}
              </select>
            ) : (
              <div
                style={{
                  padding: "1rem",
                  background: "#fef3c7",
                  borderRadius: "8px",
                  border: "1px solid #fcd34d",
                }}
              >
                <p style={{ fontWeight: 600, color: "#92400e", marginBottom: "0.5rem" }}>
                  ⚠️ {t("staff.noAssignableStaff")}
                </p>
                <p style={{ color: "#a16207", marginBottom: "0.75rem", fontSize: "0.875rem" }}>
                  {t("staff.noAssignableStaffDesc")}
                </p>
                <a href="/partner/users" className="btn btn--primary" style={{ fontSize: "0.875rem" }}>
                  {t("staff.addPersonnel")}
                </a>
              </div>
            )}
            {errors.user_id && <span className="field-error">{errors.user_id.message}</span>}
          </label>

          <label className="form-field">
            <span className="form-field__label">{t("staff.storages")}</span>
            <select multiple {...register("storage_ids")} style={{ minHeight: "100px" }}>
              {storagesQuery.data?.map((storage) => (
                <option key={storage.id} value={storage.id}>
                  {storage.code}
                </option>
              ))}
            </select>
            <small className="form-field__hint">{t("staff.multiSelectHint")}</small>
          </label>

          <label className="form-field">
            <span className="form-field__label">{t("staff.locations")}</span>
            <select multiple {...register("location_ids")} style={{ minHeight: "100px" }}>
              {locationsQuery.data?.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
            <small className="form-field__hint">{t("staff.multiSelectHint")}</small>
          </label>

          <div className="form-actions form-grid__field--full">
            {editingStaff && (
              <button
                type="button"
                className="btn btn--ghost-dark"
                onClick={handleNew}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {t("common.cancel")}
              </button>
            )}
            <button
              type="submit"
              className="btn btn--primary"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingStaff
                ? updateMutation.isPending
                  ? "Güncelleniyor..."
                  : "Güncelle"
                : createMutation.isPending
                  ? "Kaydediliyor..."
                  : t("common.save")}
            </button>
          </div>
        </form>
      </div>

      {/* Staff list */}
      <div className="panel">
        <div className="panel__header">
          <div>
            <h2 className="panel__title">{t("staff.listTitle")}</h2>
            <p className="panel__subtitle">
              {filteredStaff.length} / {staffQuery.data?.length ?? 0} {t("common.records")}
            </p>
          </div>
          <div style={{ minWidth: "250px" }}>
            <SearchInput
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder={t("common.search")}
            />
          </div>
        </div>

        {staffQuery.isLoading ? (
          <div className="empty-state">
            <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>⏳</div>
            <h3 className="empty-state__title">{t("common.loading")}</h3>
            <p>{t("staff.loadingUsers")}</p>
          </div>
        ) : staffQuery.isError ? (
          <div className="empty-state">
            <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
            <h3 className="empty-state__title">{t("common.error")}</h3>
            <p style={{ color: "#dc2626" }}>{t("common.loadError")}</p>
          </div>
        ) : filteredStaff.length > 0 ? (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("staff.table.personnel")}</th>
                  <th>{t("staff.table.role")}</th>
                  <th>{t("staff.table.storages")}</th>
                  <th>{t("staff.table.locations")}</th>
                  <th>{t("staff.table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((staff) => {
                  const user = usersById.get(staff.user_id);
                  return (
                    <tr key={staff.id}>
                      <td>
                        <strong>{user?.email ?? staff.user_id}</strong>
                        {user?.is_active === false && (
                          <span className="badge badge--danger" style={{ marginLeft: "0.5rem" }}>
                            {t("common.passive")}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="badge">{getRoleLabel(user?.role ?? "")}</span>
                      </td>
                      <td>
                        {staff.assigned_storage_ids.length > 0 ? (
                          <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                            {staff.assigned_storage_ids.map((id) => {
                              const storage = storagesById.get(id);
                              return (
                                <span
                                  key={id}
                                  className="badge badge--info"
                                  style={{ fontSize: "0.75rem" }}
                                  title={`Depo ID: ${id}`}
                                >
                                  📦 {storage?.code ?? id.slice(0, 8)}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="table-cell-muted">—</span>
                        )}
                      </td>
                      <td>
                        {staff.assigned_location_ids.length > 0 ? (
                          <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                            {staff.assigned_location_ids.map((id) => {
                              const location = locationsById.get(id);
                              return (
                                <span
                                  key={id}
                                  className="badge badge--success"
                                  style={{ fontSize: "0.75rem" }}
                                  title={`Lokasyon ID: ${id}`}
                                >
                                  📍 {location?.name ?? id.slice(0, 8)}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="table-cell-muted">—</span>
                        )}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="action-link action-link--primary"
                            onClick={() => setViewingStaff(staff)}
                          >
                            {t("common.details")}
                          </button>
                          <button
                            type="button"
                            className="action-link"
                            onClick={() => {
                              setEditingStaff(staff);
                              reset({
                                user_id: staff.user_id,
                                storage_ids: staff.assigned_storage_ids,
                                location_ids: staff.assigned_location_ids,
                              });
                            }}
                          >
                            {t("common.edit")}
                          </button>
                          <button
                            type="button"
                            className="action-link action-link--danger"
                            onClick={() => {
                              if (confirm(t("common.confirmDelete") || "Bu kaydı silmek istediğinize emin misiniz?")) {
                                deleteMutation.mutate(staff.id);
                              }
                            }}
                          >
                            {t("common.delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>👥</div>
            <h3 className="empty-state__title">{t("staff.emptyTitle")}</h3>
            <p>{t("staff.emptyHint")}</p>
          </div>
        )}
      </div>

      {/* Staff Detail Modal */}
      <StaffDetailModal
        isOpen={viewingStaff !== null}
        onClose={() => setViewingStaff(null)}
        staff={viewingStaff}
        users={usersById}
        storages={storagesById}
        locations={locationsById}
      />
    </section>
  );
}
