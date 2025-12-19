import { useState, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertCircle, Package, MapPin, DollarSign, Plus, Edit, Trash2, X, Loader2, Search } from "../../../lib/lucide";
import { pricingService, type PricingRule, type PricingRuleCreate, type PricingScope } from "../../../services/partner/pricing";
import { locationService, type Location } from "../../../services/partner/locations";
import { storageService, type Storage } from "../../../services/partner/storages";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { useToast } from "../../../hooks/useToast";
import { useTranslation } from "../../../hooks/useTranslation";
import { getErrorMessage } from "../../../lib/httpError";
import { usePagination, calculatePaginationMeta } from "../../../components/common/Pagination";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { ModernInput } from "../../../components/ui/ModernInput";
import { ModernTable, type ModernTableColumn } from "../../../components/ui/ModernTable";
import { Badge } from "../../../components/ui/Badge";
import { escapeHtml, containsXssPatterns, containsPrototypePollution } from "../../../lib/sanitize";

// Security: Display value with XSS protection and warning badge
function SafeDisplayValue({ value, showWarning = true }: { value: string | null | undefined; showWarning?: boolean }) {
  if (!value) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
  
  const isDangerous = containsXssPatterns(value) || containsPrototypePollution(value);
  const safeValue = escapeHtml(value);
  
  if (isDangerous && showWarning) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
        <span style={{ 
          color: 'var(--danger-500)', 
          fontFamily: 'monospace', 
          fontSize: '0.75rem',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          padding: '2px 6px',
          borderRadius: '4px',
          wordBreak: 'break-all',
        }}>
          {safeValue.length > 30 ? safeValue.slice(0, 30) + '...' : safeValue}
        </span>
        <span style={{
          fontSize: '0.65rem',
          backgroundColor: '#fee2e2',
          color: '#dc2626',
          padding: '2px 6px',
          borderRadius: '4px',
          fontWeight: 600,
        }}>
          ⚠️ Tehlikeli İçerik
        </span>
      </div>
    );
  }
  
  return <span>{safeValue}</span>;
}

