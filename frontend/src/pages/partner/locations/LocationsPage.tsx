import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Edit, Trash2, Phone, Clock } from "../../../lib/lucide";

import { locationService, type Location, type LocationPayload } from "../../../services/partner/locations";
import { quotaService } from "../../../services/partner/reports";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { getErrorMessage } from "../../../lib/httpError";
import { useTranslation } from "../../../hooks/useTranslation";
import { AlertTriangle } from "../../../lib/lucide";

// New Premium UI Components
import { Card, CardHeader, CardBody } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Table, type Column } from "../../../components/ui/Table";

const schema = z.object({
  name: z.string().min(2, { message: "locations.nameMinLength" }),
  address: z.string().optional(),
  phone_number: z.string().optional(),
  working_hours: z.record(z.string(), z.object({
    open: z.string(),
    close: z.string(),
  })).optional(),
  lat: z.string().optional(),
  lon: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function LocationsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { messages, push } = useToast();
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["locations"],
    queryFn: locationService.list,
  });

  const quotaQuery = useQuery({
    queryKey: ["quota"],
    queryFn: quotaService.getQuotaInfo,
  });

  const createMutation = useMutation({
    mutationFn: (payload: LocationPayload) => locationService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["locations"] });
      push({ title: t("locations.created"), type: "success" });
      reset({ name: "", address: "", phone_number: "", working_hours: undefined, lat: "", lon: "" });
      setEditingLocation(null);
      setShowForm(false);
    },
    onError: (error: unknown) => {
      push({ title: t("locations.createError"), description: getErrorMessage(error), type: "error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<LocationPayload> }) =>
      locationService.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["locations"] });
      push({ title: t("locations.updated"), type: "success" });
      reset({ name: "", address: "", phone_number: "", working_hours: undefined, lat: "", lon: "" });
      setEditingLocation(null);
      setShowForm(false);
    },
    onError: (error: unknown) => {
      push({ title: t("locations.updateError"), description: getErrorMessage(error), type: "error" });
    },
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

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      address: "",
      phone_number: "",
      working_hours: undefined,
      lat: "",
      lon: "",
    },
  });

  // Translate validation errors
  const translatedErrors = useMemo(() => ({
    name: errors.name?.message ? t(errors.name.message as any) : undefined,
  }), [errors.name, t]);

  const handleNew = useCallback(() => {
    setEditingLocation(null);
    reset({ name: "", address: "", phone_number: "", working_hours: undefined, lat: "", lon: "" });
    setShowForm(true);
  }, [reset]);

  const handleEdit = useCallback((location: Location) => {
    setEditingLocation(location);
    reset({
      name: location.name,
      address: location.address ?? "",
      phone_number: location.phone_number ?? "",
      working_hours: (location.working_hours as Record<string, { open: string; close: string }> | undefined) ?? undefined,
      lat: location.lat != null ? String(location.lat) : "",
      lon: location.lon != null ? String(location.lon) : "",
    });
    setShowForm(true);
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [reset]);

  const handleDelete = useCallback((location: Location) => {
    if (confirm(t("locations.confirmDelete", { name: location.name }))) {
      deleteMutation.mutate(location.id);
    }
  }, [t, deleteMutation]);

  const submit = handleSubmit(async (values) => {
    const payload: LocationPayload = {
      name: values.name,
      address: values.address?.trim() ? values.address.trim() : undefined,
      phone_number: values.phone_number?.trim() ? values.phone_number.trim() : undefined,
      working_hours: values.working_hours && Object.keys(values.working_hours).length > 0 ? values.working_hours : undefined,
      lat: values.lat ? Number(values.lat) : undefined,
      lon: values.lon ? Number(values.lon) : undefined,
    };

    if (editingLocation) {
      await updateMutation.mutateAsync({ id: editingLocation.id, payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
  });

  // Table columns - memoized to prevent recreation on every render
  const columns: Column<Location>[] = useMemo(() => [
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
  ], [t, handleEdit, handleDelete]);

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
          + {t("locations.newLocation")}
        </Button>
      </motion.div>

      {/* Form Card - Only shown when showForm is true */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 'var(--space-6)' }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3 }}
            style={{ overflow: 'hidden' }}
          >
            <Card variant="elevated" padding="none">
              <CardHeader
                title={editingLocation ? t("locations.editLocation") : t("locations.newLocation")}
                description={t("locations.formSubtitle")}
              />
              <CardBody>
            <form onSubmit={submit}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-6)'
              }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Input
                    {...register("name")}
                    label={t("locations.nameLabel")}
                    placeholder="Örn: Taksim Şube"
                    required
                    error={translatedErrors.name}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <Input
                    {...register("address")}
                    label={t("locations.addressLabel")}
                    placeholder={t("locations.address")}
                    helperText={t("common.optional")}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Phone className="h-4 w-4" style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <Input
                      {...register("phone_number")}
                      label={t("locations.phoneNumberLabel")}
                      placeholder="+90 555 123 45 67"
                      helperText={t("common.optional")}
                    />
                  </div>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <Clock className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
                    <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text)' }}>
                      {t("locations.workingHoursLabel")}
                    </label>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                      {t("common.optional")}
                    </span>
                  </div>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3)',
                    background: 'var(--color-surface-secondary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)'
                  }}>
                    {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                      <div key={day} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>
                          {t(`locations.days.${day}` as any)}
                        </label>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                          <Input
                            {...register(`working_hours.${day}.open`)}
                            placeholder="09:00"
                            inputSize="sm"
                            style={{ flex: 1 }}
                          />
                          <span style={{ alignSelf: 'center', color: 'var(--color-text-muted)' }}>-</span>
                          <Input
                            {...register(`working_hours.${day}.close`)}
                            placeholder="18:00"
                            inputSize="sm"
                            style={{ flex: 1 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Input
                  {...register("lat")}
                  label={t("locations.latLabel")}
                  type="number"
                  inputSize="md"
                  placeholder="41.0082"
                  helperText={t("locations.latHelper")}
                />

                <Input
                  {...register("lon")}
                  label={t("locations.lonLabel")}
                  type="number"
                  inputSize="md"
                  placeholder="28.9784"
                  helperText={t("locations.lonHelper")}
                />
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowForm(false);
                    setEditingLocation(null);
                    reset({ name: "", address: "", phone_number: "", working_hours: undefined, lat: "", lon: "" });
                  }}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={createMutation.isPending || updateMutation.isPending}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingLocation ? t("common.update") : t("common.save")}
                </Button>
              </div>
            </form>
              </CardBody>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

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
              <Table
                columns={columns}
                data={data ?? []}
                keyExtractor={(location) => location.id}
                isLoading={isLoading}
                emptyState={
                  <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>📍</div>
                    <h3 style={{ 
                      fontSize: '1.125rem', 
                      fontWeight: 600, 
                      color: 'var(--color-text)',
                      marginBottom: 'var(--space-2)'
                    }}>
                      Henüz lokasyon kaydı yok
                    </h3>
                    <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
                      Yukarıdaki formu kullanarak yeni bir lokasyon ekleyebilirsiniz.
                    </p>
                    <Button variant="primary" onClick={handleNew}>
                      İlk Lokasyonu Ekle
                    </Button>
                  </div>
                }
              />
            )}
          </CardBody>
        </Card>
      </motion.div>
    </div>
  );
}

