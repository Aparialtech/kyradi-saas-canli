import { useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  AlertCircle, 
  MapPin, 
  DollarSign, 
  ArrowLeft, 
  Loader2,
  Save,
  Settings,
  Info
} from "../../../lib/lucide";
import { pricingService, type PricingRuleCreate, type PricingScope } from "../../../services/partner/pricing";
import { locationService, type Location } from "../../../services/partner/locations";
import { storageService, type Storage } from "../../../services/partner/storages";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { useToast } from "../../../hooks/useToast";
import { useTranslation } from "../../../hooks/useTranslation";
import { getErrorMessage } from "../../../lib/httpError";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { ModernInput } from "../../../components/ui/ModernInput";

export function PricingEditPage() {
  const { t } = useTranslation();
  const { messages, push } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  // Fetch existing rule if editing
  const ruleQuery = useQuery({
    queryKey: ["pricing", id],
    queryFn: async () => {
      const rules = await pricingService.list();
      return rules.find((r) => r.id === id) || null;
    },
    enabled: isEditing,
  });

  // Fetch locations for dropdown
  const locationsQuery = useQuery<Location[]>({
    queryKey: ["locations"],
    queryFn: () => locationService.list(),
  });

  // Fetch storages for dropdown
  const storagesQuery = useQuery<Storage[]>({
    queryKey: ["storages"],
    queryFn: () => storageService.list(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: PricingRuleCreate) => pricingService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pricing"] });
      push({ title: t("pricing.toast.createSuccess"), type: "success" });
      navigate("/app/pricing");
    },
    onError: (error: unknown) => {
      push({ title: t("pricing.toast.createError"), description: getErrorMessage(error), type: "error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<PricingRuleCreate> }) =>
      pricingService.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pricing"] });
      push({ title: t("pricing.toast.updateSuccess"), type: "success" });
      navigate("/app/pricing");
    },
    onError: (error: unknown) => {
      push({ title: t("pricing.toast.updateError"), description: getErrorMessage(error), type: "error" });
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
  } = useForm<PricingRuleCreate>({
    defaultValues: {
      scope: "TENANT",
      location_id: null,
      storage_id: null,
      name: null,
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

  // Populate form when editing
  useEffect(() => {
    if (ruleQuery.data) {
      reset({
        scope: ruleQuery.data.scope || "TENANT",
        location_id: ruleQuery.data.location_id || null,
        storage_id: ruleQuery.data.storage_id || null,
        name: ruleQuery.data.name || null,
        pricing_type: ruleQuery.data.pricing_type,
        price_per_hour_minor: ruleQuery.data.price_per_hour_minor,
        price_per_day_minor: ruleQuery.data.price_per_day_minor,
        price_per_week_minor: ruleQuery.data.price_per_week_minor,
        price_per_month_minor: ruleQuery.data.price_per_month_minor,
        minimum_charge_minor: ruleQuery.data.minimum_charge_minor,
        currency: ruleQuery.data.currency,
        is_active: ruleQuery.data.is_active,
        priority: ruleQuery.data.priority,
        notes: ruleQuery.data.notes || null,
      });
    }
  }, [ruleQuery.data, reset]);

  const watchedValues = watch();
  const selectedScope = watchedValues.scope;
  const selectedLocationId = watchedValues.location_id;

  // Filter storages by selected location
  const filteredStorages = useMemo(() => {
    if (!storagesQuery.data || !selectedLocationId) return [];
    return storagesQuery.data.filter((s) => s.location_id === selectedLocationId);
  }, [storagesQuery.data, selectedLocationId]);

  const handleScopeChange = (newScope: PricingScope) => {
    setValue("scope", newScope);
    if (newScope !== "LOCATION" && newScope !== "STORAGE") {
      setValue("location_id", null);
      setValue("storage_id", null);
    }
    if (newScope !== "STORAGE") {
      setValue("storage_id", null);
    }
  };

  const formatPrice = (minor: number) => {
    return (minor / 100).toFixed(2) + " ₺";
  };

  const onSubmit = async () => {
    const payload: PricingRuleCreate = {
      ...watchedValues,
      location_id: watchedValues.scope === "LOCATION" ? watchedValues.location_id : null,
      storage_id: watchedValues.scope === "STORAGE" ? watchedValues.storage_id : null,
    };

    if (isEditing && id) {
      await updateMutation.mutateAsync({ id, payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  if (isEditing && ruleQuery.isLoading) {
    return (
      <div style={{ padding: "var(--space-8)", display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
        <Loader2 style={{ width: "48px", height: "48px", color: "var(--primary)", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (isEditing && ruleQuery.isError) {
    return (
      <div style={{ padding: "var(--space-8)", textAlign: "center" }}>
        <AlertCircle style={{ width: "48px", height: "48px", color: "var(--danger-500)", margin: "0 auto var(--space-4) auto" }} />
        <h2>Kural yüklenemedi</h2>
        <ModernButton variant="primary" onClick={() => navigate("/app/pricing")}>
          Geri Dön
        </ModernButton>
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--space-6)", maxWidth: "900px", margin: "0 auto" }}>
      <ToastContainer messages={messages} />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: "var(--space-6)" }}
      >
        <ModernButton
          variant="ghost"
          onClick={() => navigate("/app/pricing")}
          leftIcon={<ArrowLeft style={{ width: "16px", height: "16px" }} />}
          style={{ marginBottom: "var(--space-4)" }}
        >
          Ücretlendirme Kurallarına Dön
        </ModernButton>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div style={{
            width: "56px",
            height: "56px",
            borderRadius: "var(--radius-xl)",
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <DollarSign style={{ width: "28px", height: "28px", color: "white" }} />
          </div>
          <div>
            <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-black)", color: "var(--text-primary)", margin: 0 }}>
              {isEditing ? "Kuralı Düzenle" : "Yeni Ücretlendirme Kuralı"}
            </h1>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: "var(--space-1) 0 0" }}>
              {isEditing ? "Mevcut ücretlendirme kuralını güncelleyin" : "Yeni bir ücretlendirme kuralı tanımlayın"}
            </p>
          </div>
        </div>
      </motion.div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Scope Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <ModernCard variant="elevated" padding="lg" style={{ marginBottom: "var(--space-4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "var(--radius-lg)",
                background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <MapPin style={{ width: "20px", height: "20px", color: "white" }} />
              </div>
              <div>
                <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600, margin: 0 }}>{t("pricing.form.scopeSection")}</h3>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: 0 }}>Kuralın geçerli olacağı kapsamı belirleyin</p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "var(--space-4)" }}>
              <div>
                <label style={{ display: "block", marginBottom: "var(--space-2)", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>
                  {t("pricing.form.scope")} <span style={{ color: "var(--danger-500)" }}>*</span>
                </label>
                <select
                  value={selectedScope}
                  onChange={(e) => handleScopeChange(e.target.value as PricingScope)}
                  style={{
                    width: "100%",
                    padding: "var(--space-3)",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border-primary)",
                    background: "var(--bg-tertiary)",
                    color: "var(--text-primary)",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  <option value="TENANT">{t("pricing.scope.tenant")}</option>
                  <option value="LOCATION">{t("pricing.scope.location")}</option>
                  <option value="STORAGE">{t("pricing.scope.storage")}</option>
                </select>
              </div>

              {(selectedScope === "LOCATION" || selectedScope === "STORAGE") && (
                <div>
                  <label style={{ display: "block", marginBottom: "var(--space-2)", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>
                    {t("pricing.form.location")} <span style={{ color: "var(--danger-500)" }}>*</span>
                  </label>
                  <select
                    {...register("location_id", { required: true })}
                    style={{
                      width: "100%",
                      padding: "var(--space-3)",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border-primary)",
                      background: "var(--bg-tertiary)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    <option value="">{t("pricing.form.selectLocation")}</option>
                    {(Array.isArray(locationsQuery.data) ? locationsQuery.data : []).map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedScope === "STORAGE" && selectedLocationId && (
                <div>
                  <label style={{ display: "block", marginBottom: "var(--space-2)", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>
                    {t("pricing.form.storage")} <span style={{ color: "var(--danger-500)" }}>*</span>
                  </label>
                  <select
                    {...register("storage_id", { required: true })}
                    style={{
                      width: "100%",
                      padding: "var(--space-3)",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border-primary)",
                      background: "var(--bg-tertiary)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    <option value="">{t("pricing.form.selectStorage")}</option>
                    {filteredStorages.map((storage) => (
                      <option key={storage.id} value={storage.id}>{storage.code}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <ModernInput
                  label={t("pricing.form.name")}
                  {...register("name")}
                  placeholder={t("pricing.form.namePlaceholder")}
                  fullWidth
                />
              </div>
            </div>
          </ModernCard>
        </motion.div>

        {/* Basic Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <ModernCard variant="elevated" padding="lg" style={{ marginBottom: "var(--space-4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "var(--radius-lg)",
                background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Settings style={{ width: "20px", height: "20px", color: "white" }} />
              </div>
              <div>
                <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600, margin: 0 }}>{t("pricing.form.basicSection")}</h3>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: 0 }}>Temel ayarları yapılandırın</p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-4)" }}>
              <div>
                <label style={{ display: "block", marginBottom: "var(--space-2)", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>
                  {t("pricing.form.pricingType")} <span style={{ color: "var(--danger-500)" }}>*</span>
                </label>
                <select
                  {...register("pricing_type", { required: true })}
                  style={{
                    width: "100%",
                    padding: "var(--space-3)",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border-primary)",
                    background: "var(--bg-tertiary)",
                    color: "var(--text-primary)",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  <option value="hourly">{t("pricing.type.hourly")}</option>
                  <option value="daily">{t("pricing.type.daily")}</option>
                  <option value="weekly">{t("pricing.type.weekly")}</option>
                  <option value="monthly">{t("pricing.type.monthly")}</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "var(--space-2)", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>
                  {t("pricing.form.currency")}
                </label>
                <select
                  {...register("currency")}
                  style={{
                    width: "100%",
                    padding: "var(--space-3)",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border-primary)",
                    background: "var(--bg-tertiary)",
                    color: "var(--text-primary)",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  <option value="TRY">TRY (₺)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "var(--space-2)", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>
                  {t("pricing.form.priority")}
                </label>
                <input
                  type="number"
                  {...register("priority", { valueAsNumber: true })}
                  placeholder="0"
                  style={{
                    width: "100%",
                    padding: "var(--space-3)",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border-primary)",
                    background: "var(--bg-tertiary)",
                    color: "var(--text-primary)",
                    fontSize: "var(--text-sm)",
                  }}
                />
                <small style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: "var(--space-1)", display: "block" }}>
                  Yüksek öncelik daha önce uygulanır
                </small>
              </div>
            </div>
          </ModernCard>
        </motion.div>

        {/* Pricing */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <ModernCard variant="elevated" padding="lg" style={{ marginBottom: "var(--space-4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "var(--radius-lg)",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <DollarSign style={{ width: "20px", height: "20px", color: "white" }} />
              </div>
              <div>
                <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600, margin: 0 }}>{t("pricing.form.pricesSection")}</h3>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: 0 }}>Ücretleri kuruş cinsinden girin (100 kuruş = 1 TL)</p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-4)" }}>
              {[
                { key: "price_per_hour_minor", label: t("pricing.form.hourlyPrice"), placeholder: "1500" },
                { key: "price_per_day_minor", label: t("pricing.form.dailyPrice"), placeholder: "15000" },
                { key: "price_per_week_minor", label: t("pricing.form.weeklyPrice"), placeholder: "90000" },
                { key: "price_per_month_minor", label: t("pricing.form.monthlyPrice"), placeholder: "300000" },
              ].map((field) => (
                <div key={field.key}>
                  <label style={{ display: "block", marginBottom: "var(--space-2)", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>
                    {field.label}
                  </label>
                  <input
                    type="number"
                    {...register(field.key as keyof PricingRuleCreate, { valueAsNumber: true, min: 0 })}
                    placeholder={field.placeholder}
                    style={{
                      width: "100%",
                      padding: "var(--space-3)",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border-primary)",
                      background: "var(--bg-tertiary)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-sm)",
                    }}
                  />
                  <div style={{
                    marginTop: "var(--space-2)",
                    padding: "var(--space-2)",
                    background: "var(--bg-secondary)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "var(--text-sm)",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    textAlign: "center",
                  }}>
                    = {formatPrice(watchedValues[field.key as keyof PricingRuleCreate] as number || 0)}
                  </div>
                </div>
              ))}

              <div>
                <label style={{ display: "block", marginBottom: "var(--space-2)", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>
                  {t("pricing.form.minimumCharge")} <span style={{ color: "var(--danger-500)" }}>*</span>
                </label>
                <input
                  type="number"
                  {...register("minimum_charge_minor", { valueAsNumber: true, min: 0 })}
                  placeholder="1500"
                  style={{
                    width: "100%",
                    padding: "var(--space-3)",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border-primary)",
                    background: "var(--bg-tertiary)",
                    color: "var(--text-primary)",
                    fontSize: "var(--text-sm)",
                  }}
                />
                <div style={{
                  marginTop: "var(--space-2)",
                  padding: "var(--space-2)",
                  background: "rgba(239, 68, 68, 0.1)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "var(--text-sm)",
                  fontWeight: 600,
                  color: "#dc2626",
                  textAlign: "center",
                }}>
                  Min: {formatPrice(watchedValues.minimum_charge_minor || 0)}
                </div>
              </div>
            </div>
          </ModernCard>
        </motion.div>

        {/* Options */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <ModernCard variant="elevated" padding="lg" style={{ marginBottom: "var(--space-6)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "var(--radius-lg)",
                background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Info style={{ width: "20px", height: "20px", color: "white" }} />
              </div>
              <div>
                <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600, margin: 0 }}>{t("pricing.form.optionsSection")}</h3>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: 0 }}>Ek seçenekleri yapılandırın</p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "var(--space-4)" }}>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "var(--space-3)", 
                padding: "var(--space-4)", 
                background: "var(--bg-secondary)", 
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-primary)"
              }}>
                <input
                  type="checkbox"
                  {...register("is_active")}
                  id="is_active"
                  style={{ width: "20px", height: "20px", cursor: "pointer", accentColor: "var(--primary)" }}
                />
                <label htmlFor="is_active" style={{ margin: 0, cursor: "pointer", fontWeight: 500 }}>
                  {t("pricing.form.isActive")}
                </label>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", marginBottom: "var(--space-2)", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>
                  {t("pricing.form.notes")}
                </label>
                <textarea
                  {...register("notes")}
                  rows={3}
                  placeholder={t("pricing.form.notesPlaceholder")}
                  style={{
                    width: "100%",
                    padding: "var(--space-3)",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border-primary)",
                    background: "var(--bg-tertiary)",
                    color: "var(--text-primary)",
                    fontSize: "var(--text-sm)",
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </div>
            </div>
          </ModernCard>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}
        >
          <ModernButton
            type="button"
            variant="ghost"
            onClick={() => navigate("/app/pricing")}
            disabled={isLoading}
          >
            {t("common.cancel")}
          </ModernButton>
          <ModernButton
            type="submit"
            variant="primary"
            disabled={isLoading}
            isLoading={isLoading}
            leftIcon={!isLoading && <Save style={{ width: "16px", height: "16px" }} />}
          >
            {isEditing ? t("common.update") : t("common.save")}
          </ModernButton>
        </motion.div>
      </form>
    </div>
  );
}
