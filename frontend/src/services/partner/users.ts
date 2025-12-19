import { http } from "../../lib/http";
import type { UserRole } from "../../types/auth";

export interface TenantUser {
  id: string;
  name: string;
  email: string;
  tenant_id?: string | null;
  role: UserRole;
  is_active: boolean;
  phone_number?: string | null;
  last_login_at?: string | null;
  created_at: string;
}

export interface TenantUserCreate {
  name: string;
  email: string;
  phone_number?: string;
  role: string;
  is_active?: boolean;
}

export interface TenantUserUpdate {
  name?: string;
  email?: string;
  phone_number?: string;
  role?: string;
  is_active?: boolean;
}

export interface TenantUserCreatePayload {
  email: string;
  password: string;
  role: UserRole;
  is_active: boolean;
}

export interface TenantUserUpdatePayload {
  password?: string;
  role?: UserRole;
  is_active?: boolean;
  phone_number?: string | null;
}

export const tenantUserService = {
  async list(): Promise<TenantUser[]> {
    const response = await http.get<TenantUser[]>("/users");
    return response.data;
  },
  async create(payload: TenantUserCreatePayload): Promise<TenantUser> {
    const response = await http.post<TenantUser>("/users", payload);
    return response.data;
  },
  async update(id: string, payload: TenantUserUpdatePayload): Promise<TenantUser> {
    const response = await http.patch<TenantUser>(`/users/${id}`, payload);
    return response.data;
  },
  async deactivate(id: string): Promise<void> {
    await http.delete(`/users/${id}`);
  },
};

// Alias for new API
export const userService = {
  async list(): Promise<TenantUser[]> {
    const response = await http.get<TenantUser[]>("/users");
    return response.data;
  },
  async get(id: string): Promise<TenantUser> {
    const response = await http.get<TenantUser>(`/users/${id}`);
    return response.data;
  },
  async create(payload: TenantUserCreate): Promise<TenantUser> {
    const response = await http.post<TenantUser>("/users", payload);
    return response.data;
  },
  async update(id: string, payload: TenantUserUpdate): Promise<TenantUser> {
    const response = await http.patch<TenantUser>(`/users/${id}`, payload);
    return response.data;
  },
  async remove(id: string): Promise<void> {
    await http.delete(`/users/${id}`);
  },
};
