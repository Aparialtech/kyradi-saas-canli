import { useState, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Package, MapPin, Loader2, AlertCircle, UserPlus, Edit, Trash2, Eye, Download, X, Plus } from "../../../lib/lucide";
import { staffService, type Staff, type StaffPayload } from "../../../services/partner/staff";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { SearchInput } from "../../../components/common/SearchInput";
import { StaffDetailModal } from "../../../components/staff/StaffDetailModal";
import { useToast } from "../../../hooks/useToast";
import { useTranslation } from "../../../hooks/useTranslation";
import { getErrorMessage } from "../../../lib/httpError";
import { http } from "../../../lib/http";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { ModernTable, type ModernTableColumn } from "../../../components/ui/ModernTable";
import { Badge } from "../../../components/ui/Badge";
import { usePagination, calculatePaginationMeta } from "../../../components/common/Pagination";

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
  const navigate = useNavigate();
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [viewingStaff, setViewingStaff] = useState<Staff | null>(null);
  const { page, pageSize, setPage, setPageSize } = usePagination(10);

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
    retry: (failureCount, error: any) => {
      // Don't retry on 404, 401, 403, or network errors
      if (error?.response?.status === 404) return false;
      if (error?.response?.status === 401) return false;
      if (error?.response?.status === 403) return false;
      if (error?.isNetworkError) return false;
      // Retry up to 2 times for other errors (reduced from 3)
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes (formerly cacheTime)
    enabled: true, // Always enabled, but retry logic prevents infinite loops
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

  // Filter staff by search term and role
  const filteredStaff = useMemo(() => {
    let staffList = staffQuery.data ?? [];
    
    // Filter by role
    if (roleFilter) {
      staffList = staffList.filter((staff) => {
        const user = usersById.get(staff.user_id);
        return user?.role === roleFilter;
      });
    }
    
    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      staffList = staffList.filter((staff) => {
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
    }
    
    return staffList;
  }, [staffQuery.data, searchTerm, roleFilter, usersById, storagesById, locationsById]);

  // Paginate filtered data
  const paginatedStaff = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredStaff.slice(start, end);
  }, [filteredStaff, page, pageSize]);

  const paginationMeta = useMemo(() => {
    return calculatePaginationMeta(filteredStaff.length, page, pageSize);
  }, [filteredStaff.length, page, pageSize]);

  // Get unique roles for filter
  const availableRoles = useMemo(() => {
    const roles = new Set<string>();
    (staffQuery.data ?? []).forEach((staff) => {
      const user = usersById.get(staff.user_id);
      if (user?.role) roles.add(user.role);
    });
    return Array.from(roles);
  }, [staffQuery.data, usersById]);

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

  // CSV Export
  const exportToCsv = useCallback(() => {
    if (filteredStaff.length === 0) return;

    const headers = ["E-posta", "Rol", "Depolar", "Lokasyonlar"];
    const csvRows = [headers.join(";")];

    for (const staff of filteredStaff) {
      const user = usersById.get(staff.user_id);
      const storageNames = staff.assigned_storage_ids
        .map((id) => storagesById.get(id)?.code ?? id.slice(0, 8))
        .join(", ");
      const locationNames = staff.assigned_location_ids
        .map((id) => locationsById.get(id)?.name ?? id.slice(0, 8))
        .join(", ");

      const row = [
        user?.email ?? staff.user_id,
        getRoleLabel(user?.role ?? ""),
        storageNames || "-",
        locationNames || "-",
      ];
      csvRows.push(row.map(v => v.includes(";") ? `"${v.replace(/"/g, '""')}"` : v).join(";"));
    }

    const csvString = "\ufeff" + csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "personel_listesi.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredStaff, usersById, storagesById, locationsById, getRoleLabel]);

  const createMutation = useMutation({
    mutationFn: (payload: StaffPayload) => staffService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
      void queryClient.invalidateQueries({ queryKey: ["users", "assignable"] });
      push({ title: t("staff.assignmentCreated"), type: "success" });
      reset({ user_id: "", storage_ids: [], location_ids: [] });
      setEditingStaff(null);
      setShowForm(false);
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
      setShowForm(false);
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
    // Navigate to secure staff assignment page
    navigate("/app/staff/assign");
  };

  const handleCloseForm = () => {
    setEditingStaff(null);
    reset({ user_id: "", storage_ids: [], location_ids: [] });
    setShowForm(false);
  };

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: '1600px', margin: '0 auto' }}>
      <ToastContainer messages={messages} />
      
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <Users className="h-8 w-8" style={{ color: 'var(--primary)' }} />
            <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-black)', color: 'var(--text-primary)', margin: 0 }}>
              {t("staff.title")}
            </h1>
          </div>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', margin: 0 }}>
            {t("staff.subtitle")}
          </p>
        </div>
        <ModernButton variant="primary" onClick={handleNew} leftIcon={<UserPlus className="h-4 w-4" />}>
          {t("staff.newAssignment")}
        </ModernButton>
      </motion.div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
                <div>
                  <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-2) 0' }}>
                    {editingStaff ? t("staff.editAssignment") : t("staff.newAssignment")}
                  </h2>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                    {t("staff.formSubtitle")}
                  </p>
                </div>
                <ModernButton variant="ghost" size="sm" onClick={handleCloseForm} leftIcon={<X className="h-4 w-4" />}>
                  Kapat
                </ModernButton>
              </div>

              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {t("staff.personnel")} <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  {assignableUsersQuery.isLoading ? (
                    <div style={{ padding: 'var(--space-3)', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
                      {t("staff.loadingUsers")}
                    </div>
                  ) : assignableUsersQuery.data && assignableUsersQuery.data.length > 0 ? (
                    <select 
                      {...register("user_id", { required: t("staff.userRequired") })} 
                      disabled={Boolean(editingStaff)}
                      style={{
                        width: '100%',
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-primary)',
                        background: editingStaff ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        fontSize: 'var(--text-sm)',
                        cursor: editingStaff ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <option value="">{t("staff.selectPlaceholder")}</option>
                      {assignableUsersQuery.data.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.email} ({getRoleLabel(user.role)})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <ModernCard variant="glass" padding="md" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                      <p style={{ fontWeight: 600, color: '#92400e', marginBottom: 'var(--space-2)' }}>
                        ⚠️ {t("staff.noAssignableStaff")}
                      </p>
                      <p style={{ color: '#a16207', marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
                        {t("staff.noAssignableStaffDesc")}
                      </p>
                      <ModernButton 
                        variant="primary" 
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          window.location.href = "/app/users";
                        }}
                      >
                        {t("staff.addPersonnel")}
                      </ModernButton>
                    </ModernCard>
                  )}
                  {errors.user_id && (
                    <span style={{ color: 'var(--danger-500)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)', display: 'block' }}>
                      {errors.user_id.message}
                    </span>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {t("staff.storages")}
                  </label>
                  <select 
                    multiple 
                    {...register("storage_ids")} 
                    style={{
                      width: '100%',
                      minHeight: '120px',
                      padding: 'var(--space-2)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--border-primary)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    {storagesQuery.data?.map((storage) => (
                      <option key={storage.id} value={storage.id}>
                        {storage.code}
                      </option>
                    ))}
                  </select>
                  <small style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)', display: 'block' }}>
                    {t("staff.multiSelectHint")}
                  </small>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {t("staff.locations")}
                  </label>
                  <select 
                    multiple 
                    {...register("location_ids")} 
                    style={{
                      width: '100%',
                      minHeight: '120px',
                      padding: 'var(--space-2)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--border-primary)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    {locationsQuery.data?.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                  <small style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)', display: 'block' }}>
                    {t("staff.multiSelectHint")}
                  </small>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                  <ModernButton
                    type="button"
                    variant="ghost"
                    onClick={handleCloseForm}
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {t("common.cancel")}
                  </ModernButton>
                  <ModernButton
                    type="submit"
                    variant="primary"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    isLoading={editingStaff ? updateMutation.isPending : createMutation.isPending}
                    loadingText={editingStaff ? "Güncelleniyor..." : "Kaydediliyor..."}
                  >
                    {editingStaff ? "Güncelle" : t("common.save")}
                  </ModernButton>
                </div>
              </form>
            </ModernCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Staff list */}
      <ModernCard variant="glass" padding="lg">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-1) 0' }}>
              {t("staff.listTitle")}
            </h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
              {filteredStaff.length} / {staffQuery.data?.length ?? 0} {t("common.records")}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ minWidth: "250px", flex: '1', maxWidth: '400px' }}>
              <SearchInput
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder={t("common.search")}
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-primary)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
              }}
            >
              <option value="">Tüm Roller</option>
              {availableRoles.map((role) => (
                <option key={role} value={role}>{getRoleLabel(role)}</option>
              ))}
            </select>
            <ModernButton
              variant="outline"
              size="sm"
              onClick={exportToCsv}
              disabled={filteredStaff.length === 0}
              leftIcon={<Download className="h-4 w-4" />}
            >
              CSV İndir
            </ModernButton>
          </div>
        </div>

        {staffQuery.isLoading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
            <Loader2 className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>{t("common.loading")}</h3>
            <p style={{ margin: 'var(--space-2) 0 0 0' }}>{t("staff.loadingUsers")}</p>
          </div>
        ) : staffQuery.isError ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--danger-500)' }}>
            <AlertCircle className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto' }} />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>{t("common.error")}</h3>
            <p style={{ margin: 'var(--space-2) 0 0 0' }}>{t("common.loadError")}</p>
          </div>
        ) : filteredStaff.length > 0 ? (
          <ModernTable
            columns={[
              {
                key: 'user_id',
                label: t("staff.table.personnel"),
                render: (_, row) => {
                  const user = usersById.get(row.user_id);
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <strong>{user?.email ?? row.user_id}</strong>
                      {user?.is_active === false && (
                        <Badge variant="danger">{t("common.passive")}</Badge>
                      )}
                    </div>
                  );
                },
              },
              {
                key: 'role',
                label: t("staff.table.role"),
                render: (_, row) => {
                  const user = usersById.get(row.user_id);
                  return <Badge>{getRoleLabel(user?.role ?? "")}</Badge>;
                },
              },
              {
                key: 'storages',
                label: t("staff.table.storages"),
                render: (_, row) => {
                  if (row.assigned_storage_ids.length === 0) {
                    return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
                  }
                  return (
                    <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                      {row.assigned_storage_ids.map((id: string) => {
                        const storage = storagesById.get(id);
                        return (
                          <Badge key={id} variant="info">
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--text-xs)' }}>
                              <Package className="h-3 w-3" />
                              {storage?.code ?? id.slice(0, 8)}
                            </span>
                          </Badge>
                        );
                      })}
                    </div>
                  );
                },
              },
              {
                key: 'locations',
                label: t("staff.table.locations"),
                render: (_, row) => {
                  if (row.assigned_location_ids.length === 0) {
                    return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
                  }
                  return (
                    <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                      {row.assigned_location_ids.map((id: string) => {
                        const location = locationsById.get(id);
                        return (
                          <Badge key={id} variant="success">
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--text-xs)' }}>
                              <MapPin className="h-3 w-3" />
                              {location?.name ?? id.slice(0, 8)}
                            </span>
                          </Badge>
                        );
                      })}
                    </div>
                  );
                },
              },
              {
                key: 'actions',
                label: t("staff.table.actions"),
                render: (_, row) => (
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <ModernButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewingStaff(row)}
                      leftIcon={<Eye className="h-3 w-3" />}
                    >
                      {t("common.details")}
                    </ModernButton>
                    <ModernButton
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingStaff(row);
                        reset({
                          user_id: row.user_id,
                          storage_ids: row.assigned_storage_ids,
                          location_ids: row.assigned_location_ids,
                        });
                        setShowForm(true);
                      }}
                      leftIcon={<Edit className="h-3 w-3" />}
                    >
                      {t("common.edit")}
                    </ModernButton>
                    <ModernButton
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        if (confirm(t("common.confirmDelete") || "Bu kaydı silmek istediğinize emin misiniz?")) {
                          deleteMutation.mutate(row.id);
                        }
                      }}
                      leftIcon={<Trash2 className="h-3 w-3" />}
                    >
                      {t("common.delete")}
                    </ModernButton>
                  </div>
                ),
                align: 'right',
              },
            ] as ModernTableColumn<Staff>[]}
            data={paginatedStaff}
            loading={staffQuery.isLoading}
            striped
            hoverable
            stickyHeader
            showRowNumbers
            pagination={paginationMeta}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
            <Users className="h-16 w-16" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--text-muted)' }} />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0', color: 'var(--text-primary)' }}>
              {t("staff.emptyTitle")}
            </h3>
            <p style={{ margin: 0 }}>{t("staff.emptyHint")}</p>
          </div>
        )}
      </ModernCard>

      {/* Staff Detail Modal */}
      <StaffDetailModal
        isOpen={viewingStaff !== null}
        onClose={() => setViewingStaff(null)}
        staff={viewingStaff}
        users={usersById}
        storages={storagesById}
        locations={locationsById}
      />
    </div>
  );
}
