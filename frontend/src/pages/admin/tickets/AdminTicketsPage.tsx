import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  Plus, 
  Search, 
  CheckCircle2, 
  Send,
  Loader2,
  Bell,
  MessageSquare,
  XCircle,
  Building2,
} from "../../../lib/lucide";

import { 
  adminTicketService, 
  type Ticket, 
  type TicketCreate, 
  type TicketStatus, 
  type TicketPriority,
  type TicketUpdate,
} from "../../../services/admin/tickets";
import { adminTenantService } from "../../../services/admin/tenants";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { usePagination, calculatePaginationMeta } from "../../../components/common/Pagination";
import { getErrorMessage } from "../../../lib/httpError";

import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernTable, type ModernTableColumn } from "../../../components/ui/ModernTable";
import { ModernInput } from "../../../components/ui/ModernInput";
import { ModernButton } from "../../../components/ui/ModernButton";
import { Badge } from "../../../components/ui/Badge";
import { Modal } from "../../../components/common/Modal";

const statusLabels: Record<TicketStatus, string> = {
  open: "Açık",
  in_progress: "İşlemde",
  resolved: "Çözüldü",
  closed: "Kapatıldı",
};

const statusVariants: Record<TicketStatus, "success" | "warning" | "info" | "danger" | "neutral"> = {
  open: "warning",
  in_progress: "info",
  resolved: "success",
  closed: "neutral",
};

const priorityLabels: Record<TicketPriority, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
  urgent: "Acil",
};

const priorityVariants: Record<TicketPriority, "success" | "warning" | "info" | "danger" | "neutral"> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  urgent: "danger",
};

