import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { adminAuditService, type AuditLogFilters } from "../../../services/admin/audit";
import { adminTenantService } from "../../../services/admin/tenants";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";

export function AdminAuditLogsPage() {
  const { messages } = useToast();
  const [filters, setFilters] = useState<AuditLogFilters>({ page: 1, page_size: 50 });
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

  return (
    <section className="page">
      <ToastContainer messages={messages} />
      <div className="panel">
        <div className="panel__header">
          <div>
            <h2 className="panel__title">Audit Logları</h2>
            <p className="panel__subtitle">
              Sistem üzerinde gerçekleşen kritik işlemleri tenant ve aksiyon bazlı filtrelerle
              inceleyin.
            </p>
          </div>
        </div>

        <div className="panel__filters">
          <label className="form-field">
            <span className="form-field__label">Tenant</span>
            <select
              value={filters.tenant_id ?? ""}
              onChange={(event) =>
                applyFilter({
                  tenant_id: event.target.value || undefined,
                  page: 1,
                })
              }
            >
              <option value="">Tüm Tenantlar</option>
              {(tenantsQuery.data ?? []).map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field" style={{ flex: 1 }}>
            <span className="form-field__label">Aksiyon</span>
            <input
              value={filters.action ?? ""}
              onChange={(event) =>
                applyFilter({
                  action: event.target.value || undefined,
                  page: 1,
                })
              }
              placeholder="reservation.create, tenant.update ..."
            />
          </label>
          <label className="form-field">
            <span className="form-field__label">Başlangıç Tarihi</span>
            <input
              type="date"
              value={filters.from_date ?? ""}
              onChange={(event) =>
                applyFilter({
                  from_date: event.target.value || undefined,
                  page: 1,
                })
              }
            />
          </label>
          <label className="form-field">
            <span className="form-field__label">Bitiş Tarihi</span>
            <input
              type="date"
              value={filters.to_date ?? ""}
              onChange={(event) =>
                applyFilter({
                  to_date: event.target.value || undefined,
                  page: 1,
                })
              }
            />
          </label>
          <label className="form-field">
            <span className="form-field__label">Sayfa Boyutu</span>
            <select
              value={filters.page_size ?? 50}
              onChange={(event) =>
                applyFilter({
                  page_size: Number(event.target.value),
                  page: 1,
                })
              }
            >
              {[25, 50, 100, 200].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-field__label">Kaynak</span>
            <select
              value={filters.source ?? ""}
              onChange={(event) =>
                applyFilter({
                  source: event.target.value || undefined,
                  page: 1,
                })
              }
            >
              <option value="">Tümü</option>
              <option value="partner">Partner</option>
              <option value="self_service">Self-Service</option>
            </select>
          </label>
        </div>

        <div className="data-table-wrapper" style={{ marginTop: "1.5rem" }}>
          {auditQuery.isLoading ? (
            <div className="empty-state">
              <h3 className="empty-state__title">Loglar yükleniyor</h3>
              <p>Daha fazla filtre ekleyerek aramanızı daraltabilirsiniz.</p>
            </div>
          ) : auditQuery.data && auditQuery.data.items.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Action</th>
                  <th>Kaynak</th>
                  <th>Entity</th>
                  <th>Tenant</th>
                  <th>Aktör</th>
                  <th>Detay</th>
                </tr>
              </thead>
              <tbody>
                {auditQuery.data.items.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString("tr-TR")}</td>
                    <td>{log.action}</td>
                    <td>
                      <span className="badge badge--info">
                        {(log.meta_json?.source as string | undefined) ?? "partner"}
                      </span>
                    </td>
                    <td>{log.entity ?? "-"}</td>
                    <td>{log.tenant_id ?? "-"}</td>
                    <td>{log.actor_user_id ?? "-"}</td>
                    <td>
                      {log.meta_json ? (
                        <details>
                          <summary>Göster</summary>
                          <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.8rem" }}>
                            {JSON.stringify(log.meta_json, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="table-cell-muted">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <h3 className="empty-state__title">Kayıt bulunamadı</h3>
              <p>Seçtiğiniz filtrelere uygun log kaydı bulunmuyor.</p>
            </div>
          )}
        </div>
        {auditQuery.data && (
          <div className="page-actions" style={{ justifyContent: "space-between", marginTop: "1.5rem" }}>
            <div style={{ color: "#475569", fontSize: "0.9rem" }}>
              Toplam <strong>{auditQuery.data.total}</strong> kayıt · Sayfa {auditQuery.data.page} / {totalPages}
            </div>
            <div className="table-actions" style={{ gap: "0.5rem" }}>
              <button
                type="button"
                className="btn btn--ghost-dark"
                onClick={() =>
                  applyFilter({
                    page: Math.max(1, (filters.page ?? 1) - 1),
                  })
                }
                disabled={(filters.page ?? 1) <= 1 || auditQuery.isLoading}
              >
                Önceki
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() =>
                  applyFilter({
                    page: Math.min(totalPages, (filters.page ?? 1) + 1),
                  })
                }
                disabled={(filters.page ?? 1) >= totalPages || auditQuery.isLoading}
              >
                Sonraki
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
