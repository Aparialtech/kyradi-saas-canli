import { http } from "../../lib/http";

export interface PricingRule {
  id: string;
  tenant_id: string | null;
  pricing_type: "hourly" | "daily" | "weekly" | "monthly";
  price_per_hour_minor: number;
  price_per_day_minor: number;
  price_per_week_minor: number;
  price_per_month_minor: number;
  minimum_charge_minor: number;
  currency: string;
  is_active: boolean;
  priority: number;
  notes: string | null;
  created_at: string;
}

export interface PricingRuleCreate {
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
}

export interface PricingRuleUpdate {
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

export const pricingService = {
  async list(): Promise<PricingRule[]> {
    const response = await http.get<PricingRule[]>("/pricing");
    return response.data;
  },

  async get(id: string): Promise<PricingRule> {
    const response = await http.get<PricingRule>(`/pricing/${id}`);
    return response.data;
  },

  async create(payload: PricingRuleCreate): Promise<PricingRule> {
    const response = await http.post<PricingRule>("/pricing", payload);
    return response.data;
  },

  async update(id: string, payload: PricingRuleUpdate): Promise<PricingRule> {
    const response = await http.patch<PricingRule>(`/pricing/${id}`, payload);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await http.delete(`/pricing/${id}`);
  },
};

