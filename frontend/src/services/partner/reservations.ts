import { http } from "../../lib/http";

export interface Reservation {
  id: number;
  status: string; // "reserved" | "active" | "completed" | "cancelled" | "no_show"
  tenant_id: string;
  checkin_date?: string | null;  // Legacy: date only
  checkout_date?: string | null;  // Legacy: date only
  start_datetime?: string | null;  // ISO datetime string
  end_datetime?: string | null;  // ISO datetime string
  duration_hours?: number | null;
  hourly_rate?: number | null;  // In minor currency units
  estimated_total_price?: number | null;  // In minor currency units
  baggage_count?: number | null;
  luggage_count?: number | null;  // Alias
  locker_size?: string | null;
  guest_name?: string | null;
  full_name?: string | null;
  guest_email?: string | null;
  guest_phone?: string | null;
  phone_number?: string | null;  // Alias for guest_phone
  tc_identity_number?: string | null;  // TC Kimlik No - Sensitive data
  passport_number?: string | null;
  hotel_room_number?: string | null;
  luggage_type?: string | null;  // Cabin, Medium, Large, Backpack, Other
  luggage_description?: string | null;
  storage_id?: string | null;
  notes?: string | null;
  origin?: string | null;
  kvkk_approved?: boolean | null;
  kvkk_consent?: boolean | null;
  terms_consent?: boolean | null;
  disclosure_consent?: boolean | null;
  created_at: string;
}

export interface ReservationListResponse {
  items: Reservation[];
}

export const reservationService = {
  async list(params?: { status?: string; from?: string; to?: string; domain?: string }): Promise<Reservation[]> {
    const response = await http.get<ReservationListResponse>("/partners/widget-reservations", {
      params: {
        status: params?.status,
        date_from: params?.from,
        date_to: params?.to,
        origin: params?.domain,
      },
    });
    return response.data.items;
  },
  async cancel(id: number): Promise<Reservation> {
    const response = await http.post<Reservation>(`/partners/widget-reservations/${id}/cancel`);
    return response.data;
  },
  async confirm(id: number): Promise<Reservation> {
    const response = await http.post<Reservation>(`/partners/widget-reservations/${id}/confirm`);
    return response.data;
  },
  // New operational endpoints for hourly reservations
  async markLuggageReceived(
    id: string,
    payload?: { handover_by?: string; handover_at?: string; notes?: string },
  ): Promise<Reservation> {
    const response = await http.post<Reservation>(`/reservations/${id}/luggage-received`, payload || {});
    return response.data;
  },
  async markNoShow(id: string, payload?: { notes?: string }): Promise<Reservation> {
    const response = await http.post<Reservation>(`/reservations/${id}/no-show`, payload || {});
    return response.data;
  },
  async markLuggageReturned(
    id: string,
    payload?: { returned_by?: string; returned_at?: string; notes?: string },
  ): Promise<Reservation> {
    const response = await http.post<Reservation>(`/reservations/${id}/luggage-returned`, payload || {});
    return response.data;
  },
  // Legacy helpers (QR akışları için mevcut tutuldu)
  async handover(
    id: string,
    payload: { handover_by?: string; handover_at?: string; evidence_url?: string; notes?: string },
  ) {
    const response = await http.post(`/reservations/${id}/handover`, payload);
    return response.data;
  },
  async markReturned(
    id: string,
    payload: { returned_by?: string; returned_at?: string; evidence_url?: string; notes?: string },
  ) {
    const response = await http.post(`/reservations/${id}/return`, payload);
    return response.data;
  },
};
