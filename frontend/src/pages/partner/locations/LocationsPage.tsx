import { useMemo, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Edit, Trash2, Phone, Clock, Plus, Search, X, MapPin, Info } from "../../../lib/lucide";

import { locationService, type Location } from "../../../services/partner/locations";
import { quotaService } from "../../../services/partner/reports";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { usePagination, calculatePaginationMeta } from "../../../components/common/Pagination";
import { getErrorMessage } from "../../../lib/httpError";
import { useTranslation } from "../../../hooks/useTranslation";
import { AlertTriangle } from "../../../lib/lucide";

// UI Components
import { Card, CardHeader, CardBody } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { ModernTable, type ModernTableColumn } from "../../../components/ui/ModernTable";

export function LocationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { messages, push } = useToast();
  const { page, pageSize, setPage, setPageSize } = usePagination(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["locations"],
    queryFn: locationService.list,
  });

  const quotaQuery = useQuery({
    queryKey: ["quota"],
    queryFn: quotaService.getQuotaInfo,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => locationService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["locations"] });
      push({ title: t("locations.deleted"), type: "info" });
    },
    onError: (error: unknown) => {
      push({ title: t("locations.deleteError"), description: getErrorMessage(error), type: "error" });
    },
  });

  const handleNew = useCallback(() => {
    navigate('/app/locations/new');
  }, [navigate]);

  const handleEdit = useCallback((location: Location) => {
    navigate(`/app/locations/${location.id}/edit`);
  }, [navigate]);

  const handleDelete = useCallback((location: Location) => {
    if (confirm(t("locations.confirmDelete", { name: location.name }))) {
      deleteMutation.mutate(location.id);
    }
  }, [t, deleteMutation]);

  // Filter data by search term
  const filteredData = useMemo(() => {
    const allData = data ?? [];
    if (!searchTerm.trim()) return allData;
    
    const term = searchTerm.toLowerCase();
    return allData.filter((location) =>
      location.name.toLowerCase().includes(term) ||
      (location.address && location.address.toLowerCase().includes(term)) ||
      (location.phone_number && location.phone_number.includes(term))
    );
  }, [data, searchTerm]);

  // Paginate filtered data
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredData.slice(start, end);
  }, [filteredData, page, pageSize]);

  const paginationMeta = useMemo(() => {
    return calculatePaginationMeta(filteredData.length, page, pageSize);
  }, [filteredData.length, page, pageSize]);

  // Table columns - memoized to prevent recreation on every render
  const columns: ModernTableColumn<Location>[] = useMemo(() => [
    {
      key: 'name',
      label: t("locations.name"),
      render: (value, location) => (
        <button
          onClick={() => setSelectedLocation(location)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            textAlign: 'left',
          }}
        >
          <Info className="h-4 w-4" style={{ color: 'var(--primary-500)', flexShrink: 0 }} />
          <strong style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--primary-600)' }}>{value}</strong>
        </button>
      ),
    },
    {
      key: 'address',
      label: t("locations.address"),
      render: (value) => value || <span style={{ color: 'var(--color-text-muted)' }}>-</span>,
    },
    {
      key: 'phone_number',
      label: t("locations.phoneNumberLabel"),
      render: (value) => {
        if (value) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              <Phone className="h-3.5 w-3.5" style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.875rem' }}>{value}</span>
            </div>
          );
        }
        return <span style={{ color: 'var(--color-text-muted)' }}>-</span>;
      },
    },
    {
      key: 'working_hours',
      label: t("locations.workingHoursLabel"),
      render: (_, location) => {
        if (location.working_hours && typeof location.working_hours === 'object') {
          const hours = location.working_hours as Record<string, { open: string; close: string }>;
          const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
          const activeDays = days.filter(day => hours[day]?.open && hours[day]?.close);
          
          if (activeDays.length > 0) {
            // Show first active day as summary, or show count if multiple
            const firstDay = activeDays[0];
            const firstDayHours = hours[firstDay];
            const summary = activeDays.length === 7 
              ? `${firstDayHours.open} - ${firstDayHours.close} (${t("locations.allDays")})`
              : activeDays.length === 1
              ? `${t(`locations.days.${firstDay}` as any)}: ${firstDayHours.open} - ${firstDayHours.close}`
              : `${activeDays.length} ${t("locations.daysActive")} (${firstDayHours.open} - ${firstDayHours.close})`;
            
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1.5)', maxWidth: '300px' }}>
                <Clock className="h-3.5 w-3.5" style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }} title={activeDays.map(day => `${t(`locations.days.${day}` as any)}: ${hours[day].open} - ${hours[day].close}`).join(', ')}>
                  {summary}
                </span>
              </div>
            );
          }
        }
        return <span style={{ color: 'var(--color-text-muted)' }}>-</span>;
      },
    },
    {
      key: 'lat',
      label: t("locations.coordinates"),
      render: (_, location) => {
        if (location.lat != null && location.lon != null) {
          return (
            <span style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              {location.lat.toFixed(4)} / {location.lon.toFixed(4)}
            </span>
          );
        }
        return <span style={{ color: 'var(--color-text-muted)' }}>-</span>;
      },
    },
    {
      key: 'id',
      label: t("locations.actions"),
      align: 'right',
      render: (_, location) => (
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEdit(location)}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}
          >
            <Edit className="h-4 w-4" />
            {t("locations.edit")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(location)}
            style={{ 
              color: 'var(--color-danger)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)'
            }}
          >
            <Trash2 className="h-4 w-4" />
            {t("locations.delete")}
          </Button>
        </div>
      ),
    },
  ], [t, handleEdit, handleDelete]) as ModernTableColumn<Location>[];

  return (
    <div className="page-container">
      <ToastContainer messages={messages} />
      
      {/* Page Header */}
      <motion.div
        className="page-header"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div>
          <h1 className="page-title text-gradient">{t("nav.locations")}</h1>
          <p className="page-description">
            {t("locations.subtitle")}
          </p>
        </div>
      </motion.div>

      {/* Quota Warning Banner */}
      {quotaQuery.data?.locations && quotaQuery.data.locations.limit !== null && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            marginBottom: 'var(--space-6)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            background: quotaQuery.data.locations.percentage >= 100
              ? 'linear-gradient(135deg, rgba(220, 38, 38, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%)'
              : quotaQuery.data.locations.percentage >= 80
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)'
              : 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)',
            border: `1px solid ${
              quotaQuery.data.locations.percentage >= 100
                ? 'rgba(220, 38, 38, 0.3)'
                : quotaQuery.data.locations.percentage >= 80
                ? 'rgba(245, 158, 11, 0.3)'
                : 'rgba(34, 197, 94, 0.3)'
            }`,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <AlertTriangle 
            className="h-5 w-5" 
            style={{ 
              color: quotaQuery.data.locations.percentage >= 100
                ? '#dc2626'
                : quotaQuery.data.locations.percentage >= 80
                ? '#f59e0b'
                : '#22c55e',
              flexShrink: 0
            }} 
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)', color: 'var(--text-primary)' }}>
              {quotaQuery.data.locations.percentage >= 100
                ? t("quota.locations.full")
                : quotaQuery.data.locations.percentage >= 80
                ? t("quota.locations.nearLimit")
                : t("quota.locations.title")}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              {t("quota.locations.usage", { current: quotaQuery.data.locations.current, limit: quotaQuery.data.locations.limit })}
              {quotaQuery.data.locations.percentage >= 100 && t("quota.locations.cannotCreate")}
              {quotaQuery.data.locations.percentage >= 80 && quotaQuery.data.locations.percentage < 100 && t("quota.locations.nearLimitHint")}
            </div>
          </div>
        </motion.div>
      )}

      {/* Search & Action Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        style={{ 
          marginBottom: 'var(--space-6)', 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-4)',
          flexWrap: 'wrap',
        }}
      >
        {/* Search Input */}
        <div style={{ 
          position: 'relative', 
          flex: '1 1 300px',
          maxWidth: '400px',
        }}>
          <Search 
            className="h-5 w-5" 
            style={{ 
              position: 'absolute', 
              left: 'var(--space-3)', 
              top: '50%', 
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
              pointerEvents: 'none',
            }} 
          />
          <input
            type="text"
            placeholder="Lokasyon ara (isim, adres, telefon)..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1); // Reset to first page on search
            }}
            style={{
              width: '100%',
              padding: 'var(--space-3) var(--space-4) var(--space-3) var(--space-10)',
              border: '1.5px solid var(--border-primary)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-base)',
              transition: 'all 0.2s ease',
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              style={{
                position: 'absolute',
                right: 'var(--space-3)',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'var(--bg-secondary)',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-tertiary)',
              }}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        <Button variant="primary" size="lg" onClick={handleNew}>
          <Plus className="h-4 w-4" style={{ marginRight: 'var(--space-2)' }} />
          {t("locations.newLocation")}
        </Button>
      </motion.div>

      {/* Table Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <Card variant="elevated" padding="none">
          <CardHeader
            title={t("locations.listTitle")}
            description={searchTerm 
              ? `${filteredData.length} / ${data?.length ?? 0} ${t("common.records")} (filtrelendi)`
              : t("locations.listSubtitle", { count: data?.length ?? 0 })}
          />
          <CardBody noPadding>
            {isError ? (
              <div style={{ 
                padding: 'var(--space-12)',
                textAlign: 'center',
                color: 'var(--color-text-muted)'
              }}>
                <AlertCircle className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: '#dc2626' }} />
                <h3 style={{ 
                  fontSize: '1.125rem', 
                  fontWeight: 600, 
                  color: 'var(--color-text)',
                  marginBottom: 'var(--space-2)'
                }}>
                  Lokasyonlar alınamadı
                </h3>
                <p>Sayfayı yenileyerek tekrar deneyin.</p>
              </div>
            ) : (
              <ModernTable
                columns={columns}
                data={paginatedData}
                loading={isLoading}
                showRowNumbers
                pagination={paginationMeta}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                striped
                hoverable
                stickyHeader
                emptyText="Henüz lokasyon kaydı yok"
              />
            )}
          </CardBody>
        </Card>
      </motion.div>

      {/* Location Detail Panel - Using Portal */}
      <AnimatePresence>
        {selectedLocation && (
          <>
            {/* Backdrop - z-index above sticky headers */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLocation(null)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                zIndex: 'var(--z-modal-backdrop, 1040)',
                backdropFilter: 'blur(4px)',
              }}
            />
            {/* Panel - z-index above backdrop and sticky headers */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: '100%',
                maxWidth: '480px',
                background: 'var(--bg-primary)',
                boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.2)',
                zIndex: 'var(--z-modal, 1050)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                isolation: 'isolate',
              }}
            >
              {/* Panel Header */}
              <div style={{
                padding: 'var(--space-6)',
                borderBottom: '1px solid var(--border-primary)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 'var(--space-4)',
              }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>
                    {selectedLocation.name}
                  </h2>
                  <p style={{ margin: 'var(--space-1) 0 0', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                    Lokasyon Detayları
                  </p>
                </div>
                <button
                  onClick={() => setSelectedLocation(null)}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: 'none',
                    borderRadius: 'var(--radius-full)',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--text-tertiary)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Panel Content */}
              <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-6)' }}>
                {/* Address Section */}
                {selectedLocation.address && (
                  <div style={{ marginBottom: 'var(--space-6)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                      <MapPin className="h-5 w-5" style={{ color: 'var(--primary-500)' }} />
                      <span style={{ fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>Adres</span>
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: 'var(--space-7)' }}>
                      {selectedLocation.address}
                    </p>
                  </div>
                )}

                {/* Phone Section */}
                {selectedLocation.phone_number && (
                  <div style={{ marginBottom: 'var(--space-6)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                      <Phone className="h-5 w-5" style={{ color: 'var(--primary-500)' }} />
                      <span style={{ fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>Telefon</span>
                    </div>
                    <a 
                      href={`tel:${selectedLocation.phone_number}`}
                      style={{ 
                        color: 'var(--primary-600)', 
                        textDecoration: 'none',
                        paddingLeft: 'var(--space-7)',
                        display: 'block',
                      }}
                    >
                      {selectedLocation.phone_number}
                    </a>
                  </div>
                )}

                {/* Working Hours Section */}
                {selectedLocation.working_hours && typeof selectedLocation.working_hours === 'object' && (
                  <div style={{ marginBottom: 'var(--space-6)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                      <Clock className="h-5 w-5" style={{ color: 'var(--primary-500)' }} />
                      <span style={{ fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>Çalışma Saatleri</span>
                    </div>
                    <div style={{ paddingLeft: 'var(--space-7)' }}>
                      {(() => {
                        const hours = selectedLocation.working_hours as Record<string, { open: string; close: string }>;
                        const dayNames: Record<string, string> = {
                          monday: 'Pazartesi',
                          tuesday: 'Salı',
                          wednesday: 'Çarşamba',
                          thursday: 'Perşembe',
                          friday: 'Cuma',
                          saturday: 'Cumartesi',
                          sunday: 'Pazar',
                        };
                        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                        
                        return days.map(day => {
                          const dayHours = hours[day];
                          return (
                            <div 
                              key={day}
                              style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between',
                                padding: 'var(--space-2) 0',
                                borderBottom: '1px solid var(--border-secondary)',
                              }}
                            >
                              <span style={{ color: 'var(--text-secondary)' }}>{dayNames[day]}</span>
                              <span style={{ 
                                color: dayHours?.open ? 'var(--success-600)' : 'var(--text-muted)',
                                fontWeight: dayHours?.open ? 'var(--font-medium)' : 'normal',
                              }}>
                                {dayHours?.open ? `${dayHours.open} - ${dayHours.close}` : 'Kapalı'}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}

                {/* Coordinates Section */}
                {selectedLocation.lat != null && selectedLocation.lon != null && (
                  <div style={{ marginBottom: 'var(--space-6)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                      <MapPin className="h-5 w-5" style={{ color: 'var(--primary-500)' }} />
                      <span style={{ fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>Koordinatlar</span>
                    </div>
                    <div style={{ paddingLeft: 'var(--space-7)' }}>
                      <code style={{ 
                        background: 'var(--bg-secondary)', 
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-secondary)',
                      }}>
                        {selectedLocation.lat.toFixed(6)}, {selectedLocation.lon.toFixed(6)}
                      </code>
                      <a
                        href={`https://www.google.com/maps?q=${selectedLocation.lat},${selectedLocation.lon}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-block',
                          marginLeft: 'var(--space-3)',
                          color: 'var(--primary-600)',
                          fontSize: 'var(--text-sm)',
                          textDecoration: 'none',
                        }}
                      >
                        Haritada Göster →
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Panel Footer */}
              <div style={{
                padding: 'var(--space-4) var(--space-6)',
                borderTop: '1px solid var(--border-primary)',
                display: 'flex',
                gap: 'var(--space-3)',
              }}>
                <Button 
                  variant="primary" 
                  onClick={() => {
                    handleEdit(selectedLocation);
                    setSelectedLocation(null);
                  }}
                  style={{ flex: 1 }}
                >
                  <Edit className="h-4 w-4" style={{ marginRight: 'var(--space-2)' }} />
                  Düzenle
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    handleDelete(selectedLocation);
                    setSelectedLocation(null);
                  }}
                  style={{ color: 'var(--danger-500)' }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

