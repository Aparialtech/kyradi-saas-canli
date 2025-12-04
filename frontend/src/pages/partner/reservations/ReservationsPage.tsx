import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { Eye, CheckCircle2, XOctagon, CreditCard } from "../../../lib/lucide";

import { reservationService, type Reservation, type ReservationPaymentInfo } from "../../../services/partner/reservations";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { ReservationDetailModal } from "../../../components/reservations/ReservationDetailModal";
import { PaymentActionModal } from "../../../components/reservations/PaymentActionModal";
import { PaymentDetailModal } from "../../../components/reservations/PaymentDetailModal";
import { getErrorMessage } from "../../../lib/httpError";
import { env } from "../../../config/env";
import { useTranslation } from "../../../hooks/useTranslation";
import type { TranslationKey } from "../../../i18n/translations";
import { DataToolbar } from "../../../components/common/DataToolbar";
import { PageHeader } from "../../../components/common/PageHeader";
import { StatusBadge } from "../../../components/common/StatusBadge";
import { Button } from "../../../components/ui/Button";

const paymentStatusKeys: Record<string, TranslationKey> = {
  pending: "reservations.paymentStatus.pending",
  paid: "reservations.paymentStatus.paid",
  captured: "reservations.paymentStatus.captured",
  cancelled: "reservations.paymentStatus.cancelled",
  failed: "reservations.paymentStatus.failed",
};

const statusTranslationKeys: Record<string, TranslationKey> = {
  reserved: "reservations.status.reserved",
  active: "reservations.status.active",
  completed: "reservations.status.completed",
  cancelled: "reservations.status.cancelled",
  no_show: "reservations.status.noShow",
  // Legacy statuses for backward compatibility
  pending: "reservations.status.pending",
  confirmed: "reservations.status.confirmed",
};

type TranslateFn = (key: TranslationKey, vars?: Record<string, string | number>) => string;

