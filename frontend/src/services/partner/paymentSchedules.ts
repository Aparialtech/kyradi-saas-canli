import { http } from "../../lib/http";

export type PaymentPeriod = "daily" | "weekly" | "biweekly" | "monthly" | "custom";
export type TransferStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

export interface PaymentSchedule {
  id: string;
  tenant_id: string;
  is_enabled: boolean;
  period_type: PaymentPeriod;
  custom_days?: number;
  min_transfer_amount: number;
  commission_rate: number;
  bank_name?: string;
  bank_account_holder?: string;
  bank_iban?: string;
  bank_swift?: string;
  next_payment_date?: string;
  last_payment_date?: string;
  partner_can_request: boolean;
  admin_notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface PaymentTransfer {
  id: string;
  tenant_id: string;
  schedule_id?: string;
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
  status: TransferStatus;
  transfer_date?: string;
  reference_id?: string;
  period_start?: string;
  period_end?: string;
  bank_name?: string;
  bank_account_holder?: string;
  bank_iban?: string;
  is_manual_request: boolean;
  notes?: string;
  error_message?: string;
  created_at: string;
  updated_at?: string;
}

export interface PartnerBalanceInfo {
  available_balance: number;
  pending_transfers: number;
  total_transferred: number;
  next_scheduled_date?: string;
  can_request_transfer: boolean;
  min_transfer_amount: number;
}

export interface PaymentScheduleCreate {
  tenant_id: string;
  is_enabled?: boolean;
  period_type?: PaymentPeriod;
  custom_days?: number;
  min_transfer_amount?: number;
  commission_rate?: number;
  bank_name?: string;
  bank_account_holder?: string;
  bank_iban?: string;
  bank_swift?: string;
  partner_can_request?: boolean;
  admin_notes?: string;
}

export interface PaymentScheduleUpdate {
  is_enabled?: boolean;
  period_type?: PaymentPeriod;
  custom_days?: number;
  min_transfer_amount?: number;
  commission_rate?: number;
  bank_name?: string;
  bank_account_holder?: string;
  bank_iban?: string;
  bank_swift?: string;
  partner_can_request?: boolean;
  admin_notes?: string;
}

export interface TransferListResponse {
  data: PaymentTransfer[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface TransferRequest {
  gross_amount: number;
  notes?: string;
}

export const paymentScheduleService = {
  // Partner endpoints
  async getMySchedule(): Promise<PaymentSchedule | null> {
    const response = await http.get<PaymentSchedule | null>("/payment-schedules");
    return response.data;
  },

  async getBalance(): Promise<PartnerBalanceInfo> {
    const response = await http.get<PartnerBalanceInfo>("/payment-schedules/balance");
    return response.data;
  },

  async listMyTransfers(params: { status?: TransferStatus; page?: number; pageSize?: number } = {}): Promise<TransferListResponse> {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.append("status", params.status);
    if (params.page) searchParams.append("page", params.page.toString());
    if (params.pageSize) searchParams.append("page_size", params.pageSize.toString());
    
    const response = await http.get<TransferListResponse>(`/payment-schedules/transfers?${searchParams.toString()}`);
    return response.data;
  },

  async requestTransfer(payload: TransferRequest): Promise<PaymentTransfer> {
    const response = await http.post<PaymentTransfer>("/payment-schedules/transfers/request", payload);
    return response.data;
  },

  // Admin endpoints
  async adminListAllSchedules(): Promise<PaymentSchedule[]> {
    const response = await http.get<PaymentSchedule[]>("/payment-schedules/admin/all");
    return response.data;
  },

  async adminCreateSchedule(payload: PaymentScheduleCreate): Promise<PaymentSchedule> {
    const response = await http.post<PaymentSchedule>("/payment-schedules/admin", payload);
    return response.data;
  },

  async adminGetSchedule(tenantId: string): Promise<PaymentSchedule> {
    const response = await http.get<PaymentSchedule>(`/payment-schedules/admin/${tenantId}`);
    return response.data;
  },

  async adminUpdateSchedule(scheduleId: string, payload: PaymentScheduleUpdate): Promise<PaymentSchedule> {
    const response = await http.patch<PaymentSchedule>(`/payment-schedules/admin/${scheduleId}`, payload);
    return response.data;
  },

  async adminListAllTransfers(params: { status?: TransferStatus; tenantId?: string; page?: number; pageSize?: number } = {}): Promise<TransferListResponse> {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.append("status", params.status);
    if (params.tenantId) searchParams.append("tenant_id", params.tenantId);
    if (params.page) searchParams.append("page", params.page.toString());
    if (params.pageSize) searchParams.append("page_size", params.pageSize.toString());
    
    const response = await http.get<TransferListResponse>(`/payment-schedules/admin/transfers/all?${searchParams.toString()}`);
    return response.data;
  },

  async adminProcessTransfer(transferId: string, payload: { status?: TransferStatus; reference_id?: string; notes?: string; error_message?: string }): Promise<PaymentTransfer> {
    const response = await http.patch<PaymentTransfer>(`/payment-schedules/admin/transfers/${transferId}`, payload);
    return response.data;
  },
};
