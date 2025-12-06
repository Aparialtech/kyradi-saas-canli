import { http } from "../../lib/http";

export interface QRVerifyPayload {
  code: string;
}

export interface QRVerifyResult {
  valid: boolean;
  reservation_id?: string;
  locker_id?: string;
  storage_id?: string | null;
  storage_code?: string | null;
  location_id?: string | null;
  location_name?: string | null;
  status?: string;
  status_override?: string;
  customer_name?: string | null;
  full_name?: string | null;
  customer_phone?: string | null;
  phone_number?: string | null;
  customer_email?: string | null;
  tc_identity_number?: string | null;
  passport_number?: string | null;
  hotel_room_number?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  qr_code?: string | null;
  baggage_count?: number | null;
  baggage_type?: string | null;
  weight_kg?: number | null;
  notes?: string | null;
  evidence_url?: string | null;
  handover_by?: string | null;
  handover_at?: string | null;
  returned_by?: string | null;
  returned_at?: string | null;
}

export const qrService = {
  async verify(code: string): Promise<QRVerifyResult> {
    const response = await http.post<QRVerifyResult>("/qr/verify", { code });
    return response.data;
  },
};
