import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Eye, CheckCircle2, XOctagon, CreditCard, Search, FileText } from "../../../lib/lucide";

import { reservationService, type Reservation, type ReservationPaymentInfo } from "../../../services/partner/reservations";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { ReservationDetailModal } from "../../../components/reservations/ReservationDetailModal";
import { PaymentActionModal } from "../../../components/reservations/PaymentActionModal";
import { PaymentDetailModal } from "../../../components/reservations/PaymentDetailModal";
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
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Payment modal states
  const [paymentReservation, setPaymentReservation] = useState<Reservation | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<ReservationPaymentInfo | null>(null);
  const [showPaymentActionModal, setShowPaymentActionModal] = useState(false);
  const [showPaymentDetailModal, setShowPaymentDetailModal] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);

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

  // Payment check handler - fetches reservation and opens appropriate modal
  const handlePaymentCheck = useCallback(async (reservation: Reservation) => {
    setIsCheckingPayment(true);
    try {
      const [freshReservation, payment] = await Promise.all([
        reservationService.getById(reservation.id),
        reservationService.getPayment(reservation.id),
      ]);

      setPaymentReservation(freshReservation);
      setPaymentInfo(payment);

      const paymentStatus = payment?.status;
      if (paymentStatus === "paid" || paymentStatus === "captured") {
        setShowPaymentDetailModal(true);
      } else {
        setShowPaymentActionModal(true);
      }
    } catch (error) {
      push({ 
        title: t("payment.modal.createError"), 
        description: getErrorMessage(error), 
        type: "error" 
      });
    } finally {
      setIsCheckingPayment(false);
    }
  }, [push, t]);

  const allReservations = reservationsQuery.data ?? [];
  
  // Filter reservations by search term
  const reservations = useMemo(() => {
    if (!searchTerm.trim()) return allReservations;
    const term = searchTerm.toLowerCase();
    return allReservations.filter((reservation) => {
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
  }, [allReservations, searchTerm]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

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

      <ModernCard variant="glass" padding="lg">
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: '0 0 var(--space-1) 0' }}>
            {t("reservations.listTitle")}
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
            {t("reservations.listSubtitle")}
          </p>
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

        <div style={{ marginBottom: 'var(--space-4)', display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
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
            <option value="active">{t("reservations.filter.active")}</option>
            <option value="completed">{t("reservations.filter.completed")}</option>
            <option value="cancelled">{t("reservations.filter.cancelled")}</option>
            <option value="no_show">{t("reservations.filter.noShow")}</option>
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
        </div>

        {reservationsQuery.isLoading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-16)', color: 'var(--text-tertiary)' }}>
            <div className="shimmer" style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-full)', margin: '0 auto var(--space-4) auto' }} />
            <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>{t("reservations.loading")}</p>
          </div>
        ) : reservations.length > 0 ? (
          <ModernTable
            columns={[
              {
                key: 'guest',
                label: t("reservations.table.guest"),
                render: (_, row: Reservation) => (
                  <div>
                    <div style={{ fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>
                      {row.full_name || row.guest_name || 'Bilinmiyor'}
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
                    <div style={{ fontSize: 'var(--text-sm)' }}>{row.guest_email || '—'}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{row.guest_phone || '—'}</div>
                  </div>
                ),
              },
              {
                key: 'dates',
                label: 'Tarihler',
                render: (_, row: Reservation) => {
                  const startDate = row.start_datetime || row.start_at;
                  const endDate = row.end_datetime || row.end_at;
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
                    <ModernButton
                      variant="outline"
                      disabled={isCheckingPayment}
                      onClick={() => handlePaymentCheck(row)}
                    >
                      <CreditCard className="h-4 w-4" />
                    </ModernButton>
                  </div>
                ),
              },
            ] as ModernTableColumn<Reservation>[]}
            data={reservations}
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
        onClose={() => {
          setShowDetailModal(false);
          setSelectedReservation(null);
        }}
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

      {/* Payment Detail Modal (for paid reservations) */}
      <PaymentDetailModal
        reservation={paymentReservation}
        paymentInfo={paymentInfo}
        isOpen={showPaymentDetailModal}
        onClose={() => {
          setShowPaymentDetailModal(false);
          setPaymentReservation(null);
          setPaymentInfo(null);
        }}
      />
    </div>
  );
}
