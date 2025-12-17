import { http } from "../../lib/http";

/**
 * Pricing scope types:
 * - GLOBAL: System-wide default (fallback)
 * - TENANT: Tenant-specific default
 * - LOCATION: Location-specific pricing
 * - STORAGE: Storage-specific pricing (highest priority)
 */
export type PricingScope = "GLOBAL" | "TENANT" | "LOCATION" | "STORAGE";

export interface PricingRule {
  id: string;
  tenant_id?: string | null;
  // Hierarchical scope
  scope: PricingScope;
  location_id?: string | null;
  storage_id?: string | null;
  name?: string | null;
  // Resolved names for UI display
  location_name?: string | null;
  storage_code?: string | null;
  // Pricing configuration
  pricing_type: "hourly" | "daily" | "weekly" | "monthly";
  price_per_hour_minor: number;
  price_per_day_minor: number;
  price_per_week_minor: number;
  price_per_month_minor: number;
  minimum_charge_minor: number;
  currency: string;
  is_active: boolean;
  priority: number;
  notes?: string | null;
  created_at: string;
}

export interface PricingRulePayload {
  // Hierarchical scope
  scope?: PricingScope;
  location_id?: string | null;
  storage_id?: string | null;
  name?: string | null;
  // Pricing configuration
  pricing_type?: "hourly" | "daily" | "weekly" | "monthly";
  price_per_hour_minor?: number;
  price_per_day_minor?: number;
  price_per_week_minor?: number;
  price_per_month_minor?: number;
  minimum_charge_minor?: number;
  currency?: string;
  is_active?: boolean;
  priority?: number;
  notes?: string | null;
}

// Alias for backward compatibility
export type PricingRuleCreate = PricingRulePayload;

export interface PriceEstimateRequest {
  start_datetime: string;
  end_datetime: string;
  baggage_count?: number;
  location_id?: string | null;
  storage_id?: string | null;
}

export interface PriceEstimateResponse {
  total_minor: number;
  total_formatted: string;
  duration_hours: number;
  duration_days: number;
  hourly_rate_minor: number;
  daily_rate_minor: number;
  pricing_type: string;
  currency: string;
  baggage_count: number;
  rule_id?: string | null;
  rule_scope?: string | null;
}

export const pricingService = {
  async list(): Promise<PricingRule[]> {
    const response = await http.get<PricingRule[]>("/pricing");
    return response.data;
  },

  async create(payload: PricingRulePayload): Promise<PricingRule> {
    const response = await http.post<PricingRule>("/pricing", payload);
    return response.data;
  },

  async update(id: string, payload: PricingRulePayload): Promise<PricingRule> {
    const response = await http.patch<PricingRule>(`/pricing/${id}`, payload);
    return response.data;
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/pricing/${id}`);
  },

  // Alias for backward compatibility
  async delete(id: string): Promise<void> {
    await http.delete(`/pricing/${id}`);
  },

  /**
   * Get price estimate for a reservation
   */
  async estimate(params: PriceEstimateRequest): Promise<PriceEstimateResponse> {
    const response = await http.post<PriceEstimateResponse>("/pricing/estimate", params);
    return response.data;
  },
};
