import { http } from "../../lib/http";

export type TenantDomainStatus = "PENDING" | "VERIFYING" | "VERIFIED" | "FAILED" | "DISABLED";
export type TenantDomainType = "SUBDOMAIN" | "CUSTOM_DOMAIN";

export interface TenantDomain {
  id: string;
  domain: string;
  domain_type: TenantDomainType;
  status: TenantDomainStatus;
  verification_method: string;
  verification_token?: string | null;
  verification_record_name?: string | null;
  verification_record_value?: string | null;
  last_checked_at?: string | null;
  failure_reason?: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantDomainCreatePayload {
  domain: string;
  domain_type: TenantDomainType;
  is_primary?: boolean;
}

export interface TenantDomainUpdatePayload {
  domain?: string;
  domain_type?: TenantDomainType;
  status?: TenantDomainStatus;
  is_primary?: boolean;
}

export interface TenantDomainVerifyStartResponse {
  status: TenantDomainStatus;
  verification_token: string;
  verification_record_name: string;
  verification_record_value: string;
}

export interface TenantDomainVerifyCheckResponse {
  status: TenantDomainStatus;
  verified: boolean;
  failure_reason?: string | null;
  last_checked_at?: string | null;
}

export const adminTenantDomainService = {
  async listDomains(tenantId: string): Promise<TenantDomain[]> {
    const response = await http.get<TenantDomain[]>(`/admin/tenants/${tenantId}/domains`);
    return response.data;
  },
  async createDomain(tenantId: string, payload: TenantDomainCreatePayload): Promise<TenantDomain> {
    const response = await http.post<TenantDomain>(`/admin/tenants/${tenantId}/domains`, payload);
    return response.data;
  },
  async updateDomain(tenantId: string, domainId: string, payload: TenantDomainUpdatePayload): Promise<TenantDomain> {
    const response = await http.patch<TenantDomain>(`/admin/tenants/${tenantId}/domains/${domainId}`, payload);
    return response.data;
  },
  async deleteDomain(tenantId: string, domainId: string): Promise<void> {
    await http.delete(`/admin/tenants/${tenantId}/domains/${domainId}`);
  },
  async startVerify(tenantId: string, domainId: string): Promise<TenantDomainVerifyStartResponse> {
    const response = await http.post<TenantDomainVerifyStartResponse>(
      `/admin/tenants/${tenantId}/domains/${domainId}/verify/start`
    );
    return response.data;
  },
  async checkVerify(tenantId: string, domainId: string): Promise<TenantDomainVerifyCheckResponse> {
    const response = await http.post<TenantDomainVerifyCheckResponse>(
      `/admin/tenants/${tenantId}/domains/${domainId}/verify/check`
    );
    return response.data;
  },
};
