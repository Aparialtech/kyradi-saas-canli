import { http } from "../../lib/http";

export type LockerStatus = "idle" | "occupied" | "reserved" | "faulty";

export interface Locker {
  id: string;
  location_id: string;
  code: string;
  status: LockerStatus;
  last_seen_at?: string | null;
  created_at: string;
}

export interface LockerPayload {
  location_id: string;
  code: string;
  status: LockerStatus;
}

export const lockerService = {
  async list(status?: LockerStatus): Promise<Locker[]> {
    const response = await http.get<Locker[]>("/lockers", { params: status ? { status } : undefined });
    return response.data;
  },
  async create(payload: LockerPayload): Promise<Locker> {
    const response = await http.post<Locker>("/lockers", payload);
    return response.data;
  },
  async update(id: string, payload: Partial<LockerPayload>): Promise<Locker> {
    const response = await http.patch<Locker>(`/lockers/${id}`, payload);
    return response.data;
  },
  async remove(id: string): Promise<void> {
    await http.delete(`/lockers/${id}`);
  },
};
