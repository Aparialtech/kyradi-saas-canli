import { http } from "../../lib/http";

export interface AdminTenantSummary {
  tenant_id: string;
  tenant_name?: string;
  tenant_slug?: string;
  today_revenue_minor: number;
  active_reservations: number;
  total_revenue_30d_minor: number;
  total_commission_30d_minor: number;
}

export interface AdminDailyRevenue {
  date: string;
  revenue_minor: number;
  commission_minor: number;
  transaction_count: number;
}

export interface AdminTopTenant {
  tenant_id: string;
  tenant_name: string;
  revenue_minor: number;
  commission_minor: number;
}

export interface SystemHealth {
  email_service_status: string;
  email_service_last_error?: string;
  sms_service_status: string;
  sms_service_last_error?: string;
  payment_provider_status: string;
  payment_provider_last_success?: string;
}

export interface AdminSummaryResponse {
  total_tenants: number;
  active_tenants: number;
  total_users: number;
  total_storages: number;
  reservations_24h: number;
  reservations_7d: number;
  total_revenue_minor: number;
  total_commission_minor: number;
  tenants: AdminTenantSummary[];
  daily_revenue_30d: AdminDailyRevenue[];
  top_tenants: AdminTopTenant[];
  system_health: SystemHealth;
}

export const adminReportService = {
  async summary(): Promise<AdminSummaryResponse> {
    const response = await http.get<AdminSummaryResponse>("/admin/reports/summary");
    return response.data;
  },
};
