import { http } from "../../lib/http";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketTarget = "admin" | "partner" | "all";

export interface Ticket {
  id: string;
  title: string;
  message: string;
  status: TicketStatus;
  priority: TicketPriority;
  target: TicketTarget;
  creator_id: string;
  creator_email?: string;
  tenant_id?: string;
  tenant_name?: string;
  resolved_at?: string;
  resolved_by_id?: string;
  resolution_note?: string;
  read_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface TicketCreate {
  title: string;
  message: string;
  priority?: TicketPriority;
  target?: TicketTarget;
}

export interface TicketUpdate {
  title?: string;
  message?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  resolution_note?: string;
}

export interface TicketListResponse {
  items: Ticket[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  unread_count: number;
}

export interface TicketListParams {
  status?: TicketStatus;
  priority?: TicketPriority;
  tenant_id?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export const adminTicketService = {
  async list(params: TicketListParams = {}): Promise<TicketListResponse> {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append("status", params.status);
    if (params.priority) queryParams.append("priority", params.priority);
    if (params.tenant_id) queryParams.append("tenant_id", params.tenant_id);
    if (params.search) queryParams.append("search", params.search);
    if (params.page) queryParams.append("page", String(params.page));
    if (params.pageSize) queryParams.append("page_size", String(params.pageSize));
    
    // Backend uses /tickets/admin/all for admin listing
    const url = `/tickets/admin/all?${queryParams.toString()}`;
    const response = await http.get<TicketListResponse>(url);
    return response.data;
  },

  async get(id: string): Promise<Ticket> {
    const response = await http.get<Ticket>(`/tickets/${id}`);
    return response.data;
  },

  async create(payload: TicketCreate): Promise<Ticket> {
    // Admin creates ticket through the same endpoint
    const response = await http.post<Ticket>("/tickets", payload);
    return response.data;
  },

  async update(id: string, payload: TicketUpdate): Promise<Ticket> {
    const response = await http.patch<Ticket>(`/tickets/${id}`, payload);
    return response.data;
  },

  async resolve(id: string, resolution_note?: string): Promise<Ticket> {
    // Resolve by updating status to resolved
    const response = await http.patch<Ticket>(`/tickets/${id}`, { 
      status: "resolved",
      resolution_note 
    });
    return response.data;
  },

  async close(id: string): Promise<Ticket> {
    // Close by updating status to closed
    const response = await http.patch<Ticket>(`/tickets/${id}`, { 
      status: "closed" 
    });
    return response.data;
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/tickets/${id}`);
  },
};
