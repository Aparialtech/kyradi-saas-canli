import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { reservationService, type Reservation, type Payment } from "../../../services/partner/reservations";
import { demoService } from "../../../services/partner/demo";
import { magicpayService } from "../../../services/partner/magicpay";
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

  const confirmMutation = useMutation<Reservation, unknown, number>({
    mutationFn: (id) => reservationService.confirm(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["widget-reservations"] });
      push({ title: t("reservations.toast.confirmSuccess"), type: "success" });
    },
    onError: (error: unknown) =>
      push({ title: t("reservations.toast.confirmError"), description: getErrorMessage(error), type: "error" }),
  });

  const cancelMutation = useMutation<Reservation, unknown, number>({
    mutationFn: (id) => reservationService.cancel(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["widget-reservations"] });
      push({ title: t("reservations.toast.cancelSuccess"), type: "info" });
    },
    onError: (error: unknown) =>
      push({ title: t("reservations.toast.cancelError"), description: getErrorMessage(error), type: "error" }),
  });

  const convertAndPayMutation = useMutation({
    mutationFn: async (widgetReservationId: number) => {
      // First convert widget reservation to normal reservation
      const convertResult = await demoService.convertWidgetReservation(widgetReservationId);
      
      // Then create MagicPay checkout session
      const checkoutResult = await magicpayService.createCheckoutSession(convertResult.reservation_id);
      
      return { convertResult, checkoutResult };
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["widget-reservations"] });
      push({
        title: "Ödeme sayfasına yönlendiriliyorsunuz",
        description: "MagicPay ile ödemeye yönlendiriliyorsunuz...",
        type: "success",
      });
      // Redirect to MagicPay demo page
      setTimeout(() => {
        window.location.href = data.checkoutResult.checkout_url;
      }, 1000);
    },
    onError: (error: unknown) => {
      push({
        title: "Ödeme başlatılamadı",
        description: getErrorMessage(error),
        type: "error",
      });
    },
  });

  const luggageReceivedMutation = useMutation<Reservation, unknown, string>({
    mutationFn: (id: string) => reservationService.markLuggageReceived(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["widget-reservations"] });
      push({ title: t("reservations.toast.luggageReceivedSuccess"), type: "success" });
    },
    onError: (error: unknown) =>
      push({ title: t("reservations.toast.luggageReceivedError"), description: getErrorMessage(error), type: "error" }),
  });

  const noShowMutation = useMutation<Reservation, unknown, string>({
    mutationFn: (id: string) => reservationService.markNoShow(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["widget-reservations"] });
      push({ title: t("reservations.toast.noShowSuccess"), type: "info" });
    },
    onError: (error: unknown) =>
      push({ title: t("reservations.toast.noShowError"), description: getErrorMessage(error), type: "error" }),
  });

  const luggageReturnedMutation = useMutation<Reservation, unknown, string>({
    mutationFn: (id: string) => reservationService.markLuggageReturned(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["widget-reservations"] });
      push({ title: t("reservations.toast.luggageReturnedSuccess"), type: "success" });
    },
    onError: (error: unknown) =>
      push({ title: t("reservations.toast.luggageReturnedError"), description: getErrorMessage(error), type: "error" }),
  });

  const markReturnedMutation = useMutation<any, unknown, { id: string }>({
    mutationFn: ({ id }) => reservationService.markReturned(id, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["widget-reservations"] });
      push({ title: t("reservations.toast.returnedSuccess"), type: "success" });
    },
    onError: (error: unknown) =>
      push({ title: t("reservations.toast.returnedError"), description: getErrorMessage(error), type: "error" }),
  });

  const cancelReservationMutation = useMutation<{ id: string; status: string }, unknown, string>({
    mutationFn: (id: string) => reservationService.cancelReservation(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["widget-reservations"] });
      push({ title: t("reservations.toast.cancelSuccess"), type: "info" });
    },
    onError: (error: unknown) =>
      push({ title: t("reservations.toast.cancelError"), description: getErrorMessage(error), type: "error" }),
  });

  // Complete reservation (deliver luggage)
  const completeReservationMutation = useMutation<{ id: string; status: string }, unknown, string>({
    mutationFn: (id: string) => reservationService.completeReservation(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["widget-reservations"] });
      push({ title: t("reservations.toast.completeSuccess"), type: "success" });
    },
    onError: (error: unknown) =>
      push({ title: t("reservations.toast.completeError"), description: getErrorMessage(error), type: "error" }),
  });

  // Ensure payment exists
  const ensurePaymentMutation = useMutation<Payment, unknown, string>({
    mutationFn: (id: string) => reservationService.ensurePayment(id),
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

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    [locale],
  );

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

  const formatDateValue = useCallback(
    (value?: string | null) => {
      if (!value) return "—";
      try {
        return dateFormatter.format(new Date(value));
      } catch {
        return value;
      }
    },
    [dateFormatter],
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

  const maskIdentityNumber = useCallback((value?: string | null) => {
    if (!value) return null;
    if (value.length <= 4) return value;
    return `****${value.slice(-2)}`;
  }, []);

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
                    confirmMutation,
                    cancelMutation,
                    convertAndPayMutation,
                    luggageReceivedMutation,
                    noShowMutation,
                    luggageReturnedMutation,
                    markReturnedMutation,
                    cancelReservationMutation,
                    completeReservationMutation,
                    ensurePaymentMutation,
                    formatDateValue,
                    formatDateTimeValue,
                    getStatusLabel,
                    maskIdentityNumber,
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
  confirmMutation,
  cancelMutation,
  convertAndPayMutation,
  luggageReceivedMutation,
  noShowMutation,
  luggageReturnedMutation,
  markReturnedMutation,
  cancelReservationMutation,
  completeReservationMutation,
  ensurePaymentMutation,
  formatDateValue,
  formatDateTimeValue,
  getStatusLabel,
  maskIdentityNumber,
  t,
  onViewDetail,
}: {
  reservation: Reservation;
  confirmMutation: UseMutationResult<Reservation, unknown, number>;
  cancelMutation: UseMutationResult<Reservation, unknown, number>;
  convertAndPayMutation: UseMutationResult<unknown, unknown, number>;
  luggageReceivedMutation: UseMutationResult<Reservation, unknown, string>;
  noShowMutation: UseMutationResult<Reservation, unknown, string>;
  luggageReturnedMutation: UseMutationResult<Reservation, unknown, string>;
  markReturnedMutation: UseMutationResult<unknown, unknown, { id: string }>;
  cancelReservationMutation: UseMutationResult<{ id: string; status: string }, unknown, string>;
  completeReservationMutation: UseMutationResult<{ id: string; status: string }, unknown, string>;
  ensurePaymentMutation: UseMutationResult<Payment, unknown, string>;
  formatDateValue: (value?: string | null) => string;
  formatDateTimeValue: (value?: string | null) => string;
  getStatusLabel: (status: string) => string;
  maskIdentityNumber: (value?: string | null) => string | null;
  t: TranslateFn;
  onViewDetail: (reservation: Reservation) => void;
}) {
  // Get dates - prefer start_at/end_at, fallback to checkin/checkout dates
  const checkinDate = reservation.start_at || reservation.start_datetime || reservation.checkin_date;
  const checkoutDate = reservation.end_at || reservation.end_datetime || reservation.checkout_date;
  
  // Check if this is a UUID (normal reservation) or numeric (widget reservation)
  const isNormalReservation = String(reservation.id).length >= 32;
  
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
      {/* Actions */}
      <td>
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          {/* Detail button - always visible */}
          <button
            type="button"
            className="btn btn--ghost"
            style={{ fontSize: "0.75rem", padding: "0.35rem 0.5rem" }}
            onClick={() => onViewDetail(reservation)}
            title={t("reservations.buttons.detail")}
          >
            🔍 {t("reservations.buttons.detail")}
          </button>

          {/* RESERVED status: Show luggage received or no-show buttons */}
          {(reservation.status === "reserved" || reservation.status === "pending") && (
            <>
              <button
                type="button"
                className="btn btn--primary"
                style={{ fontSize: "0.75rem", padding: "0.35rem 0.5rem" }}
                disabled={confirmMutation.isPending || convertAndPayMutation.isPending || luggageReceivedMutation.isPending}
                onClick={() => {
                  if (!isNormalReservation) {
                    confirmMutation.mutate(Number(reservation.id));
                  } else {
                    luggageReceivedMutation.mutate(String(reservation.id));
                  }
                }}
              >
                {t("reservations.buttons.luggageReceived")}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                style={{ fontSize: "0.75rem", padding: "0.35rem 0.5rem", borderColor: "#fecaca", color: "#b91c1c" }}
                disabled={noShowMutation.isPending || cancelMutation.isPending}
                onClick={() => {
                  if (!isNormalReservation) {
                    cancelMutation.mutate(Number(reservation.id));
                  } else {
                    noShowMutation.mutate(String(reservation.id));
                  }
                }}
              >
                {t("reservations.buttons.noShow")}
              </button>
            </>
          )}

          {/* ACTIVE status: Complete (Teslim Et), Cancel, and Payment Check */}
          {(reservation.status === "active" || reservation.status === "confirmed") && (
            <>
              <button
                type="button"
                className="btn btn--primary"
                style={{ fontSize: "0.75rem", padding: "0.35rem 0.5rem" }}
                disabled={completeReservationMutation.isPending || luggageReturnedMutation.isPending}
                onClick={() => {
                  if (!isNormalReservation) {
                    markReturnedMutation.mutate({ id: String(reservation.id) });
                  } else {
                    completeReservationMutation.mutate(String(reservation.id));
                  }
                }}
                title={t("reservations.confirmComplete")}
              >
                ✅ {t("reservations.buttons.complete")}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                style={{ fontSize: "0.75rem", padding: "0.35rem 0.5rem", borderColor: "#fecaca", color: "#b91c1c" }}
                disabled={cancelReservationMutation.isPending || cancelMutation.isPending}
                onClick={() => {
                  if (window.confirm(t("reservations.confirmCancel"))) {
                    if (!isNormalReservation) {
                      cancelMutation.mutate(Number(reservation.id));
                    } else {
                      cancelReservationMutation.mutate(String(reservation.id));
                    }
                  }
                }}
              >
                ❌ {t("reservations.buttons.cancel")}
              </button>
              {isNormalReservation && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  style={{ fontSize: "0.75rem", padding: "0.35rem 0.5rem" }}
                  disabled={ensurePaymentMutation.isPending}
                  onClick={() => ensurePaymentMutation.mutate(String(reservation.id))}
                  title={t("reservations.buttons.checkPayment")}
                >
                  💳 {t("reservations.buttons.checkPayment")}
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
