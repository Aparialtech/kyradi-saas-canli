import { http } from "../../lib/http";

export interface SimulatePaymentResponse {
  ok: boolean;
  message: string;
  payment_id: string;
  payment_status: string;
  settlement_id: string;
  settlement_status: string;
  total_amount: number;
  tenant_settlement: number;
  kyradi_commission: number;
}

export interface ConvertWidgetReservationResponse {
  ok: boolean;
  message: string;
  widget_reservation_id: number;
  reservation_id: string;
  storage_id: string;
  status: string;
}

export interface Storage {
  id: string;
  code: string;
  location_id: string;
  status: string;
  created_at: string;
}

export const demoService = {
  async simulatePayment(paymentIntentId: string): Promise<SimulatePaymentResponse> {
    const response = await http.post<SimulatePaymentResponse>(
      `/demo/payments/${paymentIntentId}/simulate`
    );
    return response.data;
  },

  async getAvailableStorages(
    startAt: string,
    endAt: string,
    preferredLocationId?: string
  ): Promise<Storage[]> {
    const params: Record<string, string> = {
      start_at: startAt,
      end_at: endAt,
    };
    if (preferredLocationId) {
      params.preferred_location_id = preferredLocationId;
    }
    const response = await http.get<Storage[]>("/demo/available-storages", { params });
    return response.data;
  },

  async convertWidgetReservation(
    widgetReservationId: number,
    storageId?: string,
    preferredLocationId?: string
  ): Promise<ConvertWidgetReservationResponse> {
    const response = await http.post<ConvertWidgetReservationResponse>(
      `/demo/widget-reservations/${widgetReservationId}/convert`,
      {
        storage_id: storageId,
        preferred_location_id: preferredLocationId,
      }
    );
    return response.data;
  },
};

