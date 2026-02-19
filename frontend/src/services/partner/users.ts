import { http } from "../../lib/http";
import type { UserRole } from "../../types/auth";

export type Gender = "male" | "female" | "other";

export interface TenantUser {
  id: string;
  email: string;
  tenant_id?: string | null;
  role: UserRole;
  is_active: boolean;
  full_name?: string | null;
  phone_number?: string | null;
  birth_date?: string | null;
  tc_identity_number?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  gender?: Gender | null;
  last_login_at?: string | null;
  created_at: string;
}

export interface TenantUserCreate {
  email: string;
  password?: string;
  role: UserRole;
  is_active?: boolean;
  full_name?: string;
  phone_number?: string;
  birth_date?: string;
  tc_identity_number?: string;
  city?: string;
  district?: string;
  address?: string;
  gender?: Gender;
  auto_generate_password?: boolean;
}

export interface TenantUserUpdate {
  password?: string;
  role?: UserRole;
  is_active?: boolean;
  full_name?: string | null;
  phone_number?: string | null;
  birth_date?: string | null;
  tc_identity_number?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  gender?: Gender | null;
}

export interface TenantUserCreatePayload {
  email: string;
  password?: string;
  role: UserRole;
  is_active: boolean;
  full_name?: string;
  phone_number?: string;
  birth_date?: string;
  tc_identity_number?: string;
  city?: string;
  district?: string;
  address?: string;
  gender?: Gender;
  auto_generate_password?: boolean;
}

export interface TenantUserUpdatePayload {
  password?: string;
  role?: UserRole;
  is_active?: boolean;
  full_name?: string | null;
  phone_number?: string | null;
  birth_date?: string | null;
  tc_identity_number?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  gender?: Gender | null;
}

export interface PaginatedUsersResponse {
  items: TenantUser[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface UserListParams {
  page?: number;
  page_size?: number;
  search?: string;
}

export const tenantUserService = {
  async list(): Promise<TenantUser[]> {
    // For backward compatibility, return items array without params
    const response = await http.get<PaginatedUsersResponse>("/users");
    return response.data.items;
  },
  async listWithParams(params?: UserListParams): Promise<TenantUser[]> {
    const response = await http.get<PaginatedUsersResponse>("/users", { params });
    return response.data.items;
  },
  async listPaginated(params?: UserListParams): Promise<PaginatedUsersResponse> {
    const response = await http.get<PaginatedUsersResponse>("/users", { params });
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
    const response = await http.get<PaginatedUsersResponse>("/users");
    return response.data.items;
  },
  async listWithParams(params?: UserListParams): Promise<TenantUser[]> {
    const response = await http.get<PaginatedUsersResponse>("/users", { params });
    return response.data.items;
  },
  async listPaginated(params?: UserListParams): Promise<PaginatedUsersResponse> {
    const response = await http.get<PaginatedUsersResponse>("/users", { params });
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
