import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { locationService, type Location, type LocationPayload } from "../../../services/partner/locations";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { getErrorMessage } from "../../../lib/httpError";
import { useTranslation } from "../../../hooks/useTranslation";

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
  };

  const handleDelete = (location: Location) => {
    if (confirm(`${location.name} lokasyonu silinecek. Bu lokasyona bağlı tüm depolar da etkilenebilir. Emin misiniz?`)) {
      deleteMutation.mutate(location.id);
    }
  };

  return (
    <section className="page">
      <ToastContainer messages={messages} />
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("nav.locations")}</h1>
          <p className="page-subtitle">
            Lokasyon yönetimi: Yeni lokasyon ekleyin, mevcut lokasyonları düzenleyin veya silin.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn--primary" onClick={handleNew}>
            Yeni Lokasyon
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <div>
            <h2 className="panel__title">
              {editingLocation ? "Lokasyon Düzenle" : "Yeni Lokasyon Ekle"}
            </h2>
            <p className="panel__subtitle">
              Lokasyon bilgilerini doldurun ve kaydedin.
            </p>
          </div>
        </div>

        <form className="form-grid" onSubmit={submit}>
          <label className="form-field">
            <span className="form-field__label">Lokasyon Adı</span>
            <input
              {...register("name")}
              placeholder="Örn: Taksim Şube"
              required
            />
            {errors.name && <span className="field-error">{errors.name.message}</span>}
          </label>

          <label className="form-field form-grid__field--full">
            <span className="form-field__label">Adres</span>
            <input
              {...register("address")}
              placeholder="Tam adres bilgisi"
            />
            <small className="form-field__hint">
              Opsiyonel: Lokasyonun tam adresi
            </small>
          </label>

          <label className="form-field">
            <span className="form-field__label">Enlem (Latitude)</span>
            <input
              {...register("lat")}
              type="number"
              step="any"
              placeholder="41.0082"
            />
            <small className="form-field__hint">
              Opsiyonel: Harita konumu için
            </small>
          </label>

          <label className="form-field">
            <span className="form-field__label">Boylam (Longitude)</span>
            <input
              {...register("lon")}
              type="number"
              step="any"
              placeholder="28.9784"
            />
            <small className="form-field__hint">
              Opsiyonel: Harita konumu için
            </small>
          </label>

          <div className="form-actions form-grid__field--full">
            {editingLocation && (
              <button
                type="button"
                className="btn btn--ghost-dark"
                onClick={handleNew}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                İptal
              </button>
            )}
            <button
              type="submit"
              className="btn btn--primary"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingLocation
                ? updateMutation.isPending
                  ? "Güncelleniyor..."
                  : "Güncelle"
                : createMutation.isPending
                  ? "Kaydediliyor..."
                  : "Kaydet"}
            </button>
          </div>
        </form>
      </div>

      <div className="panel">
        <div className="panel__header">
          <div>
            <h2 className="panel__title">Lokasyon Listesi</h2>
            <p className="panel__subtitle">
              {data?.length ?? 0} lokasyon kayıtlı
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="empty-state">
            <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>⏳</div>
            <h3 className="empty-state__title">Lokasyonlar yükleniyor</h3>
            <p>Lütfen bekleyin...</p>
          </div>
        ) : isError ? (
          <div className="empty-state">
            <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
            <h3 className="empty-state__title">Lokasyonlar alınamadı</h3>
            <p>Sayfayı yenileyerek tekrar deneyin.</p>
          </div>
        ) : data && data.length > 0 ? (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lokasyon</th>
                  <th>Adres</th>
                  <th>Koordinat</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {data.map((location) => (
                  <tr key={location.id}>
                    <td>
                      <strong>{location.name}</strong>
                    </td>
                    <td>
                      {location.address ? (
                        <span>{location.address}</span>
                      ) : (
                        <span className="table-cell-muted">-</span>
                      )}
                    </td>
                    <td>
                      {location.lat != null && location.lon != null ? (
                        <span style={{ fontFamily: "monospace", fontSize: "0.875rem" }}>
                          {location.lat.toFixed(4)} / {location.lon.toFixed(4)}
                        </span>
                      ) : (
                        <span className="table-cell-muted">-</span>
                      )}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="action-link"
                          onClick={() => handleEdit(location)}
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          className="action-link action-link--danger"
                          onClick={() => handleDelete(location)}
                        >
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>📍</div>
            <h3 className="empty-state__title">Henüz lokasyon kaydı yok</h3>
            <p>Yukarıdaki formu kullanarak yeni bir lokasyon ekleyebilirsiniz.</p>
          </div>
        )}
      </div>
    </section>
  );
}