export function ReservationsPage() {
  const { messages, push } = useToast();
  const { t, locale } = useTranslation();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
  const [filterDomain, setFilterDomain] = useState<string>("");
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
    queryKey: ["widget-reservations", filterStatus, filterFrom, filterTo, filterDomain],
    queryFn: () =>
      reservationService.list({
        status: filterStatus || undefined,
        from: filterFrom || undefined,
        to: filterTo || undefined,
        domain: filterDomain || undefined,
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

  const getStatusLabel = useCallback(
    (status: string) => {
      const key = statusTranslationKeys[status];
      return key ? t(key) : status;
    },
    [t],
  );

  return (
    <section className="page">
      <ToastContainer messages={messages} />
      <PageHeader title={t("reservations.title")} subtitle={t("reservations.subtitle")} />

      {!env.ENABLE_INTERNAL_RESERVATIONS && (
        <div className="panel panel--muted" style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ marginTop: 0 }}>{t("reservations.widgetActiveTitle")}</h3>
          <p style={{ marginBottom: "0.5rem" }}>{t("reservations.widgetActiveBody")}</p>
          <a className="action-link" href="/docs/embedding_guide.md" target="_blank" rel="noreferrer">
            {t("reservations.widgetActiveLink")}
          </a>
        </div>
      )}

      <div className="panel">
        <div className="panel__header">
          <div>
            <h2 className="panel__title">{t("reservations.listTitle")}</h2>
            <p className="panel__subtitle">{t("reservations.listSubtitle")}</p>
          </div>
        </div>

        <DataToolbar
          searchValue={searchTerm}
          onSearchChange={handleSearchChange}
          placeholder="İsim, e-posta veya ID ile ara..."
          filters={
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <label className="form-field" style={{ marginBottom: 0 }}>
                <span className="form-field__label">{t("reservations.filter.status")}</span>
                <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
                  <option value="">{t("reservations.filter.all")}</option>
                  <option value="reserved">{t("reservations.filter.reserved")}</option>
                  <option value="active">{t("reservations.filter.active")}</option>
                  <option value="completed">{t("reservations.filter.completed")}</option>
                  <option value="cancelled">{t("reservations.filter.cancelled")}</option>
                  <option value="no_show">{t("reservations.filter.noShow")}</option>
                  {/* Legacy options for backward compatibility */}
                  <option value="pending">{t("reservations.filter.pending")}</option>
                  <option value="confirmed">{t("reservations.filter.confirmed")}</option>
                </select>
              </label>
              <label className="form-field">
                <span className="form-field__label">{t("reservations.filter.checkin")}</span>
                <input type="date" value={filterFrom} onChange={(event) => setFilterFrom(event.target.value)} />
              </label>
              <label className="form-field">
                <span className="form-field__label">{t("reservations.filter.checkout")}</span>
                <input type="date" value={filterTo} onChange={(event) => setFilterTo(event.target.value)} />
              </label>
              <label className="form-field">
                <span className="form-field__label">{t("reservations.filter.domain")}</span>
                <input
                  type="text"
                  placeholder={t("reservations.filter.domainPlaceholder")}
                  value={filterDomain}
                  onChange={(event) => setFilterDomain(event.target.value)}
                />
              </label>
            </div>
          }
        />

        {reservationsQuery.isLoading ? (
          <div className="empty-state">
            <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>⏳</div>
            <h3 className="empty-state__title">{t("reservations.loading")}</h3>
            <p>Rezervasyonlar yükleniyor...</p>
          </div>
        ) : reservations.length > 0 ? (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("reservations.table.guest")}</th>
                  <th>{t("reservations.table.contact")}</th>
                  <th>{t("reservations.table.checkinDate")}</th>
                  <th>{t("reservations.table.checkoutDate")}</th>
                  <th>{t("reservations.table.luggage")}</th>
                  <th>{t("reservations.table.status")}</th>
                  <th>{t("reservations.table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((reservation) =>
                  renderReservationRow({
                    reservation,
                    cancelReservationMutation,
                    completeReservationMutation,
                    isCheckingPayment,
                    formatDateTimeValue,
                    getStatusLabel,
                    t,
                    onViewDetail: (r) => {
                      setSelectedReservation(r);
                      setShowDetailModal(true);
                    },
                    onPaymentCheck: handlePaymentCheck,
                  }),
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>📋</div>
            <h3 className="empty-state__title">{t("reservations.emptyTitle")}</h3>
            <p>{t("reservations.emptyHint")}</p>
          </div>
        )}
      </div>

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
    </section>
  );
}

function renderReservationRow({
  reservation,
  cancelReservationMutation,
  completeReservationMutation,
  isCheckingPayment,
  formatDateTimeValue,
  getStatusLabel,
  t,
  onViewDetail,
  onPaymentCheck,
}: {
  reservation: Reservation;
  cancelReservationMutation: UseMutationResult<{ id: string | number; status: string }, unknown, string | number>;
  completeReservationMutation: UseMutationResult<{ id: string | number; status: string }, unknown, string | number>;
  isCheckingPayment: boolean;
  formatDateTimeValue: (value?: string | null) => string;
  getStatusLabel: (status: string) => string;
  t: TranslateFn;
  onViewDetail: (reservation: Reservation) => void;
  onPaymentCheck: (reservation: Reservation) => void;
}) {
  // Get dates - prefer start_at/end_at, fallback to checkin/checkout dates
  const checkinDate = reservation.start_at || reservation.start_datetime || reservation.checkin_date;
  const checkoutDate = reservation.end_at || reservation.end_datetime || reservation.checkout_date;
  
  const guestName = reservation.full_name || reservation.customer_name || reservation.guest_name;
  const guestEmail = reservation.guest_email || reservation.customer_email;
  const guestPhone = reservation.guest_phone || reservation.customer_phone || reservation.phone_number;

  // Payment info
  const paymentStatus = reservation.payment?.status;
  const paymentStatusKey = paymentStatus ? paymentStatusKeys[paymentStatus] : null;

  return (
    <tr key={reservation.id}>
      {/* Guest */}
      <td>
        <strong>{guestName ?? t("reservations.guestUnknown")}</strong>
        <div className="table-cell-muted" style={{ fontSize: "0.75rem" }}>#{String(reservation.id).slice(0, 8)}</div>
      </td>
      {/* Contact */}
      <td>
        <div style={{ fontSize: "0.875rem" }}>{guestEmail ?? "—"}</div>
        <div className="table-cell-muted" style={{ fontSize: "0.8rem" }}>{guestPhone ?? "—"}</div>
      </td>
      {/* Check-in */}
      <td>
        <div>{formatDateTimeValue(checkinDate)}</div>
      </td>
      {/* Check-out */}
      <td>
        <div>{formatDateTimeValue(checkoutDate)}</div>
      </td>
      {/* Luggage */}
      <td>
        <div>{t("reservations.baggageCount", { count: reservation.baggage_count ?? reservation.luggage_count ?? 0 })}</div>
        {reservation.luggage_type && (
          <div className="table-cell-muted" style={{ fontSize: "0.75rem" }}>
            {reservation.luggage_type}
          </div>
        )}
      </td>
      {/* Status */}
      <td>
        <StatusBadge status={reservation.status} label={getStatusLabel(reservation.status)} />
        {paymentStatus && (
          <div style={{ marginTop: "0.25rem" }}>
            <StatusBadge
              status={paymentStatus}
              label={paymentStatusKey ? t(paymentStatusKey) : paymentStatus}
            />
          </div>
        )}
      </td>
      {/* Actions - TÜM BUTONLAR HER ZAMAN GÖRÜNSİN */}
      <td>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetail(reservation)}
            isIcon
            aria-label="View details"
          >
            <Eye className="h-4 w-4" />
          </Button>

          <Button
            variant="primary"
            size="sm"
            disabled={
              completeReservationMutation.isPending ||
              reservation.status === "completed" ||
              reservation.status === "cancelled"
            }
            onClick={() => {
              if (window.confirm("Bu rezervasyonu teslim edildi olarak işaretlemek istiyor musunuz?")) {
                completeReservationMutation.mutate(reservation.id);
              }
            }}
          >
            <CheckCircle2 className="h-4 w-4" />
            <span style={{ marginLeft: "0.35rem" }}>{t("reservations.buttons.complete")}</span>
          </Button>

          <Button
            variant="danger"
            size="sm"
            disabled={
              cancelReservationMutation.isPending ||
              reservation.status === "completed" ||
              reservation.status === "cancelled"
            }
            onClick={() => {
              if (window.confirm("Bu rezervasyonu iptal etmek istediğinize emin misiniz?")) {
                cancelReservationMutation.mutate(reservation.id);
              }
            }}
          >
            <XOctagon className="h-4 w-4" />
            <span style={{ marginLeft: "0.35rem" }}>{t("reservations.buttons.cancelConfirmed")}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={isCheckingPayment}
            onClick={() => onPaymentCheck(reservation)}
          >
            <CreditCard className="h-4 w-4" />
            <span style={{ marginLeft: "0.35rem" }}>{t("payment.button.check")}</span>
          </Button>
        </div>
      </td>
    </tr>
  );
}
