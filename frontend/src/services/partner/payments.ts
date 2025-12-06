import { http } from "../../lib/http";

export interface PaymentIntentPayload {
  reservation_id: string;
  provider: string;
}

export interface Payment {
  id: string;
  reservation_id: string;
  provider: string;
  provider_intent_id?: string;
  status: string;
  amount_minor: number;
  currency: string;
  created_at: string;
}

export interface ConfirmPosResponse {
  ok: boolean;
  message: string;
  payment_id: string;
  payment_status: string;
  paid_at?: string | null;
  transaction_id?: string | null;
  settlement_id?: string | null;
  settlement_status?: string | null;
  total_amount?: number | null;
  tenant_settlement?: number | null;
  kyradi_commission?: number | null;
}

export interface ConfirmCashResponse {
  ok: boolean;
  message: string;
  payment_id: string;
  payment_status: string;
  payment_mode: string;
  paid_at?: string | null;
  settlement_id?: string | null;
  amount_minor: number;
  currency: string;
}

export interface CheckoutSessionCreate {
  reservation_id: string;
}

export interface CheckoutSessionResponse {
  payment_id: string;
  session_id: string;
  checkout_url: string;
  amount_minor: number;
  currency: string;
  expires_at?: string | null;
}

export const paymentService = {
  async createIntent(payload: PaymentIntentPayload): Promise<Payment> {
    const response = await http.post<Payment>("/payments/create-intent", payload);
    return response.data;
  },

  async confirmPos(paymentId: string): Promise<ConfirmPosResponse> {
    const response = await http.post<ConfirmPosResponse>(`/payments/${paymentId}/confirm-pos`);
    return response.data;
  },

  async confirmCash(paymentId: string): Promise<ConfirmCashResponse> {
    const response = await http.post<ConfirmCashResponse>(`/payments/${paymentId}/confirm-cash`);
    return response.data;
  },

  /**
   * Create MagicPay checkout session for a reservation
   * Returns checkout URL to redirect user to payment page
   */
  async createCheckoutSession(payload: CheckoutSessionCreate): Promise<CheckoutSessionResponse> {
    const response = await http.post<CheckoutSessionResponse>("/payments/magicpay/checkout-session", payload);
    return response.data;
  },
};
