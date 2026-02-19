import { http } from "../../lib/http";

export interface CheckoutSessionCreate {
  reservation_id: string;
}

export interface CheckoutSessionResponse {
  payment_id: string;
  session_id: string;
  checkout_url: string;
  amount_minor: number;
  currency: string;
  expires_at?: number | null;
}

export interface DemoCompleteRequest {
  result: "success" | "failed";
}

export interface DemoCompleteResponse {
  ok: boolean;
  message: string;
  payment_id: string;
  payment_status: string;
  settlement_id?: string | null;
  settlement_status?: string | null;
  total_amount?: number | null;
  tenant_settlement?: number | null;
  kyradi_commission?: number | null;
}

export interface PaymentInfo {
  payment_id: string;
  session_id: string;
  amount_minor: number;
  currency: string;
  status: string;
  reservation?: {
    id: string;
    customer_name: string | null;
    storage_id: string;
  } | null;
  tenant?: {
    id: string;
    name: string;
  } | null;
}

const DEMO_CHECKOUT_PATH = /\/payments\/magicpay\/demo\/([^/?#]+)/i;

export function normalizeMagicPayCheckoutUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  if (typeof window === "undefined") return rawUrl;

  const parsed = new URL(rawUrl, window.location.origin);
  const match = parsed.pathname.match(DEMO_CHECKOUT_PATH);

  if (match?.[1]) {
    return `${window.location.origin}/app/magicpay/demo/${match[1]}`;
  }

  // Keep existing behavior for already-correct app routes or external URLs.
  return parsed.toString();
}

export const magicpayService = {
  async createCheckoutSession(reservationId: string): Promise<CheckoutSessionResponse> {
    const response = await http.post<CheckoutSessionResponse>(
      "/payments/magicpay/checkout-session",
      { reservation_id: reservationId }
    );
    return {
      ...response.data,
      checkout_url: normalizeMagicPayCheckoutUrl(response.data.checkout_url),
    };
  },

  async completeDemoPayment(sessionId: string, result: "success" | "failed"): Promise<DemoCompleteResponse> {
    const response = await http.post<DemoCompleteResponse>(
      `/payments/magicpay/demo/${sessionId}/complete`,
      { result }
    );
    return response.data;
  },

  async getPaymentInfo(sessionId: string): Promise<PaymentInfo> {
    const response = await http.get<PaymentInfo>(`/payments/magicpay/demo/${sessionId}`);
    return response.data;
  },
};
