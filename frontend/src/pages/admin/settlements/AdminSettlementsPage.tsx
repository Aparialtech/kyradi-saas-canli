import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "../../../hooks/useTranslation";
import { adminTenantService } from "../../../services/admin/tenants";
import { http } from "../../../lib/http";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { SearchInput } from "../../../components/common/SearchInput";

interface Settlement {
  id: string;
  tenant_id: string;
  payment_id: string;
  reservation_id: string;
  total_amount_minor: number;
  tenant_settlement_minor: number;
  kyradi_commission_minor: number;
  currency: string;
  status: string;
  commission_rate: number;
  created_at: string;
  settled_at?: string;
}

export function AdminSettlementsPage() {
  const { t } = useTranslation();
  const { messages } = useToast();
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const tenantsQuery = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: adminTenantService.list,
  });

  const settlementsQuery = useQuery({
    queryKey: ["admin", "settlements", selectedTenantId, statusFilter, dateFrom, dateTo],
    queryFn: async (): Promise<Settlement[]> => {
      const params: Record<string, string> = {};
      if (selectedTenantId) params.tenant_id = selectedTenantId;
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      const response = await http.get<Settlement[]>("/admin/settlements", { params });
      return response.data;
    },
  });

  const tenantsById = new Map(
    tenantsQuery.data?.map((tenant) => [tenant.id, tenant]) ?? []
  );

  // Filter settlements by search term
  const filteredSettlements = useMemo(() => {
    const settlements = settlementsQuery.data ?? [];
    if (!searchTerm.trim()) return settlements;
    
    const term = searchTerm.toLowerCase();
    return settlements.filter((settlement) => {
      const tenant = tenantsById.get(settlement.tenant_id);
      const tenantName = (tenant?.name ?? "").toLowerCase();
      const paymentId = settlement.payment_id.toLowerCase();
      const amount = (settlement.total_amount_minor / 100).toString();
      
      return tenantName.includes(term) || paymentId.includes(term) || amount.includes(term);
    });
  }, [settlementsQuery.data, searchTerm, tenantsById]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  return (
    <section className="page">
      <ToastContainer messages={messages} />
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("nav.globalSettlements")}</h1>
          <p className="page-subtitle">{t("common.allHotels" as any)} hakediş kayıtları ve detayları</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <div>
            <h3 className="panel__title">Filtreler</h3>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          <label className="form-field">
            <span className="form-field__label">{t("common.hotel")} Seç</span>
            <select
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="">{t("common.allHotels" as any)}</option>
              {tenantsQuery.data?.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-field__label">Durum</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="">Tüm Durumlar</option>
              <option value="pending">Beklemede</option>
              <option value="settled">Ödendi</option>
              <option value="cancelled">İptal</option>
            </select>
          </label>
          <label className="form-field">
            <span className="form-field__label">Başlangıç Tarihi</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ width: "100%" }}
            />
          </label>
          <label className="form-field">
            <span className="form-field__label">Bitiş Tarihi</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ width: "100%" }}
            />
          </label>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <div>
            <h3 className="panel__title">Hakediş Kayıtları</h3>
            <p className="panel__subtitle">
              {filteredSettlements.length} / {settlementsQuery.data?.length ?? 0} kayıt gösteriliyor
            </p>
          </div>
          <div style={{ minWidth: "250px" }}>
            <SearchInput
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Otel adı, payment ID veya tutar ile ara..."
            />
          </div>
        </div>
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>{t("common.hotel")}</th>
                <th>Payment ID</th>
                <th>Toplam Tutar</th>
                <th>Otel Payı</th>
                <th>Kyradi Komisyonu</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {settlementsQuery.isLoading ? (
                <tr>
                  <td colSpan={7}>Veriler yükleniyor...</td>
                </tr>
              ) : filteredSettlements.length > 0 ? (
                filteredSettlements.map((settlement) => {
                  const tenant = tenantsById.get(settlement.tenant_id);
                  return (
                    <tr key={settlement.id}>
                      <td>
                        {new Date(settlement.created_at).toLocaleString("tr-TR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td>
                        <strong>{tenant?.name ?? `Bilinmeyen ${t("common.hotel")}`}</strong>
                        <div className="table-cell-muted">#{settlement.tenant_id.slice(0, 8)}</div>
                      </td>
                      <td>
                        <code style={{ fontSize: "0.875rem" }}>{settlement.payment_id.slice(0, 8)}</code>
                      </td>
                      <td>
                        ₺ {(settlement.total_amount_minor / 100).toLocaleString("tr-TR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td>
                        ₺ {(settlement.tenant_settlement_minor / 100).toLocaleString("tr-TR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td>
                        ₺ {(settlement.kyradi_commission_minor / 100).toLocaleString("tr-TR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background:
                              settlement.status === "settled"
                                ? "rgba(16, 185, 129, 0.1)"
                                : settlement.status === "pending"
                                  ? "rgba(245, 158, 11, 0.1)"
                                  : "rgba(239, 68, 68, 0.1)",
                            color:
                              settlement.status === "settled"
                                ? "#10b981"
                                : settlement.status === "pending"
                                  ? "#f59e0b"
                                  : "#ef4444",
                          }}
                        >
                          {settlement.status === "settled"
                            ? "Ödendi"
                            : settlement.status === "pending"
                              ? "Beklemede"
                              : "İptal"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state" style={{ margin: "2rem 0" }}>
                      <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>💰</div>
                      <h3 className="empty-state__title">Hakediş kaydı bulunamadı</h3>
                      <p>Seçili filtrelerle eşleşen hakediş kaydı bulunamadı. Filtreleri değiştirerek tekrar deneyin.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {settlementsQuery.isError && (
        <div className="panel">
          <div className="empty-state">
            <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
            <h3 className="empty-state__title">Hakediş verileri alınamadı</h3>
            <p className="field-error">Lütfen daha sonra tekrar deneyin veya filtreleri değiştirin.</p>
          </div>
        </div>
      )}
    </section>
  );
}

