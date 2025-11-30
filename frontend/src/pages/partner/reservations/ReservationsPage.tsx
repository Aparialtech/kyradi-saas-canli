import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { reservationService, type Reservation } from "../../../services/partner/reservations";
import { demoService } from "../../../services/partner/demo";
import { magicpayService } from "../../../services/partner/magicpay";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { getErrorMessage } from "../../../lib/httpError";
import { env } from "../../../config/env";
import { useTranslation } from "../../../hooks/useTranslation";
import type { TranslationKey } from "../../../i18n/translations";

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

  const cancelReservationMutation = useMutation<any, unknown, string>({
    mutationFn: (id: string) => reservationService.cancel(Number(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["widget-reservations"] });
      push({ title: t("reservations.toast.cancelSuccess"), type: "info" });
    },
    onError: (error: unknown) =>
      push({ title: t("reservations.toast.cancelError"), description: getErrorMessage(error), type: "error" }),
  });

  const reservations = reservationsQuery.data ?? [];
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
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

        <div className="panel__filters">
          <label className="form-field">
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
                  <th>{t("reservations.table.identity")}</th>
                  <th>{t("reservations.table.date")}</th>
                  <th>{t("reservations.table.luggage")}</th>
                  <th>{t("reservations.table.room")}</th>
                  <th>{t("reservations.table.status")}</th>
                  <th>{t("reservations.table.domain")}</th>
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
                    formatDateValue,
                    getStatusLabel,
                    maskIdentityNumber,
                    t,
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
  formatDateValue,
  getStatusLabel,
  maskIdentityNumber,
  t,
}: {
  reservation: Reservation;
  confirmMutation: UseMutationResult<Reservation, unknown, number>;
  cancelMutation: UseMutationResult<Reservation, unknown, number>;
  convertAndPayMutation: UseMutationResult<any, unknown, number>;
  luggageReceivedMutation: UseMutationResult<Reservation, unknown, string>;
  noShowMutation: UseMutationResult<Reservation, unknown, string>;
  luggageReturnedMutation: UseMutationResult<Reservation, unknown, string>;
  markReturnedMutation: UseMutationResult<any, unknown, { id: string }>;
  cancelReservationMutation: UseMutationResult<any, unknown, string>;
  formatDateValue: (value?: string | null) => string;
  getStatusLabel: (status: string) => string;
  maskIdentityNumber: (value?: string | null) => string | null;
  t: TranslateFn;
}) {
  const identityNumber = reservation.tc_identity_number 
    ? `TC: ${maskIdentityNumber(reservation.tc_identity_number)}`
    : reservation.passport_number
    ? `Pasaport: ${maskIdentityNumber(reservation.passport_number)}`
    : "—";

  return (
    <tr key={reservation.id}>
      <td>
        <strong>{reservation.full_name ?? reservation.guest_name ?? t("reservations.guestUnknown")}</strong>
        <div className="table-cell-muted">#{reservation.id}</div>
      </td>
      <td>
        <div>{reservation.guest_email ?? "—"}</div>
        <div className="table-cell-muted">{reservation.guest_phone ?? reservation.phone_number ?? "-"}</div>
      </td>
      <td>
        <div className="table-cell-muted" style={{ fontSize: "0.875rem" }}>{identityNumber}</div>
      </td>
      <td>
        {formatDateValue(reservation.checkin_date)} → {formatDateValue(reservation.checkout_date)}
      </td>
      <td>
        <div>{t("reservations.baggageCount", { count: reservation.baggage_count ?? reservation.luggage_count ?? 0 })}</div>
        {reservation.luggage_type && (
          <div className="table-cell-muted" style={{ fontSize: "0.75rem" }}>
            {reservation.luggage_type}
          </div>
        )}
        {reservation.luggage_description && (
          <div className="table-cell-muted" style={{ fontSize: "0.75rem", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={reservation.luggage_description}>
            {reservation.luggage_description}
          </div>
        )}
      </td>
      <td>{reservation.hotel_room_number ?? "—"}</td>
      <td>
        <span className={statusClassMap[reservation.status] ?? "badge"}>
          {getStatusLabel(reservation.status)}
        </span>
        {reservation.notes && (
          <div className="table-cell-muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={reservation.notes}>
            📝 {reservation.notes}
          </div>
        )}
      </td>
      <td>{reservation.origin ? new URL(reservation.origin).hostname : "—"}</td>
      <td>
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          {/* RESERVED status: Show luggage received or no-show buttons */}
          {(reservation.status === "reserved" || reservation.status === "pending") && (
            <>
              <button
                type="button"
                className="btn btn--primary"
                disabled={confirmMutation.isPending || convertAndPayMutation.isPending}
                onClick={() => {
                  // For widget reservations, use confirm endpoint; for normal reservations, use luggage-received
                  if (reservation.id.toString().length < 36) {
                    // Widget reservation (numeric ID)
                    confirmMutation.mutate(reservation.id);
                  } else {
                    // Normal reservation (UUID)
                    luggageReceivedMutation.mutate(reservation.id.toString());
                  }
                }}
              >
                {t("reservations.buttons.luggageReceived")}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                style={{ borderColor: "#fecaca", color: "#b91c1c" }}
                disabled={noShowMutation.isPending || cancelMutation.isPending}
                onClick={() => {
                  if (reservation.id.toString().length < 36) {
                    cancelMutation.mutate(reservation.id);
                  } else {
                    noShowMutation.mutate(reservation.id.toString());
                  }
                }}
              >
                {t("reservations.buttons.noShow")}
              </button>
              {reservation.status === "pending" && (
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={convertAndPayMutation.isPending}
                  onClick={() => convertAndPayMutation.mutate(reservation.id)}
                  style={{ fontSize: "0.875rem", padding: "0.5rem 0.75rem" }}
                >
                  {convertAndPayMutation.isPending ? "Yönlendiriliyor..." : "💳 Ödeme Yap"}
                </button>
              )}
            </>
          )}
          {/* ACTIVE status: Show luggage returned button */}
          {(reservation.status === "active" || reservation.status === "confirmed") && (
            <>
              <button
                type="button"
                className="btn btn--primary"
                disabled={luggageReturnedMutation.isPending}
                onClick={() => {
                  if (reservation.id.toString().length < 36) {
                    // Widget reservation - use legacy return endpoint
                    markReturnedMutation.mutate({ id: reservation.id.toString() });
                  } else {
                    luggageReturnedMutation.mutate(reservation.id.toString());
                  }
                }}
              >
                {t("reservations.buttons.luggageReturned")}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                style={{ borderColor: "#fecaca", color: "#b91c1c" }}
                disabled={cancelMutation.isPending}
                onClick={() => {
                  if (reservation.id.toString().length < 36) {
                    cancelMutation.mutate(reservation.id);
                  } else {
                    cancelReservationMutation.mutate(reservation.id.toString());
                  }
                }}
              >
                {t("reservations.buttons.cancel")}
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
