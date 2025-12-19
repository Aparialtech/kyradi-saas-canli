import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

import { storageService, type Storage, type StoragePayload, type StorageStatus } from "../../../services/partner/storages";
import { locationService } from "../../../services/partner/locations";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { SearchInput } from "../../../components/common/SearchInput";
import { usePagination, calculatePaginationMeta, Pagination } from "../../../components/common/Pagination";
import { StorageCalendarModal } from "../../../components/storages/StorageCalendarModal";
import { getErrorMessage } from "../../../lib/httpError";
import { useTranslation } from "../../../hooks/useTranslation";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { Badge } from "../../../components/ui/Badge";
import { HardDrive, Calendar, Edit, Trash2, ChevronDown, MapPin, Clock, Package, Plus } from "../../../lib/lucide";

export function LockersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { messages, push } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [locationFilter, setLocationFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [expandedStorageId, setExpandedStorageId] = useState<string | null>(null);
  const { page, pageSize, setPage, setPageSize } = usePagination(10);
  
  // Calendar modal state
  const [calendarStorage, setCalendarStorage] = useState<Storage | null>(null);

  const locationsQuery = useQuery({ queryKey: ["locations"], queryFn: locationService.list });
  const storagesQuery = useQuery({
    queryKey: ["storages", statusFilter],
    queryFn: () => storageService.list(statusFilter ? (statusFilter as StorageStatus) : undefined),
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 401) return false;
      if (error?.response?.status === 403) return false;
      if (error?.response?.status === 404) return false;
      return failureCount < 1;
    },
    retryDelay: 1000,
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

  // Paginate filtered data
  const paginatedStorages = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredStorages.slice(start, end);
  }, [filteredStorages, page, pageSize]);

  const paginationMeta = useMemo(() => {
    return calculatePaginationMeta(filteredStorages.length, page, pageSize);
  }, [filteredStorages.length, page, pageSize]);

  // Toggle expanded row
  const toggleExpand = useCallback((storageId: string) => {
    setExpandedStorageId(prev => prev === storageId ? null : storageId);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  const handleNew = useCallback(() => {
    navigate("/app/lockers/new");
  }, [navigate]);

  const handleEdit = useCallback((storage: Storage) => {
    navigate(`/app/lockers/${storage.id}/edit`);
  }, [navigate]);

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
        <ModernButton variant="primary" onClick={handleNew} leftIcon={<Plus className="h-4 w-4" />}>
          {t("storages.newStorage")}
        </ModernButton>
      </motion.div>

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
          <>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>#</th>
                    <th style={{ width: '40px' }}></th>
                    <th>{t("storages.code")}</th>
                    <th>{t("storages.location")}</th>
                    <th>{t("storages.status")}</th>
                    <th>{t("common.lastActivity")}</th>
                    <th>{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStorages.map((storage, index) => {
                    const isExpanded = expandedStorageId === storage.id;
                    const rowNumber = (page - 1) * pageSize + index + 1;
                    const locationName = locationOptions.find((option) => option.value === storage.location_id)?.label ?? storage.location_id;
                    
                    return (
                      <>
                        <tr 
                          key={storage.id} 
                          onClick={() => toggleExpand(storage.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <span style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              minWidth: '28px',
                              height: '24px',
                              padding: '0 var(--space-2)',
                              fontSize: 'var(--text-xs)',
                              fontWeight: 'var(--font-semibold)',
                              color: 'var(--text-tertiary)',
                              background: 'var(--bg-secondary)',
                              borderRadius: 'var(--radius-md)',
                            }}>
                              {rowNumber}
                            </span>
                          </td>
                          <td>
                            <motion.div
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronDown className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                            </motion.div>
                          </td>
                          <td>
                            <strong>{storage.code}</strong>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                              <MapPin className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                              {locationName}
                            </div>
                          </td>
                          <td>
                            <Badge variant={
                              storage.status === 'idle' ? 'success' :
                              storage.status === 'occupied' ? 'danger' :
                              storage.status === 'reserved' ? 'warning' : 'neutral'
                            }>
                              {t(`storages.status.${storage.status}`)}
                            </Badge>
                          </td>
                          <td>
                            {storage.last_seen_at
                              ? new Date(storage.last_seen_at).toLocaleString("tr-TR", {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })
                              : "-"}
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
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
                        {/* Expanded Detail Row */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.tr
                              key={`${storage.id}-detail`}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <td colSpan={7} style={{ padding: 0 }}>
                                <div style={{ 
                                  padding: 'var(--space-4)', 
                                  background: 'var(--bg-secondary)',
                                  borderTop: '1px solid var(--border-primary)',
                                }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
                                    <div>
                                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-1)' }}>
                                        <Package className="h-3 w-3" style={{ display: 'inline', marginRight: 'var(--space-1)' }} />
                                        Depo Kodu
                                      </div>
                                      <div style={{ fontWeight: 'var(--font-semibold)' }}>{storage.code}</div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-1)' }}>
                                        <MapPin className="h-3 w-3" style={{ display: 'inline', marginRight: 'var(--space-1)' }} />
                                        Lokasyon
                                      </div>
                                      <div style={{ fontWeight: 'var(--font-semibold)' }}>{locationName}</div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-1)' }}>
                                        <Clock className="h-3 w-3" style={{ display: 'inline', marginRight: 'var(--space-1)' }} />
                                        Oluşturulma Tarihi
                                      </div>
                                      <div style={{ fontWeight: 'var(--font-semibold)' }}>
                                        {storage.created_at ? new Date(storage.created_at).toLocaleString("tr-TR") : '-'}
                                      </div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-1)' }}>
                                        Son Güncelleme
                                      </div>
                                      <div style={{ fontWeight: 'var(--font-semibold)' }}>
                                        {storage.created_at ? new Date(storage.created_at).toLocaleString("tr-TR") : '-'}
                                      </div>
                                    </div>
                                  </div>
                                  <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)' }}>
                                    <ModernButton
                                      variant="primary"
                                      size="sm"
                                      onClick={() => setCalendarStorage(storage)}
                                      leftIcon={<Calendar className="h-4 w-4" />}
                                    >
                                      {t("calendar.viewCalendar")}
                                    </ModernButton>
                                    <ModernButton
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEdit(storage)}
                                      leftIcon={<Edit className="h-4 w-4" />}
                                    >
                                      {t("common.edit")}
                                    </ModernButton>
                                  </div>
                                </div>
                              </td>
                            </motion.tr>
                          )}
                        </AnimatePresence>
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <Pagination
              meta={paginationMeta}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
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
