import { useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertCircle, Edit, Trash2, Phone, Clock, Plus } from "../../../lib/lucide";

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

  // Paginate data client-side
  const paginatedData = useMemo(() => {
    const allData = data ?? [];
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return allData.slice(start, end);
  }, [data, page, pageSize]);

  const paginationMeta = useMemo(() => {
    return calculatePaginationMeta(data?.length ?? 0, page, pageSize);
  }, [data?.length, page, pageSize]);

  // Table columns - memoized to prevent recreation on every render
  const columns: ModernTableColumn<Location>[] = useMemo(() => [
    {
      key: 'name',
      label: t("locations.name"),
      render: (value) => (
        <strong style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{value}</strong>
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

      {/* Action Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'flex-end' }}
      >
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
            description={t("locations.listSubtitle", { count: data?.length ?? 0 })}
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
    </div>
  );
}

