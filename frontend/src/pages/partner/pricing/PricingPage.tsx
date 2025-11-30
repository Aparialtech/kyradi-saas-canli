import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pricingService, type PricingRule, type PricingRuleCreate } from "../../../services/partner/pricing";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { useToast } from "../../../hooks/useToast";
import { getErrorMessage } from "../../../lib/httpError";

export function PricingPage() {
  const { messages, push } = useToast();
  const queryClient = useQueryClient();
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [showForm, setShowForm] = useState(false);

  const pricingQuery = useQuery({
    queryKey: ["pricing"],
    queryFn: () => pricingService.list(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: PricingRuleCreate) => pricingService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pricing"] });
      push({ title: "Ücretlendirme kuralı eklendi", type: "success" });
      reset();
      setShowForm(false);
      setEditingRule(null);
    },
    onError: (error: unknown) => {
      push({ title: "Kayıt başarısız", description: getErrorMessage(error), type: "error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<PricingRuleCreate> }) =>
      pricingService.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pricing"] });
      push({ title: "Ücretlendirme kuralı güncellendi", type: "success" });
      setEditingRule(null);
      setShowForm(false);
      reset();
    },
    onError: (error: unknown) => {
      push({ title: "Güncelleme başarısız", description: getErrorMessage(error), type: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pricingService.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pricing"] });
      push({ title: "Ücretlendirme kuralı silindi", type: "info" });
    },
    onError: (error: unknown) => {
      push({ title: "Silme işlemi başarısız", description: getErrorMessage(error), type: "error" });
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PricingRuleCreate>({
    defaultValues: {
      pricing_type: "daily",
      price_per_hour_minor: 1500,
      price_per_day_minor: 15000,
      price_per_week_minor: 90000,
      price_per_month_minor: 300000,
      minimum_charge_minor: 1500,
      currency: "TRY",
      is_active: true,
      priority: 0,
      notes: null,
    },
  });

  const watchedValues = watch();

  const submit = handleSubmit(async (values) => {
    if (editingRule) {
      await updateMutation.mutateAsync({ id: editingRule.id, payload: values });
    } else {
      await createMutation.mutateAsync(values);
    }
  });

  const formatPrice = (minor: number) => {
    return (minor / 100).toFixed(2) + " ₺";
  };

  const handleNewRule = () => {
    setEditingRule(null);
    setShowForm(true);
    reset({
      pricing_type: "daily",
      price_per_hour_minor: 1500,
      price_per_day_minor: 15000,
      price_per_week_minor: 90000,
      price_per_month_minor: 300000,
      minimum_charge_minor: 1500,
      currency: "TRY",
      is_active: true,
      priority: 0,
      notes: null,
    });
  };

  const handleEditRule = (rule: PricingRule) => {
    setEditingRule(rule);
    setShowForm(true);
    reset({
      pricing_type: rule.pricing_type,
      price_per_hour_minor: rule.price_per_hour_minor,
      price_per_day_minor: rule.price_per_day_minor,
      price_per_week_minor: rule.price_per_week_minor,
      price_per_month_minor: rule.price_per_month_minor,
      minimum_charge_minor: rule.minimum_charge_minor,
      currency: rule.currency,
      is_active: rule.is_active,
      priority: rule.priority,
      notes: rule.notes || null,
    });
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingRule(null);
    reset();
  };

  return (
    <section className="page">
      <ToastContainer messages={messages} />
      <header className="page-header">
        <div>
          <h1 className="page-title">Ücretlendirme Yönetimi</h1>
          <p className="page-subtitle">Depo rezervasyonları için ücretlendirme kurallarını yönetin</p>
        </div>
        {!showForm && (
          <button type="button" className="btn btn--primary" onClick={handleNewRule}>
            + Yeni Ücretlendirme Kuralı
          </button>
        )}
      </header>

      {/* Pricing Rules List */}
      {!showForm && (
        <>
          {pricingQuery.isLoading ? (
            <div className="panel">
              <div className="empty-state">Yükleniyor...</div>
            </div>
          ) : pricingQuery.isError ? (
            <div className="panel">
              <div className="empty-state" style={{ color: "#dc2626" }}>
                Ücretlendirme kuralları yüklenemedi: {getErrorMessage(pricingQuery.error)}
              </div>
            </div>
          ) : pricingQuery.data && pricingQuery.data.length > 0 ? (
            <div className="panel">
              <div className="panel__header">
                <h2 className="panel__title">Ücretlendirme Kuralları</h2>
                <p className="panel__subtitle">{pricingQuery.data.length} aktif kural</p>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tip</th>
                      <th>Saatlik</th>
                      <th>Günlük</th>
                      <th>Haftalık</th>
                      <th>Aylık</th>
                      <th>Minimum</th>
                      <th>Para Birimi</th>
                      <th>Öncelik</th>
                      <th>Durum</th>
                      <th style={{ textAlign: "right" }}>İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricingQuery.data.map((rule) => (
                      <tr key={rule.id}>
                        <td>
                          <span
                            style={{
                              padding: "0.25rem 0.75rem",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              textTransform: "capitalize",
                              backgroundColor: "#e0f2fe",
                              color: "#0c4a6e",
                            }}
                          >
                            {rule.pricing_type === "hourly" && "⏱️ Saatlik"}
                            {rule.pricing_type === "daily" && "📅 Günlük"}
                            {rule.pricing_type === "weekly" && "📆 Haftalık"}
                            {rule.pricing_type === "monthly" && "🗓️ Aylık"}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 500 }}>{formatPrice(rule.price_per_hour_minor)}</span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 500 }}>{formatPrice(rule.price_per_day_minor)}</span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 500 }}>{formatPrice(rule.price_per_week_minor)}</span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 500 }}>{formatPrice(rule.price_per_month_minor)}</span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 500, color: "#dc2626" }}>
                            {formatPrice(rule.minimum_charge_minor)}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 500 }}>{rule.currency}</span>
                        </td>
                        <td>
                          <span
                            style={{
                              padding: "0.25rem 0.5rem",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              backgroundColor: rule.priority > 0 ? "#fef3c7" : "#f1f5f9",
                              color: rule.priority > 0 ? "#92400e" : "#64748b",
                              fontWeight: 600,
                            }}
                          >
                            {rule.priority}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              padding: "0.25rem 0.75rem",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              background: rule.is_active ? "#dcfce7" : "#fee2e2",
                              color: rule.is_active ? "#166534" : "#991b1b",
                            }}
                          >
                            {rule.is_active ? "✓ Aktif" : "✗ Pasif"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              className="btn btn--link"
                              onClick={() => handleEditRule(rule)}
                              style={{ padding: "0.25rem 0.5rem" }}
                            >
                              Düzenle
                            </button>
                            <button
                              type="button"
                              className="btn btn--link btn--danger"
                              onClick={() => {
                                if (confirm("Bu ücretlendirme kuralını silmek istediğinize emin misiniz?")) {
                                  deleteMutation.mutate(rule.id);
                                }
                              }}
                              style={{ padding: "0.25rem 0.5rem" }}
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
            </div>
          ) : (
            <div className="panel">
              <div className="empty-state">
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>💰</div>
                <p style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Henüz ücretlendirme kuralı bulunmuyor
                </p>
                <p style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: "1.5rem" }}>
                  Depo rezervasyonları için ücretlendirme kuralları oluşturun.
                </p>
                <button type="button" className="btn btn--primary" onClick={handleNewRule}>
                  İlk Kuralı Oluştur
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Form Panel */}
      {showForm && (
        <div className="panel" style={{ marginBottom: "2rem" }}>
          <div className="panel__header">
            <div>
              <h2 className="panel__title">
                {editingRule ? "Ücretlendirme Kuralını Düzenle" : "Yeni Ücretlendirme Kuralı"}
              </h2>
              <p className="panel__subtitle">
                {editingRule
                  ? "Mevcut kuralı güncelleyin"
                  : "Depo rezervasyonları için yeni bir ücretlendirme kuralı oluşturun"}
              </p>
            </div>
            <button type="button" className="btn btn--outline" onClick={handleCancel}>
              ✕ Kapat
            </button>
          </div>

          <form onSubmit={submit}>
            {/* Basic Info Section */}
            <div style={{ marginBottom: "2rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem", color: "#0f172a" }}>
                Temel Bilgiler
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                <div>
                  <label className="form-label">
                    Ücretlendirme Tipi <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <select
                    {...register("pricing_type", { required: "Ücretlendirme tipi zorunlu" })}
                    className="form-input"
                    style={{ fontSize: "0.95rem" }}
                  >
                    <option value="hourly">⏱️ Saatlik</option>
                    <option value="daily">📅 Günlük</option>
                    <option value="weekly">📆 Haftalık</option>
                    <option value="monthly">🗓️ Aylık</option>
                  </select>
                  {errors.pricing_type && (
                    <span style={{ color: "#dc2626", fontSize: "0.75rem", marginTop: "0.25rem", display: "block" }}>
                      {errors.pricing_type.message}
                    </span>
                  )}
                </div>

                <div>
                  <label className="form-label">Para Birimi</label>
                  <select {...register("currency")} className="form-input" style={{ fontSize: "0.95rem" }}>
                    <option value="TRY">TRY (₺)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Öncelik</label>
                  <input
                    type="number"
                    {...register("priority", { valueAsNumber: true })}
                    className="form-input"
                    placeholder="0"
                    style={{ fontSize: "0.95rem" }}
                  />
                  <small style={{ color: "#64748b", fontSize: "0.75rem", display: "block", marginTop: "0.25rem" }}>
                    Yüksek öncelikli kurallar önce uygulanır (0 = en düşük)
                  </small>
                </div>
              </div>
            </div>

            {/* Pricing Section */}
            <div style={{ marginBottom: "2rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem", color: "#0f172a" }}>
                Ücret Bilgileri (Kuruş cinsinden)
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem" }}>
                <div>
                  <label className="form-label">Saatlik Ücret</label>
                  <input
                    type="number"
                    {...register("price_per_hour_minor", { valueAsNumber: true, min: 0 })}
                    className="form-input"
                    placeholder="1500"
                    style={{ fontSize: "0.95rem" }}
                  />
                  <div
                    style={{
                      marginTop: "0.5rem",
                      padding: "0.5rem",
                      background: "#f1f5f9",
                      borderRadius: "4px",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "#0f172a",
                    }}
                  >
                    = {formatPrice(watchedValues.price_per_hour_minor || 1500)}
                  </div>
                </div>

                <div>
                  <label className="form-label">Günlük Ücret</label>
                  <input
                    type="number"
                    {...register("price_per_day_minor", { valueAsNumber: true, min: 0 })}
                    className="form-input"
                    placeholder="15000"
                    style={{ fontSize: "0.95rem" }}
                  />
                  <div
                    style={{
                      marginTop: "0.5rem",
                      padding: "0.5rem",
                      background: "#f1f5f9",
                      borderRadius: "4px",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "#0f172a",
                    }}
                  >
                    = {formatPrice(watchedValues.price_per_day_minor || 15000)}
                  </div>
                </div>

                <div>
                  <label className="form-label">Haftalık Ücret</label>
                  <input
                    type="number"
                    {...register("price_per_week_minor", { valueAsNumber: true, min: 0 })}
                    className="form-input"
                    placeholder="90000"
                    style={{ fontSize: "0.95rem" }}
                  />
                  <div
                    style={{
                      marginTop: "0.5rem",
                      padding: "0.5rem",
                      background: "#f1f5f9",
                      borderRadius: "4px",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "#0f172a",
                    }}
                  >
                    = {formatPrice(watchedValues.price_per_week_minor || 90000)}
                  </div>
                </div>

                <div>
                  <label className="form-label">Aylık Ücret</label>
                  <input
                    type="number"
                    {...register("price_per_month_minor", { valueAsNumber: true, min: 0 })}
                    className="form-input"
                    placeholder="300000"
                    style={{ fontSize: "0.95rem" }}
                  />
                  <div
                    style={{
                      marginTop: "0.5rem",
                      padding: "0.5rem",
                      background: "#f1f5f9",
                      borderRadius: "4px",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "#0f172a",
                    }}
                  >
                    = {formatPrice(watchedValues.price_per_month_minor || 300000)}
                  </div>
                </div>

                <div>
                  <label className="form-label">
                    Minimum Ücret <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    type="number"
                    {...register("minimum_charge_minor", { valueAsNumber: true, min: 0 })}
                    className="form-input"
                    placeholder="1500"
                    style={{ fontSize: "0.95rem" }}
                  />
                  <div
                    style={{
                      marginTop: "0.5rem",
                      padding: "0.5rem",
                      background: "#fee2e2",
                      borderRadius: "4px",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "#991b1b",
                    }}
                  >
                    Min: {formatPrice(watchedValues.minimum_charge_minor || 1500)}
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Options */}
            <div style={{ marginBottom: "2rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem", color: "#0f172a" }}>
                Ek Seçenekler
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "1rem", background: "#f8fafc", borderRadius: "8px" }}>
                  <input
                    type="checkbox"
                    {...register("is_active")}
                    id="is_active"
                    style={{ width: "20px", height: "20px", cursor: "pointer" }}
                  />
                  <label htmlFor="is_active" style={{ margin: 0, cursor: "pointer", fontWeight: 500 }}>
                    Bu kuralı aktif et
                  </label>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label">Notlar (Opsiyonel)</label>
                  <textarea
                    {...register("notes")}
                    className="form-input"
                    rows={3}
                    placeholder="Bu kural hakkında notlar, açıklamalar..."
                    style={{ fontSize: "0.95rem", resize: "vertical" }}
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                justifyContent: "flex-end",
                paddingTop: "1.5rem",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <button type="button" className="btn btn--outline" onClick={handleCancel} disabled={createMutation.isPending || updateMutation.isPending}>
                İptal
              </button>
              <button type="submit" className="btn btn--primary" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending
                  ? "Kaydediliyor..."
                  : editingRule
                    ? "✓ Güncelle"
                    : "✓ Kaydet"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
