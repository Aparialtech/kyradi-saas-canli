/**
 * Public pricing service for price estimates.
 * Used by widget and self-service reservation forms.
 */

import { env } from "../../config/env";

export interface PriceEstimateRequest {
  tenant_id?: string;
  tenant_slug?: string; // Alternative to tenant_id
  start_datetime: string; // ISO string
  end_datetime: string; // ISO string
  baggage_count?: number;
  location_id?: string;
  storage_id?: string;
}

export interface PriceEstimateResponse {
  total_minor: number;
  price_total_minor: number;
  total_formatted: string;
  duration_hours: number;
  duration_days: number;
  hourly_rate_minor: number;
  daily_rate_minor: number;
  pricing_type: string;
  currency: string;
  baggage_count: number;
  rule_scope?: string;
}

class PricingService {
  /**
   * Get price estimate for a reservation (public endpoint, no auth required).
   */
  async estimatePrice(request: PriceEstimateRequest): Promise<PriceEstimateResponse> {
    const base = env.API_URL || "";
    const endpoint = `${base}/demo/public/price-estimate`;
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...(request.tenant_id ? { tenant_id: request.tenant_id } : {}),
        ...(request.tenant_slug ? { tenant_slug: request.tenant_slug } : {}),
        start_datetime: request.start_datetime,
        end_datetime: request.end_datetime,
        baggage_count: request.baggage_count ?? 1,
        location_id: request.location_id,
        storage_id: request.storage_id,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Price calculation failed" }));
      throw new Error(error.detail || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }
}

export const pricingService = new PricingService();
