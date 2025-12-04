import { http } from "../../lib/http";

export interface Reservation {
  id: string | number;
  status: string; // "reserved" | "active" | "completed" | "cancelled" | "no_show"
  tenant_id: string;
  checkin_date?: string | null;  // Legacy: date only
  checkout_date?: string | null;  // Legacy: date only
  start_at?: string | null;  // ISO datetime string
  end_at?: string | null;  // ISO datetime string
  start_datetime?: string | null;  // ISO datetime string (alias)
  end_datetime?: string | null;  // ISO datetime string (alias)
  duration_hours?: number | null;
  hourly_rate?: number | null;  // In minor currency units
  estimated_total_price?: number | null;  // In minor currency units
  amount_minor?: number | null;  // In minor currency units
  currency?: string | null;
  baggage_count?: number | null;
  luggage_count?: number | null;  // Alias
  locker_size?: string | null;
  guest_name?: string | null;
  full_name?: string | null;
  customer_name?: string | null;  // Alternative field
  guest_email?: string | null;
  customer_email?: string | null;  // Alternative field
  guest_phone?: string | null;
  phone_number?: string | null;  // Alias for guest_phone
  customer_phone?: string | null;  // Alternative field
  tc_identity_number?: string | null;  // TC Kimlik No - Sensitive data
  passport_number?: string | null;
  hotel_room_number?: string | null;
  luggage_type?: string | null;  // Cabin, Medium, Large, Backpack, Other
  luggage_description?: string | null;
  storage_id?: string | null;
  storage_code?: string | null;
  location_id?: string | null;
  location_name?: string | null;
  notes?: string | null;
  origin?: string | null;
  kvkk_approved?: boolean | null;
  kvkk_consent?: boolean | null;
  terms_consent?: boolean | null;
  disclosure_consent?: boolean | null;
  created_at: string;
  handover_at?: string | null;
  handover_by?: string | null;
  returned_at?: string | null;
  returned_by?: string | null;
  payment?: Payment | null;
}

export interface Payment {
  id: string;
  status: string;
  amount_minor: number;
  currency: string;
  provider?: string;
  mode?: string;
  transaction_id?: string | null;
  paid_at?: string | null;
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
  
  // New operational endpoints for partner panel
  async completeReservation(id: string): Promise<{ id: string; status: string }> {
    const response = await http.post<{ id: string; status: string }>(`/reservations/${id}/complete`);
    return response.data;
  },
  
  async cancelReservation(id: string): Promise<{ id: string; status: string }> {
    const response = await http.post<{ id: string; status: string }>(`/reservations/${id}/cancel`);
    return response.data;
  },
  
  async ensurePayment(id: string): Promise<Payment> {
    const response = await http.post<Payment>(`/reservations/${id}/ensure-payment`);
    return response.data;
  },
  
  // Get single reservation details
  async getById(id: string): Promise<Reservation> {
    const response = await http.get<Reservation>(`/reservations/${id}`);
    return response.data;
  },
};
