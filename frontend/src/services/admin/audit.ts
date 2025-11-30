import { http } from "../../lib/http";

export interface AuditLog {
  id: string;
  tenant_id?: string | null;
  actor_user_id?: string | null;
  action: string;
  entity?: string | null;
  entity_id?: string | null;
  meta_json?: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditLogFilters {
  tenant_id?: string;
  action?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  page_size?: number;
  source?: string;
}

export interface AuditLogListResponse {
  items: AuditLog[];
  total: number;
  page: number;
  page_size: number;
}

export const adminAuditService = {
  async list(filters?: AuditLogFilters): Promise<AuditLogListResponse> {
    const response = await http.get<AuditLogListResponse>("/admin/audit-logs", { params: filters });
    return response.data;
  },
};
