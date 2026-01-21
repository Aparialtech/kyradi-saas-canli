import { http } from "../../lib/http";

export interface PartnerSettings {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  custom_domain?: string | null;
  domain_status?: string | null;
  legal_name?: string | null;
  tax_id?: string | null;
  tax_office?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  brand_color?: string | null;
  logo_url?: string | null;
  notification_email?: string | null;
  notification_sms: boolean;
  widget_enabled: boolean;
  widget_public_key?: string | null;
  payment_mode: string;
  commission_rate: number;
}

export interface PartnerSettingsUpdatePayload {
  tenant_name?: string;
  legal_name?: string;
  tax_id?: string;
  tax_office?: string;
  contact_email?: string;
  contact_phone?: string;
  brand_color?: string;
  logo_url?: string;
  notification_email?: string;
  notification_sms?: boolean;
  custom_domain?: string | null;
}

export const partnerSettingsService = {
  /**
   * Get current partner (tenant) settings
   */
  async getSettings(): Promise<PartnerSettings> {
    const response = await http.get<PartnerSettings>("/partners/settings");
    return response.data;
  },

  /**
   * Update partner (tenant) settings
   */
  async updateSettings(payload: PartnerSettingsUpdatePayload): Promise<PartnerSettings> {
    const response = await http.patch<PartnerSettings>("/partners/settings", payload);
    return response.data;
  },

  async verifyDomain(): Promise<PartnerSettings> {
    const response = await http.post<PartnerSettings>("/partners/settings/verify-domain");
    return response.data;
  },
};
