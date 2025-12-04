import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { reservationService, type Reservation, type Payment } from "../../../services/partner/reservations";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { SearchInput } from "../../../components/common/SearchInput";
import { ReservationDetailModal } from "../../../components/reservations/ReservationDetailModal";
import { getErrorMessage } from "../../../lib/httpError";
import { env } from "../../../config/env";
import { useTranslation } from "../../../hooks/useTranslation";
import type { TranslationKey } from "../../../i18n/translations";

// Payment status mapping
const paymentStatusClassMap: Record<string, string> = {
  pending: "badge badge--warning",
  paid: "badge badge--success",
  captured: "badge badge--success",
  cancelled: "badge badge--muted",
  failed: "badge badge--danger",
};

const paymentStatusKeys: Record<string, TranslationKey> = {
  pending: "reservations.paymentStatus.pending",
  paid: "reservations.paymentStatus.paid",
  captured: "reservations.paymentStatus.captured",
  cancelled: "reservations.paymentStatus.cancelled",
  failed: "reservations.paymentStatus.failed",
};

const statusClassMap: Record<string, string> = {
  reserved: "badge badge--warning",
  active: "badge badge--success",
  completed: "badge badge--info",
  cancelled: "badge badge--danger",
  no_show: "badge badge--muted",
  // Legacy statuses for backward compatibility
  pending: "badge badge--warning",
  confirmed: "badge badge--success",
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

  // Ensure payment exists - works for both widget and normal reservations
  const ensurePaymentMutation = useMutation<Payment | { id: number; status: string; message: string }, unknown, string | number>({
    mutationFn: (id: string | number) => reservationService.ensurePayment(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["widget-reservations"] });
      push({ title: t("reservations.toast.paymentCheckSuccess"), type: "success" });
    },
    onError: (error: unknown) =>
      push({ title: t("reservations.toast.paymentCheckError"), description: getErrorMessage(error), type: "error" }),
  });

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
      <header className="page-header">
        <div>
          <h1 className="page-title">{t("reservations.title")}</h1>
          <p className="page-subtitle">{t("reservations.subtitle")}</p>
        </div>
      </header>

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

        <div className="panel__filters" style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ minWidth: "250px" }}>
            <SearchInput
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="İsim, e-posta veya ID ile ara..."
            />
          </div>
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
                    ensurePaymentMutation,
                    formatDateTimeValue,
                    getStatusLabel,
                    t,
                    onViewDetail: (r) => {
                      setSelectedReservation(r);
                      setShowDetailModal(true);
                    },
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
    </section>
  );
}

function renderReservationRow({
  reservation,
  cancelReservationMutation,
  completeReservationMutation,
  ensurePaymentMutation,
  formatDateTimeValue,
  getStatusLabel,
  t,
  onViewDetail,
}: {
  reservation: Reservation;
  cancelReservationMutation: UseMutationResult<{ id: string | number; status: string }, unknown, string | number>;
  completeReservationMutation: UseMutationResult<{ id: string | number; status: string }, unknown, string | number>;
  ensurePaymentMutation: UseMutationResult<Payment | { id: number; status: string; message: string }, unknown, string | number>;
  formatDateTimeValue: (value?: string | null) => string;
  getStatusLabel: (status: string) => string;
  t: TranslateFn;
  onViewDetail: (reservation: Reservation) => void;
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
  const paymentBadgeClass = paymentStatus ? paymentStatusClassMap[paymentStatus] : "badge badge--muted";

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
        <span className={statusClassMap[reservation.status] ?? "badge"}>
          {getStatusLabel(reservation.status)}
        </span>
        {paymentStatus && (
          <div style={{ marginTop: "0.25rem" }}>
            <span className={paymentBadgeClass} style={{ fontSize: "0.7rem" }}>
              💳 {paymentStatusKey ? t(paymentStatusKey) : paymentStatus}
            </span>
          </div>
        )}
      </td>
      {/* Actions - TÜM BUTONLAR HER ZAMAN GÖRÜNSİN */}
      <td>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          {/* 1. Detay Butonu - Her zaman görünür */}
          <button
            type="button"
            className="btn btn--outline"
            style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem" }}
            onClick={() => onViewDetail(reservation)}
          >
            🔍 Detay
          </button>

          {/* 2. Teslim Et Butonu - Her zaman görünür */}
          <button
            type="button"
            className="btn btn--primary"
            style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem" }}
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
            ✅ Teslim Et
          </button>

          {/* 3. İptal Et Butonu - Her zaman görünür */}
          <button
            type="button"
            className="btn btn--danger"
            style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem", backgroundColor: "#dc2626", color: "white" }}
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
            ❌ İptal Et
          </button>

          {/* 4. Ödeme Kontrol Butonu - Her zaman görünür */}
          <button
            type="button"
            className="btn btn--outline"
            style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem" }}
            disabled={ensurePaymentMutation.isPending}
            onClick={() => {
              ensurePaymentMutation.mutate(reservation.id);
            }}
          >
            💳 Ödeme Kontrol
          </button>
        </div>
      </td>
    </tr>
  );
}
