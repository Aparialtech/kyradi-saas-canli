import { http } from "../../lib/http";

export type StorageStatus = "idle" | "occupied" | "reserved" | "faulty";

export interface DayHours {
  open: string;
  close: string;
  is_open: boolean;
}

export interface WorkingHours {
  monday?: DayHours;
  tuesday?: DayHours;
  wednesday?: DayHours;
  thursday?: DayHours;
  friday?: DayHours;
  saturday?: DayHours;
  sunday?: DayHours;
}

export interface Storage {
  id: string;
  location_id: string;
  code: string;
  status: StorageStatus;
  last_seen_at?: string | null;
  created_at: string;
  working_hours?: WorkingHours | null;
}

export interface StoragePayload {
  location_id: string;
  code: string;
  status: StorageStatus;
  working_hours?: WorkingHours | null;
}

export interface StorageCalendarDay {
  date: string;
  status: "free" | "occupied";
  reservation_ids: string[];
}

export interface StorageCalendarResponse {
  storage_id: string;
  storage_code: string;
  start_date: string;
  end_date: string;
  days: StorageCalendarDay[];
}

export const storageService = {
  async list(status?: StorageStatus): Promise<Storage[]> {
    const response = await http.get<Storage[]>("/storages", { params: status ? { status } : undefined });
    return response.data;
  },
  async get(id: string): Promise<Storage> {
    const response = await http.get<Storage>(`/storages/${id}`);
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
  async getCalendar(id: string, startDate: string, endDate: string): Promise<StorageCalendarResponse> {
    const response = await http.get<StorageCalendarResponse>(`/storages/${id}/calendar`, {
      params: { start_date: startDate, end_date: endDate },
    });
    return response.data;
  },
};

// Backward compatibility
export type LockerStatus = StorageStatus;
export interface Locker extends Storage {}
export interface LockerPayload extends StoragePayload {}
export const lockerService = storageService;

