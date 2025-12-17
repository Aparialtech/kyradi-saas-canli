import { http } from "../../lib/http";

export interface Staff {
  id: string;
  tenant_id: string;
  user_id: string;
  assigned_storage_ids: string[];
  assigned_location_ids: string[];
  created_at: string;
}

export interface StaffPayload {
  user_id: string;
  storage_ids?: string[];
  location_ids?: string[];
}

export const staffService = {
  async list(): Promise<Staff[]> {
    const response = await http.get<Staff[]>("/staff");
    return response.data;
  },

  async create(payload: StaffPayload): Promise<Staff> {
    const response = await http.post<Staff>("/staff", payload);
    return response.data;
  },

  async update(id: string, payload: Partial<StaffPayload>): Promise<Staff> {
    const response = await http.patch<Staff>(`/staff/${id}`, payload);
    return response.data;
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/staff/${id}`);
  },
};

