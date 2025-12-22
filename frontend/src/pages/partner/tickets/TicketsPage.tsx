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
  Inbox,
  Calendar,
} from "../../../lib/lucide";

import { 
  ticketService, 
  type Ticket, 
  type TicketCreate, 
  type TicketStatus, 
  type TicketPriority,
  type TicketDirection,
} from "../../../services/partner/tickets";
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
  resolved: "Okundu",
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

type TabType = "incoming" | "outgoing";

export function TicketsPage() {
  const queryClient = useQueryClient();
  const { messages, push } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | "">("");
  const [activeTab, setActiveTab] = useState<TabType>("incoming");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const { page, pageSize, setPage, setPageSize } = usePagination(10);

  // Form state for new ticket
  const [newTicket, setNewTicket] = useState<TicketCreate>({
    title: "",
    message: "",
    priority: "medium",
    target: "admin",
  });

  // Fetch tickets
  const ticketsQuery = useQuery({
    queryKey: ["tickets", activeTab, statusFilter, priorityFilter, searchTerm, startDate, endDate, page, pageSize],
    queryFn: () => ticketService.list({
      direction: activeTab as TicketDirection,
      status: statusFilter || undefined,
      priority: priorityFilter || undefined,
      search: searchTerm || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      page,
      pageSize,
    }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: TicketCreate) => ticketService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["unread-tickets"] });
      push({ title: "Mesaj gönderildi", description: "Mesajınız iletildi", type: "success" });
      setShowNewTicketModal(false);
      setNewTicket({ title: "", message: "", priority: "medium", target: "admin" });
      setActiveTab("outgoing"); // Switch to sent tab
    },
    onError: (error: unknown) => {
      push({ title: "Mesaj gönderilemedi", description: getErrorMessage(error), type: "error" });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => ticketService.markAsRead(id),
    onSuccess: (updatedTicket) => {
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["unread-tickets"] });
      push({ title: "Okundu olarak işaretlendi", type: "success" });
      setSelectedTicket(updatedTicket);
    },
    onError: (error: unknown) => {
      push({ title: "İşlem başarısız", description: getErrorMessage(error), type: "error" });
    },
  });

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setPage(1);
  }, [setPage]);

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    setPage(1);
  }, [setPage]);

  const handleCreateTicket = useCallback(() => {
    if (!newTicket.title.trim() || !newTicket.message.trim()) {
      push({ title: "Lütfen başlık ve mesaj girin", type: "error" });
      return;
    }
    createMutation.mutate(newTicket);
  }, [newTicket, createMutation, push]);

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
            {!row.read_at && activeTab === "incoming" && (
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
      key: "direction",
      label: "Yön",
      align: "center",
      render: () => {
        const isIncoming = activeTab === "incoming";
        return (
          <Badge variant={isIncoming ? "success" : "info"}>
            {isIncoming ? "Gelen" : "Giden"}
          </Badge>
        );
      },
    },
    {
      key: "status",
      label: "Durum",
      align: "center",
      render: (value: TicketStatus) => (
        <Badge variant={statusVariants[value]}>
          {statusLabels[value]}
        </Badge>
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
      label: "Tarih",
      render: (value: string) => (
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          {formatDate(value)}
        </div>
      ),
    },
    {
      key: "resolved_at",
      label: "Okunma",
      render: (_, row) => row.read_at ? (
        <div style={{ fontSize: "var(--text-sm)", color: "var(--success-600)" }}>
          <CheckCircle2 className="h-3 w-3" style={{ display: "inline", marginRight: "var(--space-1)" }} />
          {formatDate(row.read_at)}
        </div>
      ) : (
        <span style={{ color: "var(--text-tertiary)" }}>-</span>
      ),
    },
  ], [formatDate, activeTab]);

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
            <div style={{
              width: "48px",
              height: "48px",
              borderRadius: "var(--radius-xl)",
              background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <MessageSquare style={{ width: "24px", height: "24px", color: "white" }} />
            </div>
            <div>
              <h1 style={{ fontSize: "var(--text-3xl)", fontWeight: "var(--font-black)", color: "var(--text-primary)", margin: 0 }}>
                İletişim
              </h1>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: 0 }}>
                Destek taleplerinizi oluşturun ve takip edin
              </p>
            </div>
            {unreadCount > 0 && (
              <Badge variant="danger">
                <Bell className="h-3 w-3" style={{ marginRight: "var(--space-1)" }} />
                {unreadCount} okunmamış
              </Badge>
            )}
          </div>
        </div>
        <ModernButton
          variant="primary"
          onClick={() => setShowNewTicketModal(true)}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Yeni Mesaj
        </ModernButton>
      </motion.div>

      {/* Tabs */}
      <ModernCard variant="glass" padding="none" style={{ marginBottom: "var(--space-4)" }}>
        <div style={{ display: "flex", borderBottom: "1px solid var(--border-primary)" }}>
          <button
            onClick={() => handleTabChange("incoming")}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--space-2)",
              padding: "var(--space-4)",
              background: activeTab === "incoming" ? "var(--bg-secondary)" : "transparent",
              border: "none",
              borderBottom: activeTab === "incoming" ? "3px solid var(--primary)" : "3px solid transparent",
              cursor: "pointer",
              fontWeight: activeTab === "incoming" ? 600 : 400,
              color: activeTab === "incoming" ? "var(--primary)" : "var(--text-secondary)",
              transition: "all 0.2s",
            }}
          >
            <Inbox style={{ width: "18px", height: "18px" }} />
            <span>Gelen Mesajlar</span>
            {activeTab === "incoming" && unreadCount > 0 && (
              <span style={{
                background: "var(--danger-500)",
                color: "white",
                padding: "2px 8px",
                borderRadius: "var(--radius-full)",
                fontSize: "var(--text-xs)",
                fontWeight: 600,
              }}>
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => handleTabChange("outgoing")}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--space-2)",
              padding: "var(--space-4)",
              background: activeTab === "outgoing" ? "var(--bg-secondary)" : "transparent",
              border: "none",
              borderBottom: activeTab === "outgoing" ? "3px solid var(--primary)" : "3px solid transparent",
              cursor: "pointer",
              fontWeight: activeTab === "outgoing" ? 600 : 400,
              color: activeTab === "outgoing" ? "var(--primary)" : "var(--text-secondary)",
              transition: "all 0.2s",
            }}
          >
            <Send style={{ width: "18px", height: "18px" }} />
            <span>Gönderilen Mesajlar</span>
          </button>
        </div>
      </ModernCard>

      {/* Filters */}
      <ModernCard variant="glass" padding="lg" style={{ marginBottom: "var(--space-6)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-4)", alignItems: "end" }}>
          <div style={{ gridColumn: "span 2" }}>
            <ModernInput
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Başlık veya mesaj ile ara..."
              leftIcon={<Search className="h-4 w-4" />}
              fullWidth
            />
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
              <option value="resolved">Okundu</option>
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
          <div>
            <label style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-1)", display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
              <Calendar style={{ width: "14px", height: "14px" }} />
              Başlangıç
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
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
            />
          </div>
          <div>
            <label style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-1)", display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
              <Calendar style={{ width: "14px", height: "14px" }} />
              Bitiş
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
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
            />
          </div>
        </div>
      </ModernCard>

      {/* Tickets Table */}
      <ModernCard variant="glass" padding="lg">
        <div style={{ marginBottom: "var(--space-4)" }}>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-bold)", margin: "0 0 var(--space-1) 0" }}>
            {activeTab === "incoming" ? "Gelen Mesajlar" : "Gönderilen Mesajlar"}
          </h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: 0 }}>
            {ticketsQuery.data?.total ?? 0} mesaj bulundu
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
            {activeTab === "incoming" ? (
              <Inbox className="h-16 w-16" style={{ margin: "0 auto var(--space-4) auto", color: "var(--text-muted)" }} />
            ) : (
              <Send className="h-16 w-16" style={{ margin: "0 auto var(--space-4) auto", color: "var(--text-muted)" }} />
            )}
            <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", margin: "0 0 var(--space-2) 0", color: "var(--text-primary)" }}>
              {activeTab === "incoming" ? "Gelen mesaj yok" : "Gönderilen mesaj yok"}
            </h3>
            <p style={{ margin: "0 0 var(--space-4) 0" }}>
              {activeTab === "incoming" 
                ? "Henüz size gelen mesaj bulunmuyor." 
                : "Henüz mesaj göndermediniz."}
            </p>
            {activeTab === "outgoing" && (
              <ModernButton variant="primary" onClick={() => setShowNewTicketModal(true)} leftIcon={<Plus className="h-4 w-4" />}>
                Yeni Mesaj Gönder
              </ModernButton>
            )}
          </div>
        )}
      </ModernCard>

      {/* New Ticket Modal */}
      <Modal
        isOpen={showNewTicketModal}
        onClose={() => setShowNewTicketModal(false)}
        title="Yeni Mesaj Gönder"
        width="600px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <ModernInput
            label="Başlık *"
            value={newTicket.title}
            onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
            placeholder="Mesaj başlığı"
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
                Alıcı
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
                <option value="admin">Yönetim</option>
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
        onClose={() => setSelectedTicket(null)}
        title="Mesaj Detayı"
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
                  Yanıt
                </div>
                <div style={{ color: "var(--success-800)", whiteSpace: "pre-wrap" }}>
                  {selectedTicket.resolution_note}
                </div>
                {selectedTicket.resolved_at && (
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--success-600)", marginTop: "var(--space-2)" }}>
                    Yanıt tarihi: {formatDate(selectedTicket.resolved_at)}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
              {selectedTicket.read_at === null && activeTab === "incoming" && (
                <ModernButton 
                  variant="primary" 
                  onClick={() => markAsReadMutation.mutate(selectedTicket.id)}
                  disabled={markAsReadMutation.isPending}
                  isLoading={markAsReadMutation.isPending}
                  leftIcon={!markAsReadMutation.isPending && <CheckCircle2 className="h-4 w-4" />}
                >
                  Okundu Olarak İşaretle
                </ModernButton>
              )}
              <ModernButton variant="ghost" onClick={() => setSelectedTicket(null)}>
                Kapat
              </ModernButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
