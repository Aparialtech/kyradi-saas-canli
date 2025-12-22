import { useState, useMemo, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, Package, MapPin, DollarSign, Plus, Edit, Trash2, Loader2, Search } from "../../../lib/lucide";
import { pricingService, type PricingRule, type PricingScope } from "../../../services/partner/pricing";
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
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<PricingScope | "">("");
  const { page, pageSize, setPage, setPageSize } = usePagination(10);

  // Fetch pricing rules
  const pricingQuery = useQuery({
    queryKey: ["pricing"],
    queryFn: () => pricingService.list(),
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
        <ModernButton 
          variant="primary" 
          onClick={() => navigate("/app/pricing/new")} 
          leftIcon={<Plus className="h-4 w-4" />}
        >
          {t("pricing.newRule")}
        </ModernButton>
      </motion.div>

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

      {/* Pricing Rules List */}
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
                      onClick={() => navigate(`/app/pricing/${row.id}/edit`)}
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
            <ModernButton variant="primary" onClick={() => navigate("/app/pricing/new")} leftIcon={<Plus className="h-4 w-4" />}>
              {t("pricing.emptyState.button")}
            </ModernButton>
          </div>
        </ModernCard>
      )}
    </div>
  );
}