export function AdminTicketsPage() {
  const queryClient = useQueryClient();
  const { messages, push } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | "">("");
  const [tenantFilter, setTenantFilter] = useState<string>("");
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const { page, pageSize, setPage, setPageSize } = usePagination(10);

  // Form state for new ticket
  const [newTicket, setNewTicket] = useState<TicketCreate>({
    title: "",
    message: "",
    priority: "medium",
    target: "partner",
  });

  // Fetch tenants for filter
  const tenantsQuery = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: adminTenantService.list,
  });

  // Fetch tickets
  const ticketsQuery = useQuery({
    queryKey: ["admin", "tickets", statusFilter, priorityFilter, tenantFilter, searchTerm, page, pageSize],
    queryFn: () => adminTicketService.list({
      status: statusFilter || undefined,
      priority: priorityFilter || undefined,
      tenant_id: tenantFilter || undefined,
      search: searchTerm || undefined,
      page,
      pageSize,
    }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: TicketCreate) => adminTicketService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "tickets"] });
      push({ title: "Ticket oluşturuldu", description: "Mesajınız iletildi", type: "success" });
      setShowNewTicketModal(false);
      setNewTicket({ title: "", message: "", priority: "medium", target: "partner" });
    },
    onError: (error: unknown) => {
      push({ title: "Ticket oluşturulamadı", description: getErrorMessage(error), type: "error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TicketUpdate }) => 
      adminTicketService.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "tickets"] });
      push({ title: "Ticket güncellendi", type: "success" });
    },
    onError: (error: unknown) => {
      push({ title: "Ticket güncellenemedi", description: getErrorMessage(error), type: "error" });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => 
      adminTicketService.resolve(id, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "tickets"] });
      push({ title: "Ticket çözüldü olarak işaretlendi", type: "success" });
      setSelectedTicket(null);
      setResolutionNote("");
    },
    onError: (error: unknown) => {
      push({ title: "İşlem başarısız", description: getErrorMessage(error), type: "error" });
    },
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => adminTicketService.close(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "tickets"] });
      push({ title: "Ticket kapatıldı", type: "success" });
      setSelectedTicket(null);
    },
    onError: (error: unknown) => {
      push({ title: "İşlem başarısız", description: getErrorMessage(error), type: "error" });
    },
  });

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setPage(1);
  }, [setPage]);

  const handleCreateTicket = useCallback(() => {
    if (!newTicket.title.trim() || !newTicket.message.trim()) {
      push({ title: "Lütfen başlık ve mesaj girin", type: "error" });
      return;
    }
    createMutation.mutate(newTicket);
  }, [newTicket, createMutation, push]);

  const handleStatusChange = useCallback((ticket: Ticket, newStatus: TicketStatus) => {
    updateMutation.mutate({ id: ticket.id, payload: { status: newStatus } });
  }, [updateMutation]);

  const handleResolve = useCallback(() => {
    if (selectedTicket) {
      resolveMutation.mutate({ id: selectedTicket.id, note: resolutionNote || undefined });
    }
  }, [selectedTicket, resolutionNote, resolveMutation]);

  const handleClose = useCallback(() => {
    if (selectedTicket) {
      closeMutation.mutate(selectedTicket.id);
    }
  }, [selectedTicket, closeMutation]);

  const formatDate = useCallback((dateStr: string) => {
    return new Date(dateStr).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const tickets = ticketsQuery.data?.items ?? [];
  const paginationMeta = ticketsQuery.data ? {
    total: ticketsQuery.data.total,
    page: ticketsQuery.data.page,
    pageSize: ticketsQuery.data.page_size,
    totalPages: ticketsQuery.data.total_pages,
  } : calculatePaginationMeta(0, page, pageSize);

  const unreadCount = ticketsQuery.data?.unread_count ?? 0;

  const columns: ModernTableColumn<Ticket>[] = useMemo(() => [
    {
      key: "title",
      label: "Başlık",
      render: (_, row) => (
        <div 
          style={{ cursor: "pointer" }}
          onClick={() => setSelectedTicket(row)}
        >
          <div style={{ 
            fontWeight: "var(--font-semibold)", 
            color: "var(--text-primary)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)"
          }}>
            {!row.read_at && (
              <span style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "var(--primary)",
              }} />
            )}
            {row.title}
          </div>
          <div style={{ 
            fontSize: "var(--text-xs)", 
            color: "var(--text-tertiary)",
            marginTop: "var(--space-1)"
          }}>
            {row.message.length > 50 ? row.message.substring(0, 50) + "..." : row.message}
          </div>
        </div>
      ),
    },
    {
      key: "tenant_name",
      label: "Otel",
      render: (value: string | undefined) => value ? (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <Building2 className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
          <span>{value}</span>
        </div>
      ) : (
        <span style={{ color: "var(--text-tertiary)" }}>Sistem</span>
      ),
    },
    {
      key: "creator_email",
      label: "Gönderen",
      render: (value: string | undefined) => (
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          {value || "-"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Durum",
      align: "center",
      render: (value: TicketStatus, row) => (
        <select
          value={value}
          onChange={(e) => handleStatusChange(row, e.target.value as TicketStatus)}
          style={{
            padding: "var(--space-1) var(--space-2)",
            border: "1px solid var(--border-primary)",
            borderRadius: "var(--radius-md)",
            background: "var(--bg-tertiary)",
            color: "var(--text-primary)",
            fontSize: "var(--text-xs)",
            cursor: "pointer",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="open">Açık</option>
          <option value="in_progress">İşlemde</option>
          <option value="resolved">Çözüldü</option>
          <option value="closed">Kapatıldı</option>
        </select>
      ),
    },
    {
      key: "priority",
      label: "Öncelik",
      align: "center",
      render: (value: TicketPriority) => (
        <Badge variant={priorityVariants[value]}>
          {priorityLabels[value]}
        </Badge>
      ),
    },
    {
      key: "created_at",
      label: "Oluşturulma",
      render: (value: string) => (
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          {formatDate(value)}
        </div>
      ),
    },
    {
      key: "resolved_at",
      label: "Çözüm",
      render: (value: string | null) => value ? (
        <div style={{ fontSize: "var(--text-sm)", color: "var(--success-600)" }}>
          <CheckCircle2 className="h-3 w-3" style={{ display: "inline", marginRight: "var(--space-1)" }} />
          {formatDate(value)}
        </div>
      ) : (
        <span style={{ color: "var(--text-tertiary)" }}>-</span>
      ),
    },
  ], [formatDate, handleStatusChange]);

  return (
    <div style={{ padding: "var(--space-8)", maxWidth: "1600px", margin: "0 auto" }}>
      <ToastContainer messages={messages} />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: "var(--space-6)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <h1 style={{ fontSize: "var(--text-3xl)", fontWeight: "var(--font-black)", color: "var(--text-primary)", margin: 0 }}>
              İletişim / Ticket Yönetimi
            </h1>
            {unreadCount > 0 && (
              <Badge variant="danger">
                <Bell className="h-3 w-3" style={{ marginRight: "var(--space-1)" }} />
                {unreadCount} okunmamış
              </Badge>
            )}
          </div>
          <p style={{ fontSize: "var(--text-base)", color: "var(--text-tertiary)", margin: "var(--space-2) 0 0 0" }}>
            Partnerlerden gelen destek taleplerini yönetin
          </p>
        </div>
        <ModernButton
          variant="primary"
          onClick={() => setShowNewTicketModal(true)}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Yeni Ticket
        </ModernButton>
      </motion.div>

      {/* Filters */}
      <ModernCard variant="glass" padding="lg" style={{ marginBottom: "var(--space-6)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-4)", alignItems: "end" }}>
          <div style={{ gridColumn: "span 2" }}>
            <ModernInput
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Başlık, mesaj veya e-posta ile ara..."
              leftIcon={<Search className="h-4 w-4" />}
              fullWidth
            />
          </div>
          <div>
            <label style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-1)", display: "block" }}>
              Otel
            </label>
            <select
              value={tenantFilter}
              onChange={(e) => {
                setTenantFilter(e.target.value);
                setPage(1);
              }}
              style={{
                width: "100%",
                padding: "var(--space-2) var(--space-3)",
                border: "1px solid var(--border-primary)",
                borderRadius: "var(--radius-lg)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">Tümü</option>
              {tenantsQuery.data?.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-1)", display: "block" }}>
              Durum
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as TicketStatus | "");
                setPage(1);
              }}
              style={{
                width: "100%",
                padding: "var(--space-2) var(--space-3)",
                border: "1px solid var(--border-primary)",
                borderRadius: "var(--radius-lg)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">Tümü</option>
              <option value="open">Açık</option>
              <option value="in_progress">İşlemde</option>
              <option value="resolved">Çözüldü</option>
              <option value="closed">Kapatıldı</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-1)", display: "block" }}>
              Öncelik
            </label>
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value as TicketPriority | "");
                setPage(1);
              }}
              style={{
                width: "100%",
                padding: "var(--space-2) var(--space-3)",
                border: "1px solid var(--border-primary)",
                borderRadius: "var(--radius-lg)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">Tümü</option>
              <option value="low">Düşük</option>
              <option value="medium">Orta</option>
              <option value="high">Yüksek</option>
              <option value="urgent">Acil</option>
            </select>
          </div>
        </div>
      </ModernCard>

      {/* Tickets Table */}
      <ModernCard variant="glass" padding="lg">
        <div style={{ marginBottom: "var(--space-4)" }}>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-bold)", margin: "0 0 var(--space-1) 0" }}>
            Ticket Listesi
          </h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: 0 }}>
            {ticketsQuery.data?.total ?? 0} ticket bulundu
          </p>
        </div>

        {ticketsQuery.isLoading ? (
          <div style={{ textAlign: "center", padding: "var(--space-16)", color: "var(--text-tertiary)" }}>
            <Loader2 className="h-12 w-12" style={{ margin: "0 auto var(--space-4) auto", animation: "spin 1s linear infinite" }} />
            <p>Yükleniyor...</p>
          </div>
        ) : tickets.length > 0 ? (
          <ModernTable
            columns={columns}
            data={tickets}
            loading={ticketsQuery.isLoading}
            striped
            hoverable
            stickyHeader
            showRowNumbers
            pagination={paginationMeta}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        ) : (
          <div style={{ textAlign: "center", padding: "var(--space-16)", color: "var(--text-tertiary)" }}>
            <MessageSquare className="h-16 w-16" style={{ margin: "0 auto var(--space-4) auto", color: "var(--text-muted)" }} />
            <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", margin: "0 0 var(--space-2) 0", color: "var(--text-primary)" }}>
              Henüz ticket yok
            </h3>
            <p style={{ margin: "0 0 var(--space-4) 0" }}>
              Partnerlerden gelen destek talepleri burada görünecek.
            </p>
          </div>
        )}
      </ModernCard>

      {/* New Ticket Modal */}
      <Modal
        isOpen={showNewTicketModal}
        onClose={() => setShowNewTicketModal(false)}
        title="Yeni Ticket Oluştur"
        width="600px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <ModernInput
            label="Başlık *"
            value={newTicket.title}
            onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
            placeholder="Ticket başlığı"
            fullWidth
          />
          <div>
            <label style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "var(--space-2)", display: "block" }}>
              Mesaj *
            </label>
            <textarea
              value={newTicket.message}
              onChange={(e) => setNewTicket({ ...newTicket, message: e.target.value })}
              placeholder="Detaylı açıklama yazın..."
              rows={5}
              style={{
                width: "100%",
                padding: "var(--space-3)",
                border: "1px solid var(--border-primary)",
                borderRadius: "var(--radius-lg)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <div>
              <label style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "var(--space-2)", display: "block" }}>
                Öncelik
              </label>
              <select
                value={newTicket.priority}
                onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value as TicketPriority })}
                style={{
                  width: "100%",
                  padding: "var(--space-2) var(--space-3)",
                  border: "1px solid var(--border-primary)",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="low">Düşük</option>
                <option value="medium">Orta</option>
                <option value="high">Yüksek</option>
                <option value="urgent">Acil</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "var(--space-2)", display: "block" }}>
                Hedef
              </label>
              <select
                value={newTicket.target}
                onChange={(e) => setNewTicket({ ...newTicket, target: e.target.value as "admin" | "partner" | "all" })}
                style={{
                  width: "100%",
                  padding: "var(--space-2) var(--space-3)",
                  border: "1px solid var(--border-primary)",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="partner">Partnerlere</option>
                <option value="all">Herkese</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end", marginTop: "var(--space-2)" }}>
            <ModernButton variant="ghost" onClick={() => setShowNewTicketModal(false)} disabled={createMutation.isPending}>
              İptal
            </ModernButton>
            <ModernButton
              variant="primary"
              onClick={handleCreateTicket}
              disabled={createMutation.isPending}
              isLoading={createMutation.isPending}
              loadingText="Gönderiliyor..."
              leftIcon={!createMutation.isPending && <Send className="h-4 w-4" />}
            >
              Gönder
            </ModernButton>
          </div>
        </div>
      </Modal>

      {/* Ticket Detail Modal */}
      <Modal
        isOpen={!!selectedTicket}
        onClose={() => {
          setSelectedTicket(null);
          setResolutionNote("");
        }}
        title="Ticket Detayı"
        width="700px"
      >
        {selectedTicket && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-bold)", margin: "0 0 var(--space-2) 0" }}>
                  {selectedTicket.title}
                </h3>
                <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  <Badge variant={statusVariants[selectedTicket.status]}>
                    {statusLabels[selectedTicket.status]}
                  </Badge>
                  <Badge variant={priorityVariants[selectedTicket.priority]}>
                    {priorityLabels[selectedTicket.priority]}
                  </Badge>
                  {selectedTicket.tenant_name && (
                    <Badge variant="neutral">
                      <Building2 className="h-3 w-3" style={{ marginRight: "var(--space-1)" }} />
                      {selectedTicket.tenant_name}
                    </Badge>
                  )}
                </div>
              </div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", textAlign: "right" }}>
                <div>{formatDate(selectedTicket.created_at)}</div>
                {selectedTicket.creator_email && (
                  <div style={{ marginTop: "var(--space-1)" }}>
                    {selectedTicket.creator_email}
                  </div>
                )}
              </div>
            </div>
            
            <div style={{ 
              padding: "var(--space-4)", 
              background: "var(--bg-tertiary)", 
              borderRadius: "var(--radius-lg)",
              whiteSpace: "pre-wrap",
              lineHeight: 1.6
            }}>
              {selectedTicket.message}
            </div>

            {selectedTicket.resolution_note && (
              <div style={{ 
                padding: "var(--space-4)", 
                background: "var(--success-50)", 
                border: "1px solid var(--success-200)",
                borderRadius: "var(--radius-lg)"
              }}>
                <div style={{ 
                  fontSize: "var(--text-sm)", 
                  fontWeight: 600, 
                  color: "var(--success-700)",
                  marginBottom: "var(--space-2)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)"
                }}>
                  <CheckCircle2 className="h-4 w-4" />
                  Çözüm Notu
                </div>
                <div style={{ color: "var(--success-800)", whiteSpace: "pre-wrap" }}>
                  {selectedTicket.resolution_note}
                </div>
                {selectedTicket.resolved_at && (
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--success-600)", marginTop: "var(--space-2)" }}>
                    Çözüm tarihi: {formatDate(selectedTicket.resolved_at)}
                  </div>
                )}
              </div>
            )}

            {/* Admin Actions */}
            {selectedTicket.status !== "closed" && selectedTicket.status !== "resolved" && (
              <div style={{ 
                padding: "var(--space-4)", 
                background: "var(--bg-secondary)", 
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-primary)"
              }}>
                <label style={{ 
                  fontSize: "var(--text-sm)", 
                  fontWeight: 600, 
                  color: "var(--text-secondary)",
                  marginBottom: "var(--space-2)",
                  display: "block"
                }}>
                  Çözüm Notu (Opsiyonel)
                </label>
                <textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Çözüm için açıklama ekleyin..."
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "var(--space-3)",
                    border: "1px solid var(--border-primary)",
                    borderRadius: "var(--radius-lg)",
                    background: "var(--bg-tertiary)",
                    color: "var(--text-primary)",
                    resize: "vertical",
                    fontFamily: "inherit",
                    marginBottom: "var(--space-3)",
                  }}
                />
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <ModernButton
                    variant="primary"
                    onClick={handleResolve}
                    disabled={resolveMutation.isPending}
                    isLoading={resolveMutation.isPending}
                    leftIcon={<CheckCircle2 className="h-4 w-4" />}
                  >
                    Çözüldü Olarak İşaretle
                  </ModernButton>
                  <ModernButton
                    variant="ghost"
                    onClick={handleClose}
                    disabled={closeMutation.isPending}
                    isLoading={closeMutation.isPending}
                    leftIcon={<XCircle className="h-4 w-4" />}
                  >
                    Kapat
                  </ModernButton>
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <ModernButton variant="ghost" onClick={() => {
                setSelectedTicket(null);
                setResolutionNote("");
              }}>
                Kapat
              </ModernButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
