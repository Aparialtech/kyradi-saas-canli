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

  async listSettlements(status?: string, dateFrom?: string, dateTo?: string): Promise<Settlement[]> {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.to = dateTo;
    const response = await http.get<Settlement[]>("/revenue/settlements", { params });
    return response.data;
  },
};

