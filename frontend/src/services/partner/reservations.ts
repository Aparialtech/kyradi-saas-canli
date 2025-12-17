import { http } from "../../lib/http";

export interface ManualReservationCreate {
  guest_name: string;
  guest_email?: string;
  guest_phone: string;
  tc_identity_number?: string;
  passport_number?: string;
  hotel_room_number?: string;
  checkin_date?: string;
  checkout_date?: string;
  start_datetime?: string;
  end_datetime?: string;
  baggage_count?: number;
  luggage_type?: string;
  luggage_description?: string;
  locker_size?: string;
  notes?: string;
  amount_minor?: number;
  payment_mode?: "CASH" | "POS" | "GATEWAY_DEMO" | "GATEWAY_LIVE";
}

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
  qr_code?: string | null;
  qr_token?: string | null;  // Alias for qr_code
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

export interface ReservationPaymentInfo {
  payment_id?: string;
  reservation_id?: string;
  status: string;
  amount_minor: number;
  currency: string;
  provider?: string | null;
  mode?: string | null;
  provider_intent_id?: string | null;
  transaction_id?: string | null;
  paid_at?: string | null;
  checkout_url?: string | null;
  meta?: Record<string, unknown> | null;
}

export interface ReservationListResponse {
  items: Reservation[];
}

export const reservationService = {
  async list(params?: { status?: string; from?: string; to?: string }): Promise<Reservation[]> {
    const response = await http.get<Reservation[]>("/reservations", {
      params: {
        status: params?.status,
        from: params?.from,
        to: params?.to,
      },
    });
    return response.data;
  },

  async createManual(payload: ManualReservationCreate): Promise<Reservation> {
    const response = await http.post<Reservation>("/partners/widget-reservations", payload);
    return response.data;
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
  
  // ===========================================
  // UNIFIED ENDPOINTS (auto-detect widget vs normal)
  // Widget reservations: numeric IDs → /partners/widget-reservations/{id}/*
  // Normal reservations: UUID IDs → /reservations/{id}/*
  // ===========================================
  
  /**
   * Check if ID is a widget reservation (numeric) or normal reservation (UUID)
   */
  _isWidgetReservation(id: string | number): boolean {
    const idStr = String(id);
    // UUID is 36 chars with dashes or 32 chars without
    // Widget reservation IDs are numeric (shorter)
    return idStr.length < 20 && /^\d+$/.test(idStr);
  },

  async completeReservation(id: string | number): Promise<{ id: string | number; status: string }> {
    const idStr = String(id);
    if (this._isWidgetReservation(id)) {
      // Widget reservation - use widget endpoint
      const response = await http.post<Reservation>(`/partners/widget-reservations/${idStr}/complete`);
      return { id: response.data.id, status: response.data.status };
    } else {
      // Normal reservation - use standard endpoint
      const response = await http.post<{ id: string; status: string }>(`/reservations/${idStr}/complete`);
      return response.data;
    }
  },
  
  async cancelReservation(id: string | number): Promise<{ id: string | number; status: string }> {
    const idStr = String(id);
    if (this._isWidgetReservation(id)) {
      // Widget reservation - use widget endpoint
      const response = await http.post<Reservation>(`/partners/widget-reservations/${idStr}/cancel`);
      return { id: response.data.id, status: response.data.status };
    } else {
      // Normal reservation - use standard endpoint
      const response = await http.post<{ id: string; status: string }>(`/reservations/${idStr}/cancel`);
      return response.data;
    }
  },
  
  async ensurePayment(id: string | number): Promise<Payment | { id: number; status: string; message: string }> {
    const idStr = String(id);
    if (this._isWidgetReservation(id)) {
      // Widget reservation - use widget endpoint
      const response = await http.post<{ id: number; status: string; payment_status: string; amount_minor: number; currency: string; message: string }>(`/partners/widget-reservations/${idStr}/ensure-payment`);
      return response.data as unknown as Payment;
    } else {
      // Normal reservation - use standard endpoint
      const response = await http.post<Payment>(`/reservations/${idStr}/ensure-payment`);
      return response.data;
    }
  },
  
  // Get single reservation details
  async getById(id: string | number): Promise<Reservation> {
    const idStr = String(id);
    if (this._isWidgetReservation(id)) {
      const response = await http.get<Reservation>(`/partners/widget-reservations/${idStr}`);
      return response.data;
    } else {
      const response = await http.get<Reservation>(`/reservations/${idStr}`);
      return response.data;
    }
  },

  async getPayment(id: string | number): Promise<ReservationPaymentInfo> {
    const idStr = String(id);
    if (this._isWidgetReservation(id)) {
      const response = await http.get<ReservationPaymentInfo>(`/partners/widget-reservations/${idStr}/payment`);
      return response.data;
    } else {
      const response = await http.get<ReservationPaymentInfo>(`/reservations/${idStr}/payment`);
      return response.data;
    }
  },

  // ===========================================
  // PAYMENT OPERATIONS
  // ===========================================

  /**
   * Mark reservation as manually paid
   */
  async markPaid(id: string | number): Promise<Reservation> {
    const idStr = String(id);
    if (this._isWidgetReservation(id)) {
      const response = await http.patch<Reservation>(`/partners/widget-reservations/${idStr}/mark-paid`);
      return response.data;
    } else {
      const response = await http.patch<Reservation>(`/reservations/${idStr}/mark-paid`);
      return response.data;
    }
  },

  /**
   * Create payment for reservation
   */
  async createPayment(id: string | number, payload?: { method?: string; notes?: string }): Promise<Payment> {
    const idStr = String(id);
    if (this._isWidgetReservation(id)) {
      const response = await http.post<Payment>(`/partners/widget-reservations/${idStr}/payments`, payload || {});
      return response.data;
    } else {
      const response = await http.post<Payment>(`/reservations/${idStr}/payments`, payload || {});
      return response.data;
    }
  },

  /**
   * Refund payment for reservation
   */
  async refundPayment(id: string | number, paymentId?: string): Promise<{ success: boolean; message: string }> {
    const idStr = String(id);
    if (this._isWidgetReservation(id)) {
      const response = await http.post<{ success: boolean; message: string }>(`/partners/widget-reservations/${idStr}/refund`);
      return response.data;
    } else {
      const response = await http.post<{ success: boolean; message: string }>(`/payments/${paymentId || idStr}/refund`);
      return response.data;
    }
  },
};
