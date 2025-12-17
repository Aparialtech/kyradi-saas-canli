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
  total_reservations: number;
  total_revenue_minor: number;
  total_commission_minor: number;
  tenants: AdminTenantSummary[];
  daily_revenue_30d: AdminDailyRevenue[];
  top_tenants: AdminTopTenant[];
  system_health: SystemHealth;
}

export interface AdminTrendDataPoint {
  date: string;
  revenue_minor: number;
  reservations: number;
  commission_minor: number;
}

export interface AdminStorageUsage {
  storage_id: string;
  storage_code: string;
  location_name: string;
  tenant_name: string;
  reservations: number;
  occupancy_rate: number;
  total_revenue_minor: number;
}

export const adminReportService = {
  async summary(params?: {
    tenant_id?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<AdminSummaryResponse> {
    const queryParams = new URLSearchParams();
    if (params?.tenant_id) queryParams.append("tenant_id", params.tenant_id);
    if (params?.date_from) queryParams.append("from", params.date_from);
    if (params?.date_to) queryParams.append("to", params.date_to);
    
    const url = queryParams.toString() 
      ? `/admin/reports/summary?${queryParams.toString()}`
      : "/admin/reports/summary";
    const response = await http.get<AdminSummaryResponse>(url);
    return response.data;
  },
  
  async getTrends(params?: {
    tenant_id?: string;
    date_from?: string;
    date_to?: string;
    granularity?: "daily" | "weekly" | "monthly";
  }): Promise<AdminTrendDataPoint[]> {
    const queryParams = new URLSearchParams();
    if (params?.tenant_id) queryParams.append("tenant_id", params.tenant_id);
    if (params?.date_from) queryParams.append("from", params.date_from);
    if (params?.date_to) queryParams.append("to", params.date_to);
    if (params?.granularity) queryParams.append("granularity", params.granularity);
    
    const response = await http.get<AdminTrendDataPoint[]>(`/admin/reports/trends?${queryParams.toString()}`);
    return response.data;
  },
  
  async getStorageUsage(params?: {
    tenant_id?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<AdminStorageUsage[]> {
    const queryParams = new URLSearchParams();
    if (params?.tenant_id) queryParams.append("tenant_id", params.tenant_id);
    if (params?.date_from) queryParams.append("from", params.date_from);
    if (params?.date_to) queryParams.append("to", params.date_to);
    
    const response = await http.get<AdminStorageUsage[]>(`/admin/reports/storage-usage?${queryParams.toString()}`);
    return response.data;
  },
};
