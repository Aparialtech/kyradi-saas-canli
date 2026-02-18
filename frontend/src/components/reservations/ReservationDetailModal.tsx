import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "../common/Modal";
import { useTranslation } from "../../hooks/useTranslation";
import { QrCode, Copy, Check, User, Calendar, DollarSign, CreditCard } from "../../lib/lucide";
import { useToast } from "../../hooks/useToast";
import { reservationService, type Reservation } from "../../services/partner/reservations";
import { Badge } from "../ui/Badge";
import QRCode from "qrcode";

interface ReservationDetailModalProps {
  reservation: Reservation | null;
  isOpen: boolean;
  onClose: () => void;
}

interface ReservationDetailContentProps {
  reservation: Reservation | null;
  isOpen: boolean;
}

const statusLabels: Record<string, string> = {
  reserved: "Rezerve",
  active: "Aktif",
  completed: "Tamamlandı",
  cancelled: "İptal Edildi",
  no_show: "Gelmedi",
  pending: "Beklemede",
  confirmed: "Onaylandı",
};

const statusColors: Record<string, string> = {
  reserved: "#f59e0b",
  active: "#16a34a",
  completed: "#1d4ed8",
  cancelled: "#dc2626",
  no_show: "#6b7280",
  pending: "#f59e0b",
  confirmed: "#16a34a",
};

