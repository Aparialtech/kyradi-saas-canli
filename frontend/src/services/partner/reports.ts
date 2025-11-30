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

export const partnerReportService = {
  async summary(): Promise<PartnerSummary> {
    const response = await http.get<PartnerSummary>("/reports/summary");
    return response.data;
  },
  async registerExport(): Promise<{ remaining: number | null }> {
    const response = await http.post<{ remaining: number | null }>("/reports/reservations/export-log");
    return response.data;
  },
};
