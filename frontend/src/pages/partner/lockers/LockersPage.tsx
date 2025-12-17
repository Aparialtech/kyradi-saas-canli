import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

import { storageService, type Storage, type StoragePayload, type StorageStatus } from "../../../services/partner/storages";
import { locationService } from "../../../services/partner/locations";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { SearchInput } from "../../../components/common/SearchInput";
import { StorageCalendarModal } from "../../../components/storages/StorageCalendarModal";
import { getErrorMessage } from "../../../lib/httpError";
import { useTranslation } from "../../../hooks/useTranslation";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { HardDrive, Calendar, Edit, Trash2 } from "../../../lib/lucide";

// Status badge classes - labels are fetched via i18n inside component
// Colors: dolu=kırmızı, boş=yeşil, rezervasyon=kahverengi
const statusBadgeClass: Record<StorageStatus, string> = {
  idle: "badge badge--success", // Yeşil - Boş
  occupied: "badge badge--danger", // Kırmızı - Dolu
  reserved: "badge badge--warning", // Kahverengi - Rezervasyon
  faulty: "badge badge--danger",
};

export function LockersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { messages, push } = useToast();
  const [editingStorage, setEditingStorage] = useState<Storage | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [locationFilter, setLocationFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  
  // Calendar modal state
  const [calendarStorage, setCalendarStorage] = useState<Storage | null>(null);

  const locationsQuery = useQuery({ queryKey: ["locations"], queryFn: locationService.list });
  const storagesQuery = useQuery({
    queryKey: ["storages", statusFilter],
    queryFn: () => storageService.list(statusFilter ? (statusFilter as StorageStatus) : undefined),
    retry: (failureCount, error: any) => {
      // Don't retry on 401, 403, 404
      if (error?.response?.status === 401) return false;
      if (error?.response?.status === 403) return false;
      if (error?.response?.status === 404) return false;
      // Retry up to 1 time for other errors
      return failureCount < 1;
    },
    retryDelay: 1000,
  });

  const createMutation = useMutation({
    mutationFn: (payload: StoragePayload) => storageService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storages"] });
      void queryClient.invalidateQueries({ queryKey: ["lockers"] });
      push({ title: t("storages.created"), type: "success" });
      reset({ location_id: "", code: "", status: "idle" });
      setEditingStorage(null);
      setShowForm(false);
    },
    onError: (error: unknown) => {
      push({ title: t("storages.createError"), description: getErrorMessage(error), type: "error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<StoragePayload> }) => storageService.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storages"] });
      void queryClient.invalidateQueries({ queryKey: ["lockers"] });
      push({ title: t("storages.updated"), type: "success" });
      reset({ location_id: "", code: "", status: "idle" });
      setEditingStorage(null);
      setShowForm(false);
    },
    onError: (error: unknown) => {
      push({ title: t("common.saveError"), description: getErrorMessage(error), type: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => storageService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storages"] });
      void queryClient.invalidateQueries({ queryKey: ["lockers"] });
      push({ title: t("storages.deleted"), type: "info" });
    },
    onError: (error: unknown) => {
      push({ title: t("storages.deleteError"), description: getErrorMessage(error), type: "error" });
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StoragePayload>({
    defaultValues: {
      location_id: "",
      code: "",
      status: "idle",
    },
  });

  const locationOptions = useMemo(() => {
    return (locationsQuery.data ?? []).map((location) => ({ value: location.id, label: location.name }));
  }, [locationsQuery.data]);

  // Filter storages by search term and location
  const filteredStorages = useMemo(() => {
    let storages = storagesQuery.data ?? [];
    
    // Filter by location first
    if (locationFilter) {
      storages = storages.filter((storage) => storage.location_id === locationFilter);
    }
    
    // Then filter by search term
    if (!searchTerm.trim()) return storages;
    
    const term = searchTerm.toLowerCase();
    return storages.filter((storage) => {
      const locationName = locationOptions.find((opt) => opt.value === storage.location_id)?.label ?? "";
      return (
        storage.code.toLowerCase().includes(term) ||
        locationName.toLowerCase().includes(term)
      );
    });
  }, [storagesQuery.data, searchTerm, locationFilter, locationOptions]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  const submit = handleSubmit(async (values) => {
    if (!values.location_id) {
      push({ title: t("locations.title") + " " + t("common.required").toLowerCase(), type: "error" });
      return;
    }
    if (editingStorage) {
      await updateMutation.mutateAsync({ id: editingStorage.id, payload: values });
    } else {
      await createMutation.mutateAsync(values);
    }
  });

  const handleNew = () => {
    setEditingStorage(null);
    reset({ location_id: "", code: "", status: "idle" });
    setShowForm(true);
  };

  const handleEdit = (storage: Storage) => {
    setEditingStorage(storage);
    reset({
      location_id: storage.location_id,
      code: storage.code,
      status: storage.status,
    });
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingStorage(null);
    reset({ location_id: "", code: "", status: "idle" });
  };

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: '1600px', margin: '0 auto' }}>
      <ToastContainer messages={messages} />
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-black)', color: 'var(--text-primary)', margin: '0 0 var(--space-2) 0' }}>
            {t("storages.title")}
          </h1>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', margin: 0 }}>
            {t("storages.subtitle")}
          </p>
        </div>
        <ModernButton variant="primary" onClick={handleNew}>
          + {t("storages.newStorage")}
        </ModernButton>
      </motion.div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            style={{ overflow: 'hidden', marginBottom: 'var(--space-6)' }}
          >
            <ModernCard variant="glass" padding="lg">
              <div className="panel__header">
                <div>
                  <h2 className="panel__title">
                    {editingStorage ? t("storages.editStorage") : t("storages.newStorage")}
                  </h2>
                  <p className="panel__subtitle">
                    {t("storages.subtitle")}
                  </p>
                </div>
              </div>

              <form className="form-grid" onSubmit={submit}>
                <label className="form-field">
                  <span className="form-field__label">{t("storages.location")}</span>
                  <select
                    {...register("location_id", { required: t("common.required") })}
                    disabled={locationsQuery.isLoading}
                  >
                    <option value="">{t("staff.selectPlaceholder")}</option>
                    {locationOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {errors.location_id && (
                    <span className="field-error">{errors.location_id.message}</span>
                  )}
                </label>

                <label className="form-field">
                  <span className="form-field__label">{t("storages.code")}</span>
                  <input
                    {...register("code", { required: t("common.required") })}
                    placeholder="LK-001"
                  />
                  {errors.code && <span className="field-error">{errors.code.message}</span>}
                </label>

                <label className="form-field">
                  <span className="form-field__label">{t("storages.status")}</span>
                  <select {...register("status")}>
                    <option value="idle">{t("storages.status.idle")}</option>
                    <option value="occupied">{t("storages.status.occupied")}</option>
                    <option value="reserved">{t("storages.status.reserved")}</option>
                    <option value="faulty">{t("storages.status.faulty")}</option>
                  </select>
                </label>

                <div className="form-actions form-grid__field--full">
                  <button
                    type="button"
                    className="btn btn--ghost-dark"
                    onClick={handleCancelForm}
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    type="submit"
                    className="btn btn--primary"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingStorage
                      ? updateMutation.isPending
                        ? t("common.saving")
                        : t("common.update")
                      : createMutation.isPending
                        ? t("common.saving")
                        : t("common.save")}
                  </button>
                </div>
              </form>
            </ModernCard>
          </motion.div>
        )}
      </AnimatePresence>

      <ModernCard variant="glass" padding="lg">
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: '0 0 var(--space-1) 0' }}>
            {t("storages.title")}
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
            {storagesQuery.isLoading 
              ? t("common.loading") 
              : `${filteredStorages.length} / ${storagesQuery.data?.length ?? 0} ${t("common.records")}`}
          </p>
        </div>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div className="panel__filters" style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ minWidth: "200px" }}>
              <SearchInput
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder={t("common.search")}
              />
            </div>
            <label className="form-field" style={{ marginBottom: 0 }}>
              <span className="form-field__label">{t("storages.filter.location")}</span>
              <select
                value={locationFilter}
                onChange={(event) => setLocationFilter(event.target.value)}
              >
                <option value="">{t("storages.filter.allLocations")}</option>
                {locationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field" style={{ marginBottom: 0 }}>
              <span className="form-field__label">{t("storages.filter.status")}</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">{t("storages.filter.allStatuses")}</option>
                <option value="idle">{t("storages.status.idle")}</option>
                <option value="occupied">{t("storages.status.occupied")}</option>
                <option value="reserved">{t("storages.status.reserved")}</option>
                <option value="faulty">{t("storages.status.faulty")}</option>
              </select>
            </label>
          </div>
        </div>

        {storagesQuery.isLoading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-16)', color: 'var(--text-tertiary)' }}>
            <div className="shimmer" style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-full)', margin: '0 auto var(--space-4) auto' }} />
            <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>{t("common.loading")}</p>
          </div>
        ) : storagesQuery.isError ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-16)', color: 'var(--danger-500)' }}>
            <HardDrive className="h-16 w-16" style={{ margin: '0 auto var(--space-4) auto', opacity: 0.5 }} />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0' }}>{t("common.error")}</h3>
            <p style={{ margin: 0 }}>{t("common.loadError")}</p>
          </div>
        ) : filteredStorages.length > 0 ? (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("storages.code")}</th>
                  <th>{t("storages.location")}</th>
                  <th>{t("storages.status")}</th>
                  <th>{t("common.lastActivity")}</th>
                  <th>{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredStorages.map((storage) => (
                  <tr key={storage.id}>
                    <td>
                      <strong>{storage.code}</strong>
                    </td>
                    <td>
                      {locationOptions.find((option) => option.value === storage.location_id)?.label ?? storage.location_id}
                    </td>
                    <td>
                      <span className={statusBadgeClass[storage.status]}>
                        {t(`storages.status.${storage.status}`)}
                      </span>
                    </td>
                    <td>
                      {storage.last_seen_at
                        ? new Date(storage.last_seen_at).toLocaleString("tr-TR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "-"}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                        <ModernButton
                          variant="ghost"
                          size="sm"
                          onClick={() => setCalendarStorage(storage)}
                          title={t("calendar.storageCalendarTitle")}
                          leftIcon={<Calendar className="h-4 w-4" />}
                        >
                          {t("common.info")}
                        </ModernButton>
                        <ModernButton
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(storage)}
                          leftIcon={<Edit className="h-4 w-4" />}
                        >
                          {t("common.edit")}
                        </ModernButton>
                        <ModernButton
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(t("common.confirmDelete"))) {
                              deleteMutation.mutate(storage.id);
                            }
                          }}
                          leftIcon={<Trash2 className="h-4 w-4" />}
                          style={{ color: 'var(--danger-500)' }}
                        >
                          {t("common.delete")}
                        </ModernButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 'var(--space-16)', color: 'var(--text-tertiary)' }}>
            <HardDrive className="h-16 w-16" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--text-muted)' }} />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0' }}>
              {t("storages.emptyTitle")}
            </h3>
            <p style={{ margin: 0 }}>{t("storages.emptyHint")}</p>
          </div>
        )}
      </ModernCard>
      
      {/* Storage Calendar Modal */}
      {calendarStorage && (
        <StorageCalendarModal
          storageId={calendarStorage.id}
          storageName={calendarStorage.code}
          isOpen={!!calendarStorage}
          onClose={() => setCalendarStorage(null)}
        />
      )}
    </div>
  );
}