export function ReservationDetailContent({ reservation, isOpen }: ReservationDetailContentProps) {
  // ALL HOOKS MUST BE CALLED UNCONDITIONALLY AT THE TOP
  const { t } = useTranslation();
  const { push } = useToast();
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const reservationQuery = useQuery({
    queryKey: ["reservation-detail", reservation?.id],
    queryFn: () => reservationService.getById(reservation!.id),
    enabled: !!reservation?.id && isOpen,
    staleTime: 10000,
  });

  // Fetch payment info for this reservation
  const paymentQuery = useQuery({
    queryKey: ["reservation-payment", reservation?.id],
    queryFn: () => reservationService.getPayment(reservation!.id),
    enabled: !!reservation?.id && isOpen,
    staleTime: 30000,
  });

  const formatDate = useCallback((dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleString("tr-TR", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return dateStr;
    }
  }, []);

  const formatCurrency = useCallback((minor?: number | null) => {
    if (minor == null) return "—";
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }).format(minor / 100);
  }, []);

  // Memoize qrText to prevent infinite loops when reservation object reference changes
  // Use only primitive values (id, qr_code, qr_token) as dependencies to avoid re-renders
  // when the reservation object reference changes but values remain the same
  const reservationId = reservation?.id;
  const reservationQrCode = reservation?.qr_code;
  const reservationQrToken = reservation?.qr_token;
  
  const qrText = useMemo(() => {
    if (!reservation) return "";
    return reservationQrCode || reservationQrToken || "";
  }, [reservation, reservationId, reservationQrCode, reservationQrToken]);

  useEffect(() => {
    let mounted = true;
    if (!qrText) {
      setQrDataUrl("");
      return;
    }
    QRCode.toDataURL(qrText, {
      width: 156,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((url: string) => {
        if (mounted) setQrDataUrl(url);
      })
      .catch(() => {
        if (mounted) setQrDataUrl("");
      });
    return () => {
      mounted = false;
    };
  }, [qrText]);

  // Early return AFTER all hooks (this is safe)
  if (!reservation) return null;

  const displayReservation = reservationQuery.data ?? reservation;
  const displayPayment = paymentQuery.data ?? displayReservation.payment ?? null;

  const guestName =
    displayReservation.full_name ??
    displayReservation.customer_name ??
    displayReservation.guest_name ??
    "—";
  const guestEmail =
    displayReservation.customer_email ??
    displayReservation.guest_email ??
    "—";
  const guestPhone =
    displayReservation.customer_phone ??
    displayReservation.guest_phone ??
    displayReservation.phone_number ??
    "—";

  const statusColor = statusColors[displayReservation.status] ?? "#6b7280";

  const isPickupDone = Boolean(displayReservation.handover_at);
  const isDelivered = Boolean(displayReservation.returned_at);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Header with status */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: "1rem",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div>
            <h4 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>
              #{displayReservation.id}
            </h4>
              <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.875rem" }}>
              {t("common.createdAt")}: {formatDate(displayReservation.created_at)}
            </p>
          </div>
          <span
            style={{
              padding: "0.375rem 0.875rem",
              borderRadius: "9999px",
              fontSize: "0.875rem",
              fontWeight: 600,
              background: `${statusColor}20`,
              color: statusColor,
            }}
          >
            {statusLabels[displayReservation.status] ?? displayReservation.status}
          </span>
          {isDelivered ? (
            <Badge variant="success">Teslim Edildi</Badge>
          ) : isPickupDone ? (
            <Badge variant="info">Teslim Alındı</Badge>
          ) : null}
        </div>

        {/* Guest Information */}
        <section>
          <h5 style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 600, color: "#475569", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <User className="h-4 w-4" />
            Misafir Bilgileri
          </h5>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "0.75rem",
              background: "#f8fafc",
              padding: "1rem",
              borderRadius: "8px",
            }}
          >
            <div>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Ad Soyad</span>
              <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>
                {guestName}
              </p>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>E-posta</span>
              <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>{guestEmail}</p>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Telefon</span>
              <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>
                {guestPhone}
              </p>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Oda No</span>
              <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>{displayReservation.hotel_room_number ?? "—"}</p>
            </div>
            {displayReservation.tc_identity_number && (
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>TC Kimlik No</span>
                <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>
                  ****{displayReservation.tc_identity_number.slice(-2)}
                </p>
              </div>
            )}
            {displayReservation.passport_number && (
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Pasaport No</span>
                <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>
                  ****{displayReservation.passport_number.slice(-2)}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Reservation Details */}
        <section>
          <h5 style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 600, color: "#475569", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Calendar className="h-4 w-4" />
            Rezervasyon Bilgileri
          </h5>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "0.75rem",
              background: "#f8fafc",
              padding: "1rem",
              borderRadius: "8px",
            }}
          >
            <div>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Giriş Tarihi</span>
              <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>
                {formatDate(displayReservation.start_datetime || displayReservation.start_at || displayReservation.checkin_date)}
              </p>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Çıkış Tarihi</span>
              <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>
                {formatDate(displayReservation.end_datetime || displayReservation.end_at || displayReservation.checkout_date)}
              </p>
            </div>
            {displayReservation.duration_hours && (
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Süre</span>
                <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>{displayReservation.duration_hours.toFixed(1)} saat</p>
              </div>
            )}
            <div>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Depo</span>
              <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>
                {displayReservation.storage_code || displayReservation.storage_id || "Atanmadı"}
              </p>
              {displayReservation.location_name && (
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "#64748b" }}>
                  Lokasyon: {displayReservation.location_name}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Luggage Information */}
        <section>
          <h5 style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 600, color: "#475569" }}>
            🧳 Bavul Bilgileri
          </h5>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "0.75rem",
              background: "#f8fafc",
              padding: "1rem",
              borderRadius: "8px",
            }}
          >
            <div>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Bavul Sayısı</span>
              <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>
                {displayReservation.baggage_count ?? displayReservation.luggage_count ?? 1} adet
              </p>
            </div>
            {displayReservation.luggage_type && (
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Bavul Tipi</span>
                <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>{displayReservation.luggage_type}</p>
              </div>
            )}
            {displayReservation.locker_size && (
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Dolap Boyutu</span>
                <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>{displayReservation.locker_size}</p>
              </div>
            )}
            {displayReservation.luggage_description && (
              <div style={{ gridColumn: "1 / -1" }}>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Açıklama</span>
                <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>{displayReservation.luggage_description}</p>
              </div>
            )}
          </div>
        </section>

        {/* Price Information */}
        {(displayReservation.estimated_total_price || displayReservation.hourly_rate) && (
          <section>
            <h5 style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 600, color: "#475569", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <DollarSign className="h-4 w-4" />
              Ücret Bilgileri
            </h5>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "0.75rem",
                background: "#f0fdf4",
                padding: "1rem",
                borderRadius: "8px",
                border: "1px solid #bbf7d0",
              }}
            >
              {displayReservation.hourly_rate && (
                <div>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Saatlik Ücret</span>
                  <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>
                    {formatCurrency(displayReservation.hourly_rate)}
                  </p>
                </div>
              )}
              {displayReservation.estimated_total_price && (
                <div>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Toplam Tutar</span>
                  <p style={{ margin: "0.25rem 0 0", fontWeight: 600, fontSize: "1.125rem", color: "#16a34a" }}>
                    {formatCurrency(displayReservation.estimated_total_price)}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Payment Information - Combined Section */}
        <section>
          <h5 style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 600, color: "#475569", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <CreditCard className="h-4 w-4" />
            Ödeme Bilgileri
          </h5>
          {paymentQuery.isLoading && !displayPayment ? (
            <div style={{ padding: "1rem", textAlign: "center", color: "#64748b" }}>
              Ödeme bilgileri yükleniyor...
            </div>
          ) : displayPayment ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "0.75rem",
                background: displayPayment.status === 'paid' || displayPayment.status === 'captured' ? "#f0fdf4" : "#fefce8",
                padding: "1rem",
                borderRadius: "8px",
                border: `1px solid ${displayPayment.status === 'paid' || displayPayment.status === 'captured' ? "#bbf7d0" : "#fef08a"}`,
              }}
            >
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Ödeme Durumu</span>
                <p style={{ margin: "0.25rem 0 0" }}>
                  <Badge variant={
                    displayPayment.status === 'paid' || displayPayment.status === 'captured' ? 'success' :
                    displayPayment.status === 'pending' ? 'warning' :
                    displayPayment.status === 'failed' ? 'danger' : 'neutral'
                  }>
                    {displayPayment.status === 'paid' ? 'Ödendi' :
                     displayPayment.status === 'captured' ? 'Tahsil Edildi' :
                     displayPayment.status === 'pending' ? 'Beklemede' :
                     displayPayment.status === 'failed' ? 'Başarısız' :
                     displayPayment.status}
                  </Badge>
                </p>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Ödeme Tutarı</span>
                <p style={{ margin: "0.25rem 0 0", fontWeight: 600, color: "#16a34a" }}>
                  {formatCurrency(displayPayment.amount_minor)}
                </p>
              </div>
              {displayPayment.mode && (
                <div>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Ödeme Yöntemi</span>
                  <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>
                    {displayPayment.mode === 'CASH' ? 'Nakit' :
                     displayPayment.mode === 'POS' ? 'POS / Kart' :
                     displayPayment.mode === 'GATEWAY_LIVE' ? 'Online Ödeme' :
                     displayPayment.mode}
                  </p>
                </div>
              )}
              {displayPayment.paid_at && (
                <div>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Ödeme Tarihi</span>
                  <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>
                    {formatDate(displayPayment.paid_at)}
                  </p>
                </div>
              )}
              {displayPayment.transaction_id && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>İşlem ID</span>
                  <p style={{ margin: "0.25rem 0 0", fontWeight: 500, fontFamily: "monospace", fontSize: "0.75rem" }}>
                    {displayPayment.transaction_id}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                background: "#f8fafc",
                padding: "1rem",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                textAlign: "center",
                color: "#64748b",
              }}
            >
              Bu rezervasyon için ödeme bilgisi bulunamadı.
            </div>
          )}
        </section>

        {/* QR Code */}
        {(displayReservation.qr_code || displayReservation.qr_token) && (
          <section>
            <h5 style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 600, color: "#475569", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <QrCode className="h-4 w-4" /> QR Kod
            </h5>
            <div
              style={{
                background: "#f8fafc",
                padding: "1.5rem",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                textAlign: "center",
              }}
            >
              {qrDataUrl ? (
                <>
                  <div
                    style={{
                      display: "inline-block",
                      padding: "1rem",
                      background: "white",
                      borderRadius: "8px",
                      border: "2px solid #e2e8f0",
                      marginBottom: "1rem",
                    }}
                  >
                    <img src={qrDataUrl} alt="Rezervasyon QR kodu" style={{ width: 156, height: 156 }} />
                  </div>
                  <div style={{ marginBottom: "0.75rem" }}>
                    <code
                      style={{
                        fontSize: "0.875rem",
                        fontFamily: "monospace",
                        background: "#f1f5f9",
                        padding: "0.5rem 1rem",
                        borderRadius: "6px",
                        display: "inline-block",
                        color: "#0f172a",
                      }}
                    >
                      {qrText}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(qrText).then(() => {
                        setCopied(true);
                        push({ title: "QR kodu kopyalandı", type: "success" });
                        setTimeout(() => setCopied(false), 2000);
                      });
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.5rem 1rem",
                      background: "#0f172a",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                    }}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Kopyalandı" : "Kopyala"}
                  </button>
                </>
              ) : (
                <p style={{ margin: 0, color: "#475569" }}>
                  Bu rezervasyon için QR kodu bulunamadı.
                </p>
              )}
            </div>
          </section>
        )}

        {/* Notes */}
        {displayReservation.notes && (
          <section>
            <h5 style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 600, color: "#475569" }}>
              📝 Notlar
            </h5>
            <div
              style={{
                background: "#fefce8",
                padding: "1rem",
                borderRadius: "8px",
                border: "1px solid #fef08a",
              }}
            >
              <p style={{ margin: 0, fontSize: "0.875rem" }}>{displayReservation.notes}</p>
            </div>
          </section>
        )}

        {/* Source */}
        {displayReservation.origin && (
          <div style={{ fontSize: "0.75rem", color: "#64748b", textAlign: "right" }}>
            Kaynak: {(() => {
              try {
                return new URL(displayReservation.origin).hostname;
              } catch {
                return displayReservation.origin;
              }
            })()}
          </div>
        )}
      </div>
  );
}

export function ReservationDetailModal({ reservation, isOpen, onClose }: ReservationDetailModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rezervasyon Detayı" width="600px">
      <ReservationDetailContent reservation={reservation} isOpen={isOpen} />
    </Modal>
  );
}
