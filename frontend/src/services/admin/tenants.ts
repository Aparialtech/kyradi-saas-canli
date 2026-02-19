import { http } from "../../lib/http";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  plan: string;
  is_active: boolean;
  brand_color?: string | null;
  logo_url?: string | null;
  legal_name?: string | null;
  custom_domain?: string | null;
  created_at: string;
}

export interface TenantCreatePayload {
  slug: string;
  name: string;
  plan: string;
  is_active?: boolean;
  brand_color?: string;
  logo_url?: string;
  legal_name?: string;
  custom_domain?: string;
  metadata?: {
    contact?: {
      email?: string;
      phone?: string;
      website?: string;
    };
    location?: {
      address?: string;
      city?: string;
      district?: string;
      latitude?: number;
      longitude?: number;
    };
    working_hours?: Record<string, { open: string; close: string; closed: boolean }>;
    tax_number?: string;
  };
}

export interface TenantUpdatePayload {
  name?: string;
  plan?: string;
  is_active?: boolean;
  brand_color?: string;
  logo_url?: string;
  legal_name?: string;
  custom_domain?: string | null;
  metadata?: {
    contact?: {
      email?: string;
      phone?: string;
      website?: string;
    };
    location?: {
      address?: string;
      city?: string;
      district?: string;
      latitude?: number;
      longitude?: number;
    };
    working_hours?: Record<string, { open: string; close: string; closed: boolean }>;
    tax_number?: string;
  };
}

export interface TenantPlanLimits {
  max_locations?: number | null;
  max_lockers?: number | null;
  max_active_reservations?: number | null;
  max_users?: number | null;
  max_self_service_daily?: number | null;
  max_reservations_total?: number | null;
  max_report_exports_daily?: number | null;
  max_storage_mb?: number | null;
}

export interface TenantMetrics {
  locations: number;
  lockers: number;
  active_reservations: number;
  total_reservations: number;
  revenue_30d_minor: number;
  users: number;
  self_service_last24h: number;
  report_exports_last24h: number;
  storage_used_mb: number;
}

export interface TenantDetail {
  tenant: Tenant;
  plan_limits: TenantPlanLimits;
  metrics: TenantMetrics;
}

export interface TenantPlanLimitsUpdatePayload {
  plan: string;
  max_locations?: number | null;
  max_lockers?: number | null;
  max_active_reservations?: number | null;
  max_users?: number | null;
  max_self_service_daily?: number | null;
  max_reservations_total?: number | null;
  max_report_exports_daily?: number | null;
  max_storage_mb?: number | null;
}

export interface TenantQuotaSettings {
  max_location_count?: number | null;
  max_storage_count?: number | null;
  max_user_count?: number | null;
  max_reservation_count?: number | null;
}

export interface TenantFinancialSettings {
  commission_rate?: number;
}

export interface TenantFeatureFlags {
  ai_enabled?: boolean;
  advanced_reports_enabled?: boolean;
  payment_gateway_enabled?: boolean;
}

export interface TenantMetadata {
  quotas: TenantQuotaSettings;
  financial: TenantFinancialSettings;
  features: TenantFeatureFlags;
}

export interface TenantMetadataUpdate {
  quotas?: TenantQuotaSettings;
  financial?: TenantFinancialSettings;
  features?: TenantFeatureFlags;
}

export const adminTenantService = {
  async list(): Promise<Tenant[]> {
    const response = await http.get<Tenant[]>("/admin/tenants");
    return response.data;
  },
  async create(payload: TenantCreatePayload): Promise<Tenant> {
    const response = await http.post<Tenant>("/admin/tenants", payload);
    return response.data;
  },
  async update(id: string, payload: TenantUpdatePayload): Promise<Tenant> {
    const response = await http.patch<Tenant>(`/admin/tenants/${id}`, payload);
    return response.data;
  },
  async detail(id: string): Promise<TenantDetail> {
    const response = await http.get<TenantDetail>(`/admin/tenants/${id}/detail`);
    return response.data;
  },
  async updatePlanLimits(id: string, payload: TenantPlanLimitsUpdatePayload): Promise<TenantDetail> {
    const response = await http.patch<TenantDetail>(`/admin/tenants/${id}/plan-limits`, payload);
    return response.data;
  },
  async getMetadata(id: string): Promise<TenantMetadata> {
    const response = await http.get<TenantMetadata>(`/admin/tenants/${id}/metadata`);
    return response.data;
  },
  async updateMetadata(id: string, payload: TenantMetadataUpdate): Promise<TenantMetadata> {
    const response = await http.patch<TenantMetadata>(`/admin/tenants/${id}/metadata`, payload);
    return response.data;
  },
};
