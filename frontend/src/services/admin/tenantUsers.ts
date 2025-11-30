import { http } from "../../lib/http";
import type { UserRole } from "../../types/auth";

export interface AdminTenantUser {
  id: string;
  email: string;
  tenant_id?: string | null;
  role: UserRole;
  is_active: boolean;
  last_login_at?: string | null;
  created_at: string;
}

export interface AdminTenantUserCreatePayload {
  email: string;
  password: string;
  role: UserRole;
  is_active: boolean;
}

export interface AdminTenantUserUpdatePayload {
  password?: string;
  role?: UserRole;
  is_active?: boolean;
}

export interface AdminTenantUserResetPayload {
  password: string;
}

export const adminTenantUserService = {
  async list(tenantId: string): Promise<AdminTenantUser[]> {
    const response = await http.get<AdminTenantUser[]>(`/admin/tenants/${tenantId}/users`);
    return response.data;
  },
  async create(tenantId: string, payload: AdminTenantUserCreatePayload): Promise<AdminTenantUser> {
    const response = await http.post<AdminTenantUser>(`/admin/tenants/${tenantId}/users`, payload);
    return response.data;
  },
  async update(
    tenantId: string,
    userId: string,
    payload: AdminTenantUserUpdatePayload,
  ): Promise<AdminTenantUser> {
    const response = await http.patch<AdminTenantUser>(
      `/admin/tenants/${tenantId}/users/${userId}`,
      payload,
    );
    return response.data;
  },
  async resetPassword(
    tenantId: string,
    userId: string,
    payload: AdminTenantUserResetPayload,
  ): Promise<AdminTenantUser> {
    const response = await http.post<AdminTenantUser>(
      `/admin/tenants/${tenantId}/users/${userId}/reset-password`,
      payload,
    );
    return response.data;
  },
};
