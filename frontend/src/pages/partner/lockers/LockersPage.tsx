import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { storageService, type Storage, type StoragePayload, type StorageStatus } from "../../../services/partner/storages";
import { locationService } from "../../../services/partner/locations";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { getErrorMessage } from "../../../lib/httpError";
import { useTranslation } from "../../../hooks/useTranslation";

const statusLabels: Record<StorageStatus, string> = {
  idle: "Boş",
  occupied: "Dolu",
  faulty: "Arızalı",
};

const statusBadgeClass: Record<StorageStatus, string> = {
  idle: "badge badge--success",
  occupied: "badge badge--warning",
  faulty: "badge badge--danger",
};

export function LockersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { messages, push } = useToast();
  const [editingStorage, setEditingStorage] = useState<Storage | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const locationsQuery = useQuery({ queryKey: ["locations"], queryFn: locationService.list });
  const storagesQuery = useQuery({
    queryKey: ["storages", statusFilter],
    queryFn: () => storageService.list(statusFilter ? (statusFilter as StorageStatus) : undefined),
  });

  const createMutation = useMutation({
    mutationFn: (payload: StoragePayload) => storageService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storages"] });
      void queryClient.invalidateQueries({ queryKey: ["lockers"] });
      push({ title: "Depo eklendi", type: "success" });
      reset({ location_id: "", code: "", status: "idle" });
      setEditingStorage(null);
    },
    onError: (error: unknown) => {
      push({ title: "Kayıt başarısız", description: getErrorMessage(error), type: "error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<StoragePayload> }) => storageService.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storages"] });
      void queryClient.invalidateQueries({ queryKey: ["lockers"] });
      push({ title: "Depo güncellendi", type: "success" });
      reset({ location_id: "", code: "", status: "idle" });
      setEditingStorage(null);
    },
    onError: (error: unknown) => {
      push({ title: "Güncelleme başarısız", description: getErrorMessage(error), type: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => storageService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storages"] });
      void queryClient.invalidateQueries({ queryKey: ["lockers"] });
      push({ title: "Depo silindi", type: "info" });
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

  const submit = handleSubmit(async (values) => {
    if (!values.location_id) {
      push({ title: "Lokasyon seçin", type: "error" });
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
  };

  const handleEdit = (storage: Storage) => {
    setEditingStorage(storage);
    reset({
      location_id: storage.location_id,
      code: storage.code,
      status: storage.status,
    });
  };

  return (
    <section className="page">
      <ToastContainer messages={messages} />
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("nav.storages")}</h1>
          <p className="page-subtitle">
            {t("common.storages")} yönetimi: Yeni depo ekleyin, mevcut depoları düzenleyin veya silin.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn--primary" onClick={handleNew}>
            Yeni {t("common.storage")}
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <div>
            <h2 className="panel__title">
              {editingStorage ? `${t("common.storage")} Düzenle` : `Yeni ${t("common.storage")} Ekle`}
            </h2>
            <p className="panel__subtitle">
              {t("common.storage")} bilgilerini doldurun ve kaydedin.
            </p>
          </div>
        </div>

        <form className="form-grid" onSubmit={submit}>
          <label className="form-field">
            <span className="form-field__label">Lokasyon</span>
            <select
              {...register("location_id", { required: "Lokasyon zorunlu" })}
              disabled={locationsQuery.isLoading}
            >
              <option value="">Seçiniz</option>
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
            <span className="form-field__label">{t("common.storage")} Kodu</span>
            <input
              {...register("code", { required: "Kod zorunlu" })}
              placeholder="LK-001"
            />
            {errors.code && <span className="field-error">{errors.code.message}</span>}
          </label>

          <label className="form-field">
            <span className="form-field__label">Durum</span>
            <select {...register("status")}>
              <option value="idle">Boş</option>
              <option value="occupied">Dolu</option>
              <option value="faulty">Arızalı</option>
            </select>
          </label>

          <div className="form-actions form-grid__field--full">
            {editingStorage && (
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
              {editingStorage
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
            <h2 className="panel__title">{t("common.storages")} Listesi</h2>
            <p className="panel__subtitle">
              {storagesQuery.data?.length ?? 0} {t("common.storage")} kayıtlı
            </p>
          </div>
          <div className="panel__filters">
            <label className="form-field">
              <span className="form-field__label">Durum Filtresi</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">Tümü</option>
                <option value="idle">Boş</option>
                <option value="occupied">Dolu</option>
                <option value="faulty">Arızalı</option>
              </select>
            </label>
          </div>
        </div>

        {storagesQuery.isLoading ? (
          <div className="empty-state">
            <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>⏳</div>
            <h3 className="empty-state__title">{t("common.storages")} yükleniyor</h3>
            <p>Lütfen bekleyin...</p>
          </div>
        ) : storagesQuery.isError ? (
          <div className="empty-state">
            <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
            <h3 className="empty-state__title">{t("common.storages")} alınamadı</h3>
            <p>Sayfayı yenileyerek tekrar deneyin.</p>
          </div>
        ) : storagesQuery.data && storagesQuery.data.length > 0 ? (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("common.storage")} Kodu</th>
                  <th>Lokasyon</th>
                  <th>Durum</th>
                  <th>Son Görülme</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {storagesQuery.data.map((storage) => (
                  <tr key={storage.id}>
                    <td>
                      <strong>{storage.code}</strong>
                    </td>
                    <td>
                      {locationOptions.find((option) => option.value === storage.location_id)?.label ?? storage.location_id}
                    </td>
                    <td>
                      <span className={statusBadgeClass[storage.status]}>
                        {statusLabels[storage.status]}
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
                      <div className="table-actions">
                        <button
                          type="button"
                          className="action-link"
                          onClick={() => handleEdit(storage)}
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          className="action-link action-link--danger"
                          onClick={() => {
                            if (confirm(`${storage.code} kodlu ${t("common.storage")} silinecek. Emin misiniz?`)) {
                              deleteMutation.mutate(storage.id);
                            }
                          }}
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
            <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>📦</div>
            <h3 className="empty-state__title">Henüz {t("common.storage")} kaydı yok</h3>
            <p>Yukarıdaki formu kullanarak yeni bir {t("common.storage")} ekleyebilirsiniz.</p>
          </div>
        )}
      </div>
    </section>
  );
}
