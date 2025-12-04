import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";

import { locationService, type Location, type LocationPayload } from "../../../services/partner/locations";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { getErrorMessage } from "../../../lib/httpError";
import { useTranslation } from "../../../hooks/useTranslation";

// New Premium UI Components
import { Card, CardHeader, CardBody } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Table, type Column } from "../../../components/ui/Table";

const schema = z.object({
  name: z.string().min(2, "Ad en az 2 karakter olmalı"),
  address: z.string().optional(),
  lat: z.string().optional(),
  lon: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function LocationsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { messages, push } = useToast();
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["locations"],
    queryFn: locationService.list,
  });

  const createMutation = useMutation({
    mutationFn: (payload: LocationPayload) => locationService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["locations"] });
      push({ title: "Lokasyon eklendi", type: "success" });
      reset({ name: "", address: "", lat: "", lon: "" });
      setEditingLocation(null);
    },
    onError: (error: unknown) => {
      push({ title: "Lokasyon eklenemedi", description: getErrorMessage(error), type: "error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<LocationPayload> }) =>
      locationService.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["locations"] });
      push({ title: "Lokasyon güncellendi", type: "success" });
      reset({ name: "", address: "", lat: "", lon: "" });
      setEditingLocation(null);
    },
    onError: (error: unknown) => {
      push({ title: "Güncelleme başarısız", description: getErrorMessage(error), type: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => locationService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["locations"] });
      push({ title: "Lokasyon silindi", type: "info" });
    },
    onError: (error: unknown) => {
      push({ title: "Silme işlemi başarısız", description: getErrorMessage(error), type: "error" });
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
      lat: "",
      lon: "",
    },
  });

  const submit = handleSubmit(async (values) => {
    const payload: LocationPayload = {
      name: values.name,
      address: values.address?.trim() ? values.address.trim() : undefined,
      lat: values.lat ? Number(values.lat) : undefined,
      lon: values.lon ? Number(values.lon) : undefined,
    };

    if (editingLocation) {
      await updateMutation.mutateAsync({ id: editingLocation.id, payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
  });

  const handleNew = () => {
    setEditingLocation(null);
    reset({ name: "", address: "", lat: "", lon: "" });
  };

  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    reset({
      name: location.name,
      address: location.address ?? "",
      lat: location.lat != null ? String(location.lat) : "",
      lon: location.lon != null ? String(location.lon) : "",
    });
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (location: Location) => {
    if (confirm(`${location.name} lokasyonu silinecek. Bu lokasyona bağlı tüm depolar da etkilenebilir. Emin misiniz?`)) {
      deleteMutation.mutate(location.id);
    }
  };

  // Table columns
  const columns: Column<Location>[] = [
    {
      key: 'name',
      label: 'Lokasyon',
      render: (value) => (
        <strong style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{value}</strong>
      ),
    },
    {
      key: 'address',
      label: 'Adres',
      render: (value) => value || <span style={{ color: 'var(--color-text-muted)' }}>-</span>,
    },
    {
      key: 'lat',
      label: 'Koordinat',
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
      label: 'İşlemler',
      align: 'right',
      render: (_, location) => (
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEdit(location)}
          >
            Düzenle
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(location)}
            style={{ color: 'var(--color-danger)' }}
          >
            Sil
          </Button>
        </div>
      ),
    },
  ];

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
            Lokasyon yönetimi: Yeni lokasyon ekleyin, mevcut lokasyonları düzenleyin veya silin.
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={handleNew}>
          + Yeni Lokasyon
        </Button>
      </motion.div>

      {/* Form Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <Card variant="elevated" padding="none" style={{ marginBottom: 'var(--space-6)' }}>
          <CardHeader
            title={editingLocation ? "Lokasyon Düzenle" : "Yeni Lokasyon Ekle"}
            description="Lokasyon bilgilerini doldurun ve kaydedin."
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
                    label="Lokasyon Adı"
                    placeholder="Örn: Taksim Şube"
                    required
                    error={errors.name?.message}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <Input
                    {...register("address")}
                    label="Adres"
                    placeholder="Tam adres bilgisi"
                    helperText="Opsiyonel: Lokasyonun tam adresi"
                  />
                </div>

                <Input
                  {...register("lat")}
                  label="Enlem (Latitude)"
                  type="number"
                  inputSize="md"
                  placeholder="41.0082"
                  helperText="Opsiyonel: Harita konumu için"
                />

                <Input
                  {...register("lon")}
                  label="Boylam (Longitude)"
                  type="number"
                  inputSize="md"
                  placeholder="28.9784"
                  helperText="Opsiyonel: Harita konumu için"
                />
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                {editingLocation && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleNew}
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    İptal
                  </Button>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={createMutation.isPending || updateMutation.isPending}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingLocation ? "Güncelle" : "Kaydet"}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </motion.div>

      {/* Table Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <Card variant="elevated" padding="none">
          <CardHeader
            title="Lokasyon Listesi"
            description={`${data?.length ?? 0} lokasyon kayıtlı`}
          />
          <CardBody noPadding>
            {isError ? (
              <div style={{ 
                padding: 'var(--space-12)',
                textAlign: 'center',
                color: 'var(--color-text-muted)'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>⚠️</div>
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

