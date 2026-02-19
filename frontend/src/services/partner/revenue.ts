import { http } from "../../lib/http";

export interface RevenueSummary {
  total_revenue_minor: number;
  tenant_settlement_minor: number;
  kyradi_commission_minor: number;
  transaction_count: number;
  date?: string;
}

export interface Settlement {
  id: string;
  tenant_id: string;
  payment_id: string;
  reservation_id: string;
  total_amount_minor: number;
  tenant_settlement_minor: number;
  kyradi_commission_minor: number;
  currency: string;
  status: string;
  settled_at: string | null;
  commission_rate: number;
  created_at: string;
}

export interface SettlementListResponse {
  items: Settlement[];
  total_count: number;
  total_income: number;
  total_commission: number;
  total_payout: number;
  currency: string;
}

export interface PaymentModeRevenue {
  mode: string;
  label: string;
  total_revenue_minor: number;
  tenant_settlement_minor: number;
  kyradi_commission_minor: number;
  transaction_count: number;
}

export interface DailyRevenueItem {
  date: string;
  total_revenue_minor: number;
  tenant_settlement_minor: number;
  kyradi_commission_minor: number;
  transaction_count: number;
}

export interface RevenueHistoryResponse {
  items: DailyRevenueItem[];
  total_revenue_minor: number;
  total_tenant_settlement_minor: number;
  total_kyradi_commission_minor: number;
  total_transaction_count: number;
  period_start: string;
  period_end: string;
}

const normalizeArray = <T>(data: unknown): T[] => {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: T[] }).items;
  }
  return [];
};

const normalizeHistoryResponse = (data: unknown): RevenueHistoryResponse => {
  const fallback: RevenueHistoryResponse = {
    items: [],
    total_revenue_minor: 0,
    total_tenant_settlement_minor: 0,
    total_kyradi_commission_minor: 0,
    total_transaction_count: 0,
    period_start: "",
    period_end: "",
  };

  if (!data || typeof data !== "object") return fallback;
  const payload = data as Partial<RevenueHistoryResponse> & { items?: unknown };

  return {
    items: normalizeArray<DailyRevenueItem>(payload.items),
    total_revenue_minor: payload.total_revenue_minor ?? 0,
    total_tenant_settlement_minor: payload.total_tenant_settlement_minor ?? 0,
    total_kyradi_commission_minor: payload.total_kyradi_commission_minor ?? 0,
    total_transaction_count: payload.total_transaction_count ?? 0,
    period_start: payload.period_start ?? "",
    period_end: payload.period_end ?? "",
  };
};

const normalizeSettlementsResponse = (data: unknown): SettlementListResponse => {
  const fallback: SettlementListResponse = {
    items: [],
    total_count: 0,
    total_income: 0,
    total_commission: 0,
    total_payout: 0,
    currency: "TRY",
  };

  if (!data || typeof data !== "object") return fallback;
  const payload = data as Partial<SettlementListResponse> & { items?: unknown };

  return {
    items: normalizeArray<Settlement>(payload.items),
    total_count: payload.total_count ?? normalizeArray<Settlement>(payload.items).length,
    total_income: payload.total_income ?? 0,
    total_commission: payload.total_commission ?? 0,
    total_payout: payload.total_payout ?? 0,
    currency: payload.currency ?? "TRY",
  };
};

export const revenueService = {
  async getSummary(dateFrom?: string, dateTo?: string): Promise<RevenueSummary> {
    const params: Record<string, string> = {};
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.to = dateTo;
    const response = await http.get<RevenueSummary>("/revenue/summary", { params });
    return response.data;
  },

  async getDaily(date?: string): Promise<RevenueSummary> {
    const params: Record<string, string> = {};
    if (date) params.date = date;
    const response = await http.get<RevenueSummary>("/revenue/daily", { params });
    return response.data;
  },

  async listSettlements(
    status?: string,
    dateFrom?: string,
    dateTo?: string,
    locationId?: string,
    storageId?: string,
    search?: string
  ): Promise<SettlementListResponse> {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.to = dateTo;
    if (locationId) params.location_id = locationId;
    if (storageId) params.storage_id = storageId;
    if (search) params.search = search;
    const response = await http.get<SettlementListResponse>("/revenue/settlements", { params });
    return normalizeSettlementsResponse(response.data);
  },

  // Legacy method for backward compatibility
  async listSettlementsLegacy(
    status?: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<Settlement[]> {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.to = dateTo;
    const response = await http.get<Settlement[]>("/revenue/settlements/legacy", { params });
    return response.data;
  },

  async getByPaymentMode(dateFrom?: string, dateTo?: string): Promise<PaymentModeRevenue[]> {
    const params: Record<string, string> = {};
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.to = dateTo;
    const response = await http.get<PaymentModeRevenue[]>("/revenue/by-payment-mode", { params });
    return normalizeArray<PaymentModeRevenue>(response.data);
  },

  async getHistory(
    dateFrom?: string, 
    dateTo?: string, 
    granularity: "daily" | "weekly" | "monthly" = "daily"
  ): Promise<RevenueHistoryResponse> {
    const params: Record<string, string> = { granularity };
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.to = dateTo;
    const response = await http.get<RevenueHistoryResponse>("/revenue/history", { params });
    return normalizeHistoryResponse(response.data);
  },
};
