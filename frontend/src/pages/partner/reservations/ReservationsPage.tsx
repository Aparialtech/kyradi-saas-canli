import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, CheckCircle2, XOctagon, Search, FileText, Plus, X, Download } from "../../../lib/lucide";

import { reservationService, type Reservation, type ReservationPaymentInfo, type ManualReservationCreate } from "../../../services/partner/reservations";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { usePagination, calculatePaginationMeta } from "../../../components/common/Pagination";
import { ReservationDetailModal } from "../../../components/reservations/ReservationDetailModal";
import { PaymentActionModal } from "../../../components/reservations/PaymentActionModal";
import { getErrorMessage } from "../../../lib/httpError";
import { env } from "../../../config/env";
import { useTranslation } from "../../../hooks/useTranslation";
import { StatusBadge } from "../../../components/common/StatusBadge";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernTable, type ModernTableColumn } from "../../../components/ui/ModernTable";
import { ModernInput } from "../../../components/ui/ModernInput";
import { ModernButton } from "../../../components/ui/ModernButton";


export function ReservationsPage() {
  const { messages, push } = useToast();
  const { t, locale } = useTranslation();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
  const [filterOrigin, setFilterOrigin] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const { page, pageSize, setPage, setPageSize } = usePagination(10);
  
  // Payment modal states
  const [paymentReservation, setPaymentReservation] = useState<Reservation | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<ReservationPaymentInfo | null>(null);
  const [showPaymentActionModal, setShowPaymentActionModal] = useState(false);

  // Manual reservation modal state
  const [showManualReservationForm, setShowManualReservationForm] = useState(false);
  const [manualFormData, setManualFormData] = useState<ManualReservationCreate>({
    guest_name: "",
    guest_phone: "",
    guest_email: "",
    tc_identity_number: "",
    passport_number: "",
    hotel_room_number: "",
    baggage_count: 1,
    luggage_type: "Medium",
    notes: "",
    amount_minor: 0,
    payment_mode: "CASH",
  });

  const reservationsQuery = useQuery({
    queryKey: ["widget-reservations", filterStatus, filterFrom, filterTo],
    queryFn: () =>
      reservationService.list({
        status: filterStatus || undefined,
        from: filterFrom || undefined,
        to: filterTo || undefined,
      }),
  });

  // ===============================================
  // UNIFIED MUTATIONS - work for both widget and normal reservations
  // ===============================================

  // Create manual reservation
  const createManualReservationMutation = useMutation({
    mutationFn: (payload: ManualReservationCreate) => reservationService.createManual(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["widget-reservations"] });
      push({ title: "Rezervasyon oluşturuldu", description: "Manuel rezervasyon başarıyla kaydedildi", type: "success" });
      setShowManualReservationForm(false);
      setManualFormData({
        guest_name: "",
        guest_phone: "",
        guest_email: "",
        tc_identity_number: "",
        passport_number: "",
        hotel_room_number: "",
        baggage_count: 1,
        luggage_type: "Medium",
        notes: "",
        amount_minor: 0,
        payment_mode: "CASH",
      });
    },
    onError: (error: unknown) =>
      push({ title: "Rezervasyon oluşturulamadı", description: getErrorMessage(error), type: "error" }),
  });

  // Complete reservation (deliver luggage) - works for both widget and normal reservations
  const completeReservationMutation = useMutation<{ id: string | number; status: string }, unknown, string | number>({
    mutationFn: (id: string | number) => reservationService.completeReservation(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["widget-reservations"] });
      push({ title: t("reservations.toast.completeSuccess"), type: "success" });
    },
    onError: (error: unknown) =>
      push({ title: t("reservations.toast.completeError"), description: getErrorMessage(error), type: "error" }),
  });

  // Cancel reservation - works for both widget and normal reservations
  const cancelReservationMutation = useMutation<{ id: string | number; status: string }, unknown, string | number>({
    mutationFn: (id: string | number) => reservationService.cancelReservation(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["widget-reservations"] });
      push({ title: t("reservations.toast.cancelSuccess"), type: "info" });
    },
    onError: (error: unknown) =>
      push({ title: t("reservations.toast.cancelError"), description: getErrorMessage(error), type: "error" }),
  });

  const allReservations = reservationsQuery.data ?? [];
  
  // Filter reservations by search term and origin
  const filteredReservations = useMemo(() => {
    let filtered = allReservations;
    
    // Filter by origin
    if (filterOrigin) {
      filtered = filtered.filter((reservation) => reservation.origin === filterOrigin);
    }
    
    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((reservation) => {
        const guestName = (reservation.full_name ?? reservation.guest_name ?? "").toLowerCase();
        const email = (reservation.guest_email ?? "").toLowerCase();
        const phone = (reservation.guest_phone ?? reservation.phone_number ?? "").toLowerCase();
        const id = String(reservation.id).toLowerCase();
        
        return (
          guestName.includes(term) ||
          email.includes(term) ||
          phone.includes(term) ||
          id.includes(term)
        );
      });
    }
    
    return filtered;
  }, [allReservations, searchTerm, filterOrigin]);

  // Paginate filtered data
  const paginatedReservations = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredReservations.slice(start, end);
  }, [filteredReservations, page, pageSize]);

  const paginationMeta = useMemo(() => {
    return calculatePaginationMeta(filteredReservations.length, page, pageSize);
  }, [filteredReservations.length, page, pageSize]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setPage(1); // Reset to first page on search
  }, [setPage]);

  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [locale],
  );

  const formatDateTimeValue = useCallback(
    (value?: string | null) => {
      if (!value) return "—";
      try {
        return dateTimeFormatter.format(new Date(value));
      } catch {
        return value;
      }
    },
    [dateTimeFormatter],
  );

  // CSV Export handler
  const exportToCsv = useCallback(() => {
    if (filteredReservations.length === 0) return;

    const headers = ["ID", "Durum", "Misafir Adı", "Telefon", "E-posta", "Oda No", "Bavul Sayısı", "Kaynak", "Oluşturma Tarihi"];
    const statusLabels: Record<string, string> = {
      reserved: "Rezerve",
      confirmed: "Onaylandı",
      active: "Aktif",
      completed: "Tamamlandı",
      cancelled: "İptal",
      no_show: "Gelmedi",
    };
    const originLabels: Record<string, string> = {
      widget: "Widget",
      panel: "Panel",
      api: "API",
    };

    const csvRows = [headers.join(";")];
    for (const res of filteredReservations) {
      const row = [
        String(res.id),
        statusLabels[res.status] || res.status,
        res.guest_name || res.full_name || res.customer_name || "-",
        res.guest_phone || res.phone_number || res.customer_phone || "-",
        res.guest_email || res.customer_email || "-",
        res.hotel_room_number || "-",
        String(res.baggage_count || res.luggage_count || 1),
        originLabels[res.origin || ""] || res.origin || "-",
        res.created_at ? new Date(res.created_at).toLocaleString("tr-TR") : "-",
      ];
      csvRows.push(row.map(v => v.includes(";") ? `"${v.replace(/"/g, '""')}"` : v).join(";"));
    }

    const csvString = "\ufeff" + csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `rezervasyonlar_${filterFrom || "tum"}_${filterTo || "tum"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredReservations, filterFrom, filterTo]);


  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: '1600px', margin: '0 auto' }}>
      <ToastContainer messages={messages} />
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 'var(--space-6)' }}
      >
        <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-black)', color: 'var(--text-primary)', margin: '0 0 var(--space-2) 0' }}>
          {t("reservations.title")}
        </h1>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', margin: 0 }}>
          {t("reservations.subtitle")}
        </p>
      </motion.div>

      {!env.ENABLE_INTERNAL_RESERVATIONS && (
        <div className="panel panel--muted" style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ marginTop: 0 }}>{t("reservations.widgetActiveTitle")}</h3>
          <p style={{ marginBottom: "0.5rem" }}>{t("reservations.widgetActiveBody")}</p>
          <a className="action-link" href="/docs/embedding_guide.md" target="_blank" rel="noreferrer">
            {t("reservations.widgetActiveLink")}
          </a>
        </div>
      )}

      {/* Manual Reservation Form */}
      <AnimatePresence>
        {showManualReservationForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <div>
                  <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: '0 0 var(--space-1) 0' }}>
                    Yeni Manuel Rezervasyon
                  </h2>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                    Panel üzerinden manuel rezervasyon oluşturun
                  </p>
                </div>
                <ModernButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowManualReservationForm(false)}
                  leftIcon={<X className="h-4 w-4" />}
                >
                  Kapat
                </ModernButton>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createManualReservationMutation.mutate(manualFormData);
                }}
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-4)' }}
              >
                <ModernInput
                  label="Misafir Adı Soyadı *"
                  value={manualFormData.guest_name}
                  onChange={(e) => setManualFormData(prev => ({ ...prev, guest_name: e.target.value }))}
                  placeholder="Ahmet Yılmaz"
                  required
                  fullWidth
                />
                <ModernInput
                  label="Telefon Numarası *"
                  value={manualFormData.guest_phone}
                  onChange={(e) => setManualFormData(prev => ({ ...prev, guest_phone: e.target.value }))}
                  placeholder="+90 555 123 4567"
                  required
                  fullWidth
                />
                <ModernInput
                  label="E-posta"
                  type="email"
                  value={manualFormData.guest_email || ""}
                  onChange={(e) => setManualFormData(prev => ({ ...prev, guest_email: e.target.value }))}
                  placeholder="ornek@email.com"
                  fullWidth
                />
                <ModernInput
                  label="TC Kimlik No"
                  value={manualFormData.tc_identity_number || ""}
                  onChange={(e) => setManualFormData(prev => ({ ...prev, tc_identity_number: e.target.value }))}
                  placeholder="12345678901"
                  maxLength={11}
                  fullWidth
                />
                <ModernInput
                  label="Pasaport No"
                  value={manualFormData.passport_number || ""}
                  onChange={(e) => setManualFormData(prev => ({ ...prev, passport_number: e.target.value }))}
                  placeholder="AB1234567"
                  fullWidth
                />
                <ModernInput
                  label="Oda Numarası"
                  value={manualFormData.hotel_room_number || ""}
                  onChange={(e) => setManualFormData(prev => ({ ...prev, hotel_room_number: e.target.value }))}
                  placeholder="101"
                  fullWidth
                />
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
                    Bavul Sayısı
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={manualFormData.baggage_count || 1}
                    onChange={(e) => setManualFormData(prev => ({ ...prev, baggage_count: parseInt(e.target.value) || 1 }))}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2) var(--space-3)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
                    Bagaj Tipi
                  </label>
                  <select
                    value={manualFormData.luggage_type || "Medium"}
                    onChange={(e) => setManualFormData(prev => ({ ...prev, luggage_type: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2) var(--space-3)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option value="Cabin">Kabin (Cabin)</option>
                    <option value="Medium">Orta (Medium)</option>
                    <option value="Large">Büyük (Large)</option>
                    <option value="Backpack">Sırt Çantası</option>
                    <option value="Other">Diğer</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
                    Ödeme Tutarı (TL)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={(manualFormData.amount_minor || 0) / 100}
                    onChange={(e) => setManualFormData(prev => ({ ...prev, amount_minor: Math.round(parseFloat(e.target.value || "0") * 100) }))}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2) var(--space-3)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
                    Ödeme Yöntemi
                  </label>
                  <select
                    value={manualFormData.payment_mode || "CASH"}
                    onChange={(e) => setManualFormData(prev => ({ ...prev, payment_mode: e.target.value as ManualReservationCreate["payment_mode"] }))}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2) var(--space-3)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option value="CASH">Nakit</option>
                    <option value="POS">POS / Kart</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <ModernInput
                    label="Notlar"
                    value={manualFormData.notes || ""}
                    onChange={(e) => setManualFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Ek notlar..."
                    fullWidth
                  />
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                  <ModernButton
                    type="button"
                    variant="ghost"
                    onClick={() => setShowManualReservationForm(false)}
                  >
                    İptal
                  </ModernButton>
                  <ModernButton
                    type="submit"
                    variant="primary"
                    disabled={createManualReservationMutation.isPending}
                    isLoading={createManualReservationMutation.isPending}
                    loadingText="Kaydediliyor..."
                  >
                    Rezervasyon Oluştur
                  </ModernButton>
                </div>
              </form>
            </ModernCard>
          </motion.div>
        )}
      </AnimatePresence>

      <ModernCard variant="glass" padding="lg">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: '0 0 var(--space-1) 0' }}>
              {t("reservations.listTitle")}
            </h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
              {t("reservations.listSubtitle")}
            </p>
          </div>
          <ModernButton
            variant="primary"
            onClick={() => setShowManualReservationForm(true)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Yeni Rezervasyon
          </ModernButton>
        </div>

        <div style={{ marginBottom: 'var(--space-6)' }}>
          <ModernInput
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="İsim, e-posta veya ID ile ara..."
            leftIcon={<Search className="h-5 w-5" />}
            fullWidth
          />
        </div>

        <div style={{ marginBottom: 'var(--space-4)', display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "center" }}>
          <select 
            value={filterStatus} 
            onChange={(event) => setFilterStatus(event.target.value)}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="">{t("reservations.filter.all")}</option>
            <option value="reserved">{t("reservations.filter.reserved")}</option>
            <option value="confirmed">Onaylandı</option>
            <option value="active">{t("reservations.filter.active")}</option>
            <option value="completed">{t("reservations.filter.completed")}</option>
            <option value="cancelled">{t("reservations.filter.cancelled")}</option>
            <option value="no_show">{t("reservations.filter.noShow")}</option>
          </select>
          <select 
            value={filterOrigin} 
            onChange={(event) => setFilterOrigin(event.target.value)}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="">Tüm Kaynaklar</option>
            <option value="widget">Widget</option>
            <option value="panel">Panel</option>
            <option value="api">API</option>
          </select>
          <input 
            type="date" 
            value={filterFrom} 
            onChange={(event) => setFilterFrom(event.target.value)}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
            }}
          />
          <input 
            type="date" 
            value={filterTo} 
            onChange={(event) => setFilterTo(event.target.value)}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
            }}
          />
          <div style={{ marginLeft: 'auto' }}>
            <ModernButton
              variant="outline"
              size="sm"
              onClick={exportToCsv}
              disabled={filteredReservations.length === 0}
              leftIcon={<Download className="h-4 w-4" />}
            >
              CSV İndir
            </ModernButton>
          </div>
        </div>

        {reservationsQuery.isLoading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-16)', color: 'var(--text-tertiary)' }}>
            <div className="shimmer" style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-full)', margin: '0 auto var(--space-4) auto' }} />
            <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>{t("reservations.loading")}</p>
          </div>
        ) : paginatedReservations.length > 0 ? (
          <ModernTable
            showRowNumbers
            pagination={paginationMeta}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            columns={[
              {
                key: 'guest',
                label: t("reservations.table.guest"),
                render: (_, row: Reservation) => (
                  <div>
                    <div style={{ fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>
                      {row.full_name || row.customer_name || row.guest_name || 'Bilinmiyor'}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                      #{String(row.id).slice(0, 8)}
                    </div>
                  </div>
                ),
              },
              {
                key: 'contact',
                label: t("reservations.table.contact"),
                render: (_, row: Reservation) => (
                  <div>
                    <div style={{ fontSize: 'var(--text-sm)' }}>{row.guest_email || row.customer_email || '—'}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                      {row.guest_phone || row.phone_number || row.customer_phone || '—'}
                    </div>
                  </div>
                ),
              },
              {
                key: 'dates',
                label: 'Tarihler',
                render: (_, row: Reservation) => {
                  const startDate = row.start_datetime || row.start_at || row.checkin_date;
                  const endDate = row.end_datetime || row.end_at || row.checkout_date;
                  return (
                    <div>
                      <div style={{ fontSize: 'var(--text-sm)' }}>
                        {formatDateTimeValue(startDate)}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                        {formatDateTimeValue(endDate)}
                      </div>
                    </div>
                  );
                },
              },
              {
                key: 'storage',
                label: 'Depo',
                render: (_, row: Reservation) => (
                  <div>
                    {row.storage_code ? (
                      <>
                        <div style={{ fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>
                          {row.storage_code}
                        </div>
                        {row.location_name && (
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                            {row.location_name}
                          </div>
                        )}
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>Atanmadı</span>
                    )}
                  </div>
                ),
              },
              {
                key: 'baggage_count',
                label: t("reservations.table.luggage"),
                render: (value) => `${value || 0} adet`,
                align: 'center',
              },
              {
                key: 'status',
                label: t("reservations.table.status"),
                render: (value) => <StatusBadge status={value} />,
                align: 'center',
              },
              {
                key: 'actions',
                label: t("reservations.table.actions"),
                align: 'center',
                render: (_, row: Reservation) => (
                  <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
                    <ModernButton
                      variant="ghost"
                      onClick={() => {
                        setSelectedReservation(row);
                        setShowDetailModal(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </ModernButton>
                    <ModernButton
                      variant="primary"
                      disabled={row.status === 'completed' || row.status === 'cancelled'}
                      onClick={() => {
                        if (confirm('Teslim edildi olarak işaretle?')) {
                          completeReservationMutation.mutate(row.id);
                        }
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </ModernButton>
                    <ModernButton
                      variant="danger"
                      disabled={row.status === 'completed' || row.status === 'cancelled'}
                      onClick={() => {
                        if (confirm('İptal etmek istediğinize emin misiniz?')) {
                          cancelReservationMutation.mutate(row.id);
                        }
                      }}
                    >
                      <XOctagon className="h-4 w-4" />
                    </ModernButton>
                  </div>
                ),
              },
            ] as ModernTableColumn<Reservation>[]}
            data={paginatedReservations}
            loading={reservationsQuery.isLoading}
            striped
            hoverable
            stickyHeader
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 'var(--space-16)', color: 'var(--text-tertiary)' }}>
            <FileText className="h-16 w-16" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--text-muted)' }} />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0' }}>{t("reservations.emptyTitle")}</h3>
            <p style={{ margin: 0 }}>{t("reservations.emptyHint")}</p>
          </div>
        )}
      </ModernCard>

      <ReservationDetailModal
        reservation={selectedReservation}
        isOpen={showDetailModal}
        onClose={useCallback(() => {
          setShowDetailModal(false);
          setSelectedReservation(null);
        }, [])}
      />

      {/* Payment Action Modal (for unpaid reservations) */}
      <PaymentActionModal
        reservation={paymentReservation}
        isOpen={showPaymentActionModal}
        onClose={() => {
          setShowPaymentActionModal(false);
          setPaymentReservation(null);
          setPaymentInfo(null);
        }}
        paymentInfo={paymentInfo}
      />
    </div>
  );
}
