import { http } from "../../lib/http";

export interface Location {
  id: string;
  name: string;
  address?: string | null;
  phone_number?: string | null;
  working_hours?: Record<string, { open: string; close: string }> | null;
  lat?: number | null;
  lon?: number | null;
  created_at: string;
}

export interface LocationPayload {
  name: string;
  address?: string | null;
  phone_number?: string | null;
  working_hours?: Record<string, { open: string; close: string }> | null;
  lat?: number | null;
  lon?: number | null;
}

export const locationService = {
  async list(): Promise<Location[]> {
    const response = await http.get<Location[]>("/locations");
    return response.data;
  },
  async get(id: string): Promise<Location> {
    const response = await http.get<Location>(`/locations/${id}`);
    return response.data;
  },
  async create(payload: LocationPayload): Promise<Location> {
    const response = await http.post<Location>("/locations", payload);
    return response.data;
  },
  async update(id: string, payload: Partial<LocationPayload>): Promise<Location> {
    const response = await http.patch<Location>(`/locations/${id}`, payload);
    return response.data;
  },
  async remove(id: string): Promise<void> {
    await http.delete(`/locations/${id}`);
  },
};