export function PricingPage() {
  const { t } = useTranslation();
  const { messages, push } = useToast();
  const queryClient = useQueryClient();
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<PricingScope | "">("");
  const { page, pageSize, setPage, setPageSize } = usePagination(10);

  // Fetch pricing rules
  const pricingQuery = useQuery({
    queryKey: ["pricing"],
    queryFn: () => pricingService.list(),
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
      reset();
      setShowForm(false);
      setEditingRule(null);
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
      setEditingRule(null);
      setShowForm(false);
      reset();
    },
    onError: (error: unknown) => {
      push({ title: t("pricing.toast.updateError"), description: getErrorMessage(error), type: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pricingService.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pricing"] });
      push({ title: t("pricing.toast.deleteSuccess"), type: "info" });
    },
    onError: (error: unknown) => {
      push({ title: t("pricing.toast.deleteError"), description: getErrorMessage(error), type: "error" });
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
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

  const watchedValues = watch();
  const selectedScope = watchedValues.scope;
  const selectedLocationId = watchedValues.location_id;

  // Filter storages by selected location
  const filteredStorages = useMemo(() => {
    if (!storagesQuery.data || !selectedLocationId) return [];
    return storagesQuery.data.filter((s) => s.location_id === selectedLocationId);
  }, [storagesQuery.data, selectedLocationId]);

  // Filter rules based on search and scope filter
  const filteredRules = useMemo(() => {
    if (!pricingQuery.data) return [];
    
    return pricingQuery.data.filter((rule) => {
      // Apply scope filter
      if (scopeFilter && rule.scope !== scopeFilter) return false;
      
      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = rule.name?.toLowerCase().includes(query);
        const matchesLocation = rule.location_name?.toLowerCase().includes(query);
        const matchesStorage = rule.storage_code?.toLowerCase().includes(query);
        const matchesNotes = rule.notes?.toLowerCase().includes(query);
        
        if (!matchesName && !matchesLocation && !matchesStorage && !matchesNotes) {
          return false;
        }
      }
      
      return true;
    });
  }, [pricingQuery.data, scopeFilter, searchQuery]);

  // Paginate filtered data
  const paginatedRules = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredRules.slice(start, end);
  }, [filteredRules, page, pageSize]);

  const paginationMeta = useMemo(() => {
    return calculatePaginationMeta(filteredRules.length, page, pageSize);
  }, [filteredRules.length, page, pageSize]);

  // Reset to page 1 when search changes
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setPage(1);
  }, [setPage]);

  const submit = handleSubmit(async (values) => {
    console.log("[PricingPage] Form submit called", { editingRule: editingRule?.id, values });
    // Clean up payload based on scope
    const payload: PricingRuleCreate = {
      ...values,
      location_id: values.scope === "LOCATION" ? values.location_id : null,
      storage_id: values.scope === "STORAGE" ? values.storage_id : null,
    };

    if (editingRule) {
      await updateMutation.mutateAsync({ id: editingRule.id, payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
  });

  const formatPrice = (minor: number) => {
    return (minor / 100).toFixed(2) + " ₺";
  };

  const getScopeLabel = (scope: PricingScope) => {
    const labels: Record<PricingScope, string> = {
      GLOBAL: t("pricing.scope.global"),
      TENANT: t("pricing.scope.tenant"),
      LOCATION: t("pricing.scope.location"),
      STORAGE: t("pricing.scope.storage"),
    };
    return labels[scope] || scope;
  };


  const getPricingTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      hourly: t("pricing.type.hourly"),
      daily: t("pricing.type.daily"),
      weekly: t("pricing.type.weekly"),
      monthly: t("pricing.type.monthly"),
    };
    return labels[type] || type;
  };

  const handleNewRule = () => {
    setEditingRule(null);
    setShowForm(true);
    reset({
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
    });
  };

  const handleEditRule = (rule: PricingRule) => {
    setEditingRule(rule);
    setShowForm(true);
    reset({
      scope: rule.scope || "TENANT",
      location_id: rule.location_id || null,
      storage_id: rule.storage_id || null,
      name: rule.name || null,
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

  const handleCancel = useCallback((e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    console.log("[PricingPage] handleCancel called");
    setShowForm(false);
    setEditingRule(null);
    reset();
  }, [reset]);

  // Handle scope change - clear location/storage if not needed
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

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: '1600px', margin: '0 auto' }}>
      <ToastContainer messages={messages} />
      
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <DollarSign className="h-8 w-8" style={{ color: 'var(--primary)' }} />
            <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-black)', color: 'var(--text-primary)', margin: 0 }}>
              {t("pricing.title")}
            </h1>
          </div>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', margin: 0 }}>
            {t("pricing.subtitle")}
          </p>
        </div>
        {!showForm && (
          <ModernButton variant="primary" onClick={handleNewRule} leftIcon={<Plus className="h-4 w-4" />}>
            {t("pricing.newRule")}
          </ModernButton>
        )}
      </motion.div>

      {/* Pricing Rules List */}
      {!showForm && (
        <>
          {/* Search and Filter Controls */}
          <ModernCard variant="glass" padding="md" style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: "1 1 300px" }}>
                <ModernInput
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder={t("pricing.searchPlaceholder")}
                  leftIcon={<Search className="h-4 w-4" />}
                  fullWidth
                />
              </div>
              <div style={{ flex: "0 0 200px" }}>
                <select
                  value={scopeFilter}
                  onChange={(e) => setScopeFilter(e.target.value as PricingScope | "")}
                  style={{
                    width: '100%',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-primary)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  <option value="">{t("pricing.filter.allScopes")}</option>
                  <option value="GLOBAL">{t("pricing.scope.global")}</option>
                  <option value="TENANT">{t("pricing.scope.tenant")}</option>
                  <option value="LOCATION">{t("pricing.scope.location")}</option>
                  <option value="STORAGE">{t("pricing.scope.storage")}</option>
                </select>
              </div>
            </div>
          </ModernCard>

          {pricingQuery.isLoading && !pricingQuery.data ? (
            <ModernCard variant="glass" padding="lg">
              <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
                <Loader2 className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
                <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>{t("common.loading")}</p>
              </div>
            </ModernCard>
          ) : pricingQuery.isError ? (
            <ModernCard variant="glass" padding="lg">
              <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--danger-500)' }}>
                <AlertCircle className="h-12 w-12" style={{ margin: "0 auto var(--space-4) auto" }} />
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0' }}>
                  {t("pricing.loadError")}
                </h3>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-4)' }}>
                  {getErrorMessage(pricingQuery.error)}
                </p>
                <ModernButton variant="primary" onClick={() => pricingQuery.refetch()}>
                  {t("common.retry")}
                </ModernButton>
              </div>
            </ModernCard>
          ) : filteredRules.length > 0 ? (
            <ModernCard variant="glass" padding="lg">
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-1) 0' }}>
                  {t("pricing.rulesTitle")}
                </h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                  {t("pricing.rulesSubtitle", { count: filteredRules.length })}
                </p>
              </div>
              <ModernTable
                columns={[
                  {
                    key: 'scope',
                    label: t("pricing.table.scope"),
                    render: (_, row) => {
                      const variantMap: Record<PricingScope, "info" | "primary" | "success" | "warning"> = {
                        GLOBAL: "info",
                        TENANT: "primary",
                        LOCATION: "success",
                        STORAGE: "warning",
                      };
                      return <Badge variant={variantMap[row.scope]}>{getScopeLabel(row.scope)}</Badge>;
                    },
                  },
                  {
                    key: 'target',
                    label: t("pricing.table.target"),
                    render: (_, row) => {
                      if (row.scope === "STORAGE" && row.storage_code) {
                        return (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                              <Package className="h-3 w-3" />
                              <strong><SafeDisplayValue value={row.storage_code} /></strong>
                            </div>
                            {row.location_name && (
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                                <MapPin className="h-3 w-3" />
                                <SafeDisplayValue value={row.location_name} />
                              </div>
                            )}
                          </div>
                        );
                      }
                      if (row.scope === "LOCATION" && row.location_name) {
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                            <MapPin className="h-3 w-3" />
                            <strong><SafeDisplayValue value={row.location_name} /></strong>
                          </div>
                        );
                      }
                      if (row.name) {
                        return <strong><SafeDisplayValue value={row.name} /></strong>;
                      }
                      return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
                    },
                  },
                  {
                    key: 'pricing_type',
                    label: t("pricing.table.type"),
                    render: (_, row) => (
                      <Badge variant="info">
                        {getPricingTypeLabel(row.pricing_type)}
                      </Badge>
                    ),
                  },
                  {
                    key: 'price_per_hour_minor',
                    label: t("pricing.table.hourly"),
                    render: (value) => <strong>{formatPrice(value)}</strong>,
                    align: 'right',
                  },
                  {
                    key: 'price_per_day_minor',
                    label: t("pricing.table.daily"),
                    render: (value) => <strong>{formatPrice(value)}</strong>,
                    align: 'right',
                  },
                  {
                    key: 'minimum_charge_minor',
                    label: t("pricing.table.minimum"),
                    render: (value) => <strong style={{ color: 'var(--danger-500)' }}>{formatPrice(value)}</strong>,
                    align: 'right',
                  },
                  {
                    key: 'currency',
                    label: t("pricing.table.currency"),
                    render: (value) => <strong><SafeDisplayValue value={value} /></strong>,
                    align: 'center',
                  },
                  {
                    key: 'priority',
                    label: t("pricing.table.priority"),
                    render: (value) => (
                      <Badge variant={value > 0 ? "warning" : "neutral"}>
                        {value}
                      </Badge>
                    ),
                    align: 'center',
                  },
                  {
                    key: 'is_active',
                    label: t("pricing.table.status"),
                    render: (_, row) => (
                      <Badge variant={row.is_active ? "success" : "danger"}>
                        {row.is_active ? t("common.active") : t("common.passive")}
                      </Badge>
                    ),
                    align: 'center',
                  },
                  {
                    key: 'actions',
                    label: t("common.actions"),
                    render: (_, row) => (
                      <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                        <ModernButton
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditRule(row)}
                          leftIcon={<Edit className="h-3 w-3" />}
                        >
                          {t("common.edit")}
                        </ModernButton>
                        <ModernButton
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            if (confirm(t("pricing.confirmDelete"))) {
                              deleteMutation.mutate(row.id);
                            }
                          }}
                          leftIcon={<Trash2 className="h-3 w-3" />}
                        >
                          {t("common.delete")}
                        </ModernButton>
                      </div>
                    ),
                    align: 'right',
                  },
                ] as ModernTableColumn<PricingRule>[]}
                data={paginatedRules}
                loading={pricingQuery.isLoading}
                striped
                hoverable
                stickyHeader
                showRowNumbers
                pagination={paginationMeta}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </ModernCard>
          ) : (
            <ModernCard variant="glass" padding="lg">
              <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
                <DollarSign className="h-16 w-16" style={{ margin: "0 auto var(--space-4) auto", color: 'var(--text-muted)' }} />
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0', color: 'var(--text-primary)' }}>
                  {t("pricing.emptyState.title")}
                </h3>
                <p style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
                  {t("pricing.emptyState.description")}
                </p>
                <ModernButton variant="primary" onClick={handleNewRule} leftIcon={<Plus className="h-4 w-4" />}>
                  {t("pricing.emptyState.button")}
                </ModernButton>
              </div>
            </ModernCard>
          )}
        </>
      )}

      {/* Form Panel */}
      {showForm && (
        <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-2) 0' }}>
                {editingRule ? t("pricing.form.editTitle") : t("pricing.form.createTitle")}
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                {editingRule ? t("pricing.form.editSubtitle") : t("pricing.form.createSubtitle")}
              </p>
            </div>
            <ModernButton 
              variant="ghost" 
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCancel(e);
              }}
              leftIcon={<X className="h-4 w-4" />}
            >
              {t("common.close")}
            </ModernButton>
          </div>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {/* Scope Selection Section */}
            <div>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', marginBottom: 'var(--space-4)', color: 'var(--text-primary)' }}>
                {t("pricing.form.scopeSection")}
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--space-4)" }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {t("pricing.form.scope")} <span style={{ color: 'var(--danger-500)' }}>*</span>
                  </label>
                  <select
                    value={selectedScope}
                    onChange={(e) => handleScopeChange(e.target.value as PricingScope)}
                    style={{
                      width: '100%',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--border-primary)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    <option value="TENANT">{t("pricing.scope.tenant")}</option>
                    <option value="LOCATION">{t("pricing.scope.location")}</option>
                    <option value="STORAGE">{t("pricing.scope.storage")}</option>
                  </select>
                  <small style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)', display: 'block' }}>
                    {t("pricing.form.scopeHelp")}
                  </small>
                </div>

                {/* Location selection for LOCATION and STORAGE scopes */}
                {(selectedScope === "LOCATION" || selectedScope === "STORAGE") && (
                  <div>
                    <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {t("pricing.form.location")} <span style={{ color: 'var(--danger-500)' }}>*</span>
                    </label>
                    <select
                      {...register("location_id", { 
                        required: selectedScope === "LOCATION" || selectedScope === "STORAGE" 
                          ? t("pricing.form.locationRequired") 
                          : false 
                      })}
                      style={{
                        width: '100%',
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-primary)',
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        fontSize: 'var(--text-sm)',
                      }}
                    >
                      <option value="">{t("pricing.form.selectLocation")}</option>
                      {locationsQuery.data?.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                    {errors.location_id && (
                      <span style={{ color: 'var(--danger-500)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)', display: 'block' }}>
                        {errors.location_id.message}
                      </span>
                    )}
                  </div>
                )}

                {/* Storage selection for STORAGE scope */}
                {selectedScope === "STORAGE" && selectedLocationId && (
                  <div>
                    <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {t("pricing.form.storage")} <span style={{ color: 'var(--danger-500)' }}>*</span>
                    </label>
                    <select
                      {...register("storage_id", { 
                        required: selectedScope === "STORAGE" ? t("pricing.form.storageRequired") : false 
                      })}
                      style={{
                        width: '100%',
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-primary)',
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        fontSize: 'var(--text-sm)',
                      }}
                    >
                      <option value="">{t("pricing.form.selectStorage")}</option>
                      {filteredStorages.map((storage) => (
                        <option key={storage.id} value={storage.id}>
                          {storage.code}
                        </option>
                      ))}
                    </select>
                    {errors.storage_id && (
                      <span style={{ color: 'var(--danger-500)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)', display: 'block' }}>
                        {errors.storage_id.message}
                      </span>
                    )}
                    {filteredStorages.length === 0 && (
                      <small style={{ color: '#f59e0b', fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)', display: 'block' }}>
                        {t("pricing.form.noStoragesInLocation")}
                      </small>
                    )}
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
            </div>

            {/* Basic Info Section */}
            <div style={{ marginBottom: "2rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem", color: "#0f172a" }}>
                {t("pricing.form.basicSection")}
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                <div>
                  <label className="form-label">
                    {t("pricing.form.pricingType")} <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <select
                    {...register("pricing_type", { required: t("pricing.form.pricingTypeRequired") })}
                    className="form-input"
                    style={{ fontSize: "0.95rem" }}
                  >
                    <option value="hourly">{t("pricing.type.hourly")}</option>
                    <option value="daily">{t("pricing.type.daily")}</option>
                    <option value="weekly">{t("pricing.type.weekly")}</option>
                    <option value="monthly">{t("pricing.type.monthly")}</option>
                  </select>
                  {errors.pricing_type && (
                    <span style={{ color: "#dc2626", fontSize: "0.75rem", marginTop: "0.25rem", display: "block" }}>
                      {errors.pricing_type.message}
                    </span>
                  )}
                </div>

                <div>
                  <label className="form-label">{t("pricing.form.currency")}</label>
                  <select {...register("currency")} className="form-input" style={{ fontSize: "0.95rem" }}>
                    <option value="TRY">TRY (₺)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">{t("pricing.form.priority")}</label>
                  <input
                    type="number"
                    {...register("priority", { valueAsNumber: true })}
                    className="form-input"
                    placeholder="0"
                    style={{ fontSize: "0.95rem" }}
                  />
                  <small style={{ color: "#64748b", fontSize: "0.75rem", display: "block", marginTop: "0.25rem" }}>
                    {t("pricing.form.priorityHelp")}
                  </small>
                </div>
              </div>
            </div>

            {/* Pricing Section */}
            <div style={{ marginBottom: "2rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem", color: "#0f172a" }}>
                {t("pricing.form.pricesSection")}
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                <div>
                  <label className="form-label">{t("pricing.form.hourlyPrice")}</label>
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
                  <label className="form-label">{t("pricing.form.dailyPrice")}</label>
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
                  <label className="form-label">{t("pricing.form.weeklyPrice")}</label>
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
                  <label className="form-label">{t("pricing.form.monthlyPrice")}</label>
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
                    {t("pricing.form.minimumCharge")} <span style={{ color: "#dc2626" }}>*</span>
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
                {t("pricing.form.optionsSection")}
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
                    {t("pricing.form.isActive")}
                  </label>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label">{t("pricing.form.notes")}</label>
                  <textarea
                    {...register("notes")}
                    className="form-input"
                    rows={3}
                    placeholder={t("pricing.form.notesPlaceholder")}
                    style={{ fontSize: "0.95rem", resize: "vertical" }}
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div
              className="form-actions"
              style={{
                display: "flex",
                gap: "0.75rem",
                justifyContent: "flex-end",
                paddingTop: "1.5rem",
                borderTop: "1px solid #e2e8f0",
                marginTop: "1.5rem",
              }}
            >
              <button 
                type="button" 
                className="btn btn--primary" 
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("[PricingPage] Submit button clicked", { editingRule: editingRule?.id });
                  
                  // Get form values directly
                  const formValues = watchedValues;
                  const payload: PricingRuleCreate = {
                    ...formValues,
                    location_id: formValues.scope === "LOCATION" ? formValues.location_id : null,
                    storage_id: formValues.scope === "STORAGE" ? formValues.storage_id : null,
                  };

                  try {
                    if (editingRule) {
                      await updateMutation.mutateAsync({ id: editingRule.id, payload });
                    } else {
                      await createMutation.mutateAsync(payload);
                    }
                  } catch (error) {
                    console.error("[PricingPage] Submit error:", error);
                  }
                }}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? t("common.saving")
                  : editingRule
                    ? t("common.update")
                    : t("common.save")}
              </button>
              <button 
                type="button" 
                className="btn btn--outline" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("[PricingPage] Cancel button clicked");
                  handleCancel(e);
                }}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {t("common.cancel")}
              </button>
            </div>
          </form>
        </ModernCard>
      )}
    </div>
  );
}
