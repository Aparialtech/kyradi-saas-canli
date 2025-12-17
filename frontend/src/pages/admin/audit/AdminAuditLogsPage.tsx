import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";

import { adminAuditService, type AuditLogFilters } from "../../../services/admin/audit";
import { adminTenantService } from "../../../services/admin/tenants";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { ModernInput } from "../../../components/ui/ModernInput";
import { Search, Download, Filter, ChevronLeft, ChevronRight } from "../../../lib/lucide";

export function AdminAuditLogsPage() {
  const { messages } = useToast();
  const [filters, setFilters] = useState<AuditLogFilters>({ page: 1, page_size: 50 });
  const [searchTerm, setSearchTerm] = useState("");
  const requestFilters = useMemo(() => {
    const { from_date, to_date, ...rest } = filters;
    return {
      ...rest,
      from_date: from_date ? `${from_date}T00:00:00Z` : undefined,
      to_date: to_date ? `${to_date}T23:59:59Z` : undefined,
    };
  }, [filters]);

  const tenantsQuery = useQuery({ queryKey: ["admin", "tenants"], queryFn: adminTenantService.list });
  const auditQuery = useQuery({
    queryKey: ["admin", "audit", requestFilters],
    queryFn: () => adminAuditService.list(requestFilters),
  });

  const totalPages = useMemo(() => {
    if (!auditQuery.data) return 1;
    return Math.max(1, Math.ceil(auditQuery.data.total / auditQuery.data.page_size));
  }, [auditQuery.data]);

  // Filter logs by search term (client-side)
  const filteredLogs = useMemo(() => {
    if (!auditQuery.data?.items) return [];
    if (!searchTerm.trim()) return auditQuery.data.items;
    const term = searchTerm.toLowerCase();
    return auditQuery.data.items.filter((log) => {
      return (
        log.action?.toLowerCase().includes(term) ||
        log.entity?.toLowerCase().includes(term) ||
        log.tenant_id?.toLowerCase().includes(term) ||
        log.actor_user_id?.toLowerCase().includes(term) ||
        JSON.stringify(log.meta_json || {}).toLowerCase().includes(term)
      );
    });
  }, [auditQuery.data?.items, searchTerm]);

  const applyFilter = (partial: Partial<AuditLogFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...partial,
    }));
  };

  useEffect(() => {
    if (!auditQuery.data) return;
    const currentPage = filters.page ?? 1;
    if (currentPage > totalPages) {
      setFilters((prev) => ({ ...prev, page: totalPages }));
    }
  }, [auditQuery.data, filters.page, totalPages]);

  // CSV Export handler
  const exportToCsv = useCallback(() => {
    if (!auditQuery.data?.items || auditQuery.data.items.length === 0) return;

    const headers = ["Tarih", "Action", "Kaynak", "Entity", "Tenant", "Aktör", "Detay"];
    const csvRows = [headers.join(";")];

    for (const log of filteredLogs) {
      const row = [
        new Date(log.created_at).toLocaleString("tr-TR"),
        log.action || "-",
        (log.meta_json?.source as string | undefined) || "partner",
        log.entity || "-",
        log.tenant_id || "-",
        log.actor_user_id || "-",
        log.meta_json ? JSON.stringify(log.meta_json).replace(/;/g, ",") : "-",
      ];
      csvRows.push(row.map(v => v.includes(";") ? `"${v.replace(/"/g, '""')}"` : v).join(";"));
    }

    const csvString = "\ufeff" + csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `audit_logs_${filters.from_date || "tum"}_${filters.to_date || "tum"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [auditQuery.data?.items, filteredLogs, filters.from_date, filters.to_date]);

  const selectStyle = {
    padding: 'var(--space-2) var(--space-3)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
  };

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: '1600px', margin: '0 auto' }}>
      <ToastContainer messages={messages} />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 'var(--space-6)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-black)', color: 'var(--text-primary)', margin: '0 0 var(--space-2) 0' }}>
              Audit Logları
            </h1>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', margin: 0 }}>
              Sistem üzerinde gerçekleşen kritik işlemleri inceleyin
            </p>
          </div>
          <ModernButton
            variant="outline"
            onClick={exportToCsv}
            disabled={!auditQuery.data?.items?.length}
            leftIcon={<Download className="h-4 w-4" />}
          >
            CSV İndir
          </ModernButton>
        </div>
      </motion.div>

      {/* Search & Filters */}
      <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <ModernInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Action, entity, tenant veya aktörde ara..."
            leftIcon={<Search className="h-5 w-5" />}
            fullWidth
          />
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
          <Filter className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
          
          <select
            value={filters.tenant_id ?? ""}
            onChange={(event) => applyFilter({ tenant_id: event.target.value || undefined, page: 1 })}
            style={selectStyle}
          >
            <option value="">Tüm Tenantlar</option>
            {(tenantsQuery.data ?? []).map((tenant) => (
              <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
            ))}
          </select>

          <input
            value={filters.action ?? ""}
            onChange={(event) => applyFilter({ action: event.target.value || undefined, page: 1 })}
            placeholder="Action filtresi..."
            style={{ ...selectStyle, minWidth: '180px' }}
          />

          <input
            type="date"
            value={filters.from_date ?? ""}
            onChange={(event) => applyFilter({ from_date: event.target.value || undefined, page: 1 })}
            style={selectStyle}
          />

          <input
            type="date"
            value={filters.to_date ?? ""}
            onChange={(event) => applyFilter({ to_date: event.target.value || undefined, page: 1 })}
            style={selectStyle}
          />

          <select
            value={filters.source ?? ""}
            onChange={(event) => applyFilter({ source: event.target.value || undefined, page: 1 })}
            style={selectStyle}
          >
            <option value="">Tüm Kaynaklar</option>
            <option value="partner">Partner</option>
            <option value="self_service">Self-Service</option>
          </select>

          <select
            value={filters.page_size ?? 50}
            onChange={(event) => applyFilter({ page_size: Number(event.target.value), page: 1 })}
            style={selectStyle}
          >
            {[25, 50, 100, 200].map((size) => (
              <option key={size} value={size}>{size} kayıt</option>
            ))}
          </select>
        </div>
      </ModernCard>

      {/* Table */}
      <ModernCard variant="glass" padding="lg">
        {auditQuery.isLoading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-16)', color: 'var(--text-tertiary)' }}>
            <div className="shimmer" style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-full)', margin: '0 auto var(--space-4) auto' }} />
            <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>Loglar yükleniyor...</p>
          </div>
        ) : filteredLogs.length > 0 ? (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--text-secondary)' }}>Tarih</th>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--text-secondary)' }}>Action</th>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--text-secondary)' }}>Kaynak</th>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--text-secondary)' }}>Entity</th>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--text-secondary)' }}>Tenant</th>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--text-secondary)' }}>Aktör</th>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--text-secondary)' }}>Detay</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                      <td style={{ padding: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                        {new Date(log.created_at).toLocaleString("tr-TR")}
                      </td>
                      <td style={{ padding: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                        <code style={{ background: 'var(--bg-tertiary)', padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)' }}>
                          {log.action}
                        </code>
                      </td>
                      <td style={{ padding: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
                        <span style={{
                          background: (log.meta_json?.source as string) === 'self_service' ? 'var(--color-warning-soft)' : 'var(--color-info-soft)',
                          color: (log.meta_json?.source as string) === 'self_service' ? '#d97706' : '#0284c7',
                          padding: 'var(--space-1) var(--space-2)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--text-xs)',
                          fontWeight: 'var(--font-medium)',
                        }}>
                          {(log.meta_json?.source as string | undefined) ?? "partner"}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                        {log.entity ?? "-"}
                      </td>
                      <td style={{ padding: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                        {log.tenant_id ?? "-"}
                      </td>
                      <td style={{ padding: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                        {log.actor_user_id ?? "-"}
                      </td>
                      <td style={{ padding: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
                        {log.meta_json ? (
                          <details>
                            <summary style={{ cursor: 'pointer', color: 'var(--primary)' }}>Göster</summary>
                            <pre style={{ 
                              whiteSpace: 'pre-wrap', 
                              fontSize: 'var(--text-xs)', 
                              background: 'var(--bg-tertiary)', 
                              padding: 'var(--space-2)', 
                              borderRadius: 'var(--radius-sm)',
                              marginTop: 'var(--space-2)',
                              maxWidth: '300px',
                              overflow: 'auto',
                            }}>
                              {JSON.stringify(log.meta_json, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)' }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginTop: 'var(--space-4)', 
              paddingTop: 'var(--space-4)', 
              borderTop: '1px solid var(--border-primary)' 
            }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                Toplam <strong>{auditQuery.data?.total ?? 0}</strong> kayıt · Sayfa {auditQuery.data?.page ?? 1} / {totalPages}
                {searchTerm && ` · ${filteredLogs.length} sonuç gösteriliyor`}
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <ModernButton
                  variant="ghost"
                  size="sm"
                  onClick={() => applyFilter({ page: Math.max(1, (filters.page ?? 1) - 1) })}
                  disabled={(filters.page ?? 1) <= 1 || auditQuery.isLoading}
                  leftIcon={<ChevronLeft className="h-4 w-4" />}
                >
                  Önceki
                </ModernButton>
                <ModernButton
                  variant="primary"
                  size="sm"
                  onClick={() => applyFilter({ page: Math.min(totalPages, (filters.page ?? 1) + 1) })}
                  disabled={(filters.page ?? 1) >= totalPages || auditQuery.isLoading}
                  rightIcon={<ChevronRight className="h-4 w-4" />}
                >
                  Sonraki
                </ModernButton>
              </div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 'var(--space-16)', color: 'var(--text-tertiary)' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0' }}>
              Kayıt bulunamadı
            </h3>
            <p style={{ margin: 0 }}>Seçtiğiniz filtrelere uygun log kaydı bulunmuyor.</p>
          </div>
        )}
      </ModernCard>
    </div>
  );
}
