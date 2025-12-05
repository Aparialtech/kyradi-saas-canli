import { http } from "../../lib/http";

export interface LimitWarning {
  type: string;
  message: string;
  remaining?: number | null;
}

export interface PartnerSummary {
  active_reservations: number;
  locker_occupancy_pct: number;
  today_revenue_minor: number;
  total_reservations: number;
  report_exports_today: number;
  storage_used_mb: number;
  plan_limits: {
    max_locations?: number | null;
    max_lockers?: number | null;
    max_active_reservations?: number | null;
    max_users?: number | null;
    max_self_service_daily?: number | null;
    max_reservations_total?: number | null;
    max_report_exports_daily?: number | null;
    max_storage_mb?: number | null;
  };
  warnings?: LimitWarning[];
  report_exports_reset_at: string;
  report_exports_remaining?: number | null;
  self_service_remaining?: number | null;
}

export interface PartnerOverviewSummary {
  total_revenue_minor: number;
  total_reservations: number;
  active_reservations: number;
  occupancy_rate: number;
}

export interface PartnerOverviewDailyItem {
  date: string; // YYYY-MM-DD
  revenue_minor: number;
}

export interface PartnerOverviewByLocationItem {
  location_name: string;
  revenue_minor: number;
  reservations: number;
}

export interface PartnerOverviewByStorageItem {
  storage_code: string;
  location_name: string;
  reservations: number;
}

export interface PartnerOverviewResponse {
  summary: PartnerOverviewSummary;
  daily: PartnerOverviewDailyItem[];
  by_location: PartnerOverviewByLocationItem[];
  by_storage: PartnerOverviewByStorageItem[];
}

export interface PartnerOverviewFilters {
  date_from?: string;
  date_to?: string;
  location_id?: string;
  status?: string;
}

export const partnerReportService = {
  async summary(): Promise<PartnerSummary> {
    const response = await http.get<PartnerSummary>("/reports/summary");
    return response.data;
  },
  async registerExport(): Promise<{ remaining: number | null }> {
    const response = await http.post<{ remaining: number | null }>("/reports/reservations/export-log");
    return response.data;
  },
  async getPartnerOverview(filters?: PartnerOverviewFilters): Promise<PartnerOverviewResponse> {
    const params: Record<string, string> = {};
    if (filters?.date_from) params.date_from = filters.date_from;
    if (filters?.date_to) params.date_to = filters.date_to;
    if (filters?.location_id) params.location_id = filters.location_id;
    if (filters?.status) params.status = filters.status;
    
    const response = await http.get<PartnerOverviewResponse>("/reports/partner-overview", { params });
    return response.data;
  },
  async exportReport(
    format: "csv" | "xlsx" | "template",
    filters?: PartnerOverviewFilters & { anonymous?: boolean }
  ): Promise<Blob> {
    const params: Record<string, string> = { format };
    if (filters?.date_from) params.date_from = filters.date_from;
    if (filters?.date_to) params.date_to = filters.date_to;
    if (filters?.location_id) params.location_id = filters.location_id;
    if (filters?.status) params.status = filters.status;
    if (filters?.anonymous) params.anonymous = "true";
    
    const response = await http.get<Blob>("/reports/export", {
      params,
      responseType: "blob",
    });
    return response.data;
  },
};
