import { http } from "../../lib/http";

export interface SelfServiceLookupPayload {
  code: string;
}

export interface SelfServiceReservation {

  reservation_id?: string | null;
  tenant_slug?: string | null;
  locker_code?: string | null;
  location_name?: string | null;
  status: string;
  start_at?: string | null;
  end_at?: string | null;
  customer_hint?: string | null;
  customer_phone?: string | null;
  baggage_count?: number | null;
  baggage_type?: string | null;
  notes?: string | null;
  evidence_url?: string | null;
  handover_by?: string | null;
  handover_at?: string | null;
  returned_by?: string | null;
  returned_at?: string | null;
  valid: boolean;
}

export interface SelfServiceReservationCreatePayload {
  tenant_slug: string;
  locker_code: string;
  start_at: string;
  end_at: string;
  customer_name?: string;
  customer_phone?: string;
  baggage_count?: number;
  baggage_type?: string;
  weight_kg?: number;
  notes?: string;
}

export interface SelfServiceReservationCreateResponse {
  reservation_id: string;
  qr_code: string;
  status: string;
  locker_code: string;
  start_at: string;
  end_at: string;
}

export interface SelfServiceHandoverPayload {
  handover_by?: string;
  handover_at?: string;
  evidence_url?: string;
  notes?: string;
}

export interface SelfServiceReturnPayload {
  returned_by?: string;
  returned_at?: string;
  evidence_url?: string;
  notes?: string;
}

export const selfServiceReservationService = {
  async lookup(payload: SelfServiceLookupPayload): Promise<SelfServiceReservation> {
    const response = await http.post<SelfServiceReservation>("/public/reservations/lookup", payload);
    return response.data;
  },
  async create(payload: SelfServiceReservationCreatePayload): Promise<SelfServiceReservationCreateResponse> {
    const response = await http.post<SelfServiceReservationCreateResponse>("/public/reservations", payload);
    return response.data;
  },
  async handover(code: string, payload: SelfServiceHandoverPayload): Promise<SelfServiceReservation> {
    const response = await http.post<SelfServiceReservation>(`/public/reservations/${code}/handover`, payload);
    return response.data;
  },
  async confirmReturn(code: string, payload: SelfServiceReturnPayload): Promise<SelfServiceReservation> {
    const response = await http.post<SelfServiceReservation>(`/public/reservations/${code}/return`, payload);
    return response.data;
  },
};
