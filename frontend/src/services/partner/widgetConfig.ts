import { http } from "../../lib/http";

export interface WidgetConfig {
  tenant_id: string;
  widget_public_key: string;
}

export const partnerWidgetService = {
  async getWidgetConfig(): Promise<WidgetConfig> {
    const response = await http.get<WidgetConfig>("/partners/widget-config");
    return response.data;
  },
};
