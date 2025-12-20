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
    return response.data;
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
    return response.data;
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
    return response.data;
  },
};

