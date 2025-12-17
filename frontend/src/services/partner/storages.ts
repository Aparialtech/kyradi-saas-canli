import { http } from "../../lib/http";

export type StorageStatus = "idle" | "occupied" | "reserved" | "faulty";

export interface Storage {
  id: string;
  location_id: string;
  code: string;
  status: StorageStatus;
  last_seen_at?: string | null;
  created_at: string;
}

export interface StoragePayload {
  location_id: string;
  code: string;
  status: StorageStatus;
}

export const storageService = {
  async list(status?: StorageStatus): Promise<Storage[]> {
    const response = await http.get<Storage[]>("/storages", { params: status ? { status } : undefined });
    return response.data;
  },
  async create(payload: StoragePayload): Promise<Storage> {
    const response = await http.post<Storage>("/storages", payload);
    return response.data;
  },
  async update(id: string, payload: Partial<StoragePayload>): Promise<Storage> {
    const response = await http.patch<Storage>(`/storages/${id}`, payload);
    return response.data;
  },
  async remove(id: string): Promise<void> {
    await http.delete(`/storages/${id}`);
  },
};

// Backward compatibility
export type LockerStatus = StorageStatus;
export interface Locker extends Storage {}
export interface LockerPayload extends StoragePayload {}
export const lockerService = storageService;

