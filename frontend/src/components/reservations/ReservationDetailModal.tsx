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

export function ReservationDetailModal({ reservation, isOpen, onClose }: ReservationDetailModalProps) {
  // ALL HOOKS MUST BE CALLED UNCONDITIONALLY AT THE TOP
  const { t } = useTranslation();
  const { push } = useToast();
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

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

  const statusColor = statusColors[reservation.status] ?? "#6b7280";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rezervasyon Detayı" width="600px">
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
              #{reservation.id}
            </h4>
            <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.875rem" }}>
              {t("common.createdAt")}: {formatDate(reservation.created_at)}
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
            {statusLabels[reservation.status] ?? reservation.status}
          </span>
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
                {reservation.full_name ?? reservation.guest_name ?? "—"}
              </p>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>E-posta</span>
              <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>{reservation.guest_email ?? "—"}</p>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Telefon</span>
              <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>
                {reservation.guest_phone ?? reservation.phone_number ?? "—"}
              </p>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Oda No</span>
              <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>{reservation.hotel_room_number ?? "—"}</p>
            </div>
            {reservation.tc_identity_number && (
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>TC Kimlik No</span>
                <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>
                  ****{reservation.tc_identity_number.slice(-2)}
                </p>
              </div>
            )}
            {reservation.passport_number && (
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Pasaport No</span>
                <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>
                  ****{reservation.passport_number.slice(-2)}
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
                {formatDate(reservation.start_datetime || reservation.start_at || reservation.checkin_date)}
              </p>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Çıkış Tarihi</span>
              <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>
                {formatDate(reservation.end_datetime || reservation.end_at || reservation.checkout_date)}
              </p>
            </div>
            {reservation.duration_hours && (
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Süre</span>
                <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>{reservation.duration_hours.toFixed(1)} saat</p>
              </div>
            )}
            <div>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Depo</span>
              <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>
                {reservation.storage_code || reservation.storage_id || "Atanmadı"}
              </p>
              {reservation.location_name && (
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "#64748b" }}>
                  Lokasyon: {reservation.location_name}
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
                {reservation.baggage_count ?? reservation.luggage_count ?? 1} adet
              </p>
            </div>
            {reservation.luggage_type && (
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Bavul Tipi</span>
                <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>{reservation.luggage_type}</p>
              </div>
            )}
            {reservation.locker_size && (
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Dolap Boyutu</span>
                <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>{reservation.locker_size}</p>
              </div>
            )}
            {reservation.luggage_description && (
              <div style={{ gridColumn: "1 / -1" }}>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Açıklama</span>
                <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>{reservation.luggage_description}</p>
              </div>
            )}
          </div>
        </section>

        {/* Price Information */}
        {(reservation.estimated_total_price || reservation.hourly_rate) && (
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
              {reservation.hourly_rate && (
                <div>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Saatlik Ücret</span>
                  <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>
                    {formatCurrency(reservation.hourly_rate)}
                  </p>
                </div>
              )}
              {reservation.estimated_total_price && (
                <div>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Toplam Tutar</span>
                  <p style={{ margin: "0.25rem 0 0", fontWeight: 600, fontSize: "1.125rem", color: "#16a34a" }}>
                    {formatCurrency(reservation.estimated_total_price)}
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
          {paymentQuery.isLoading ? (
            <div style={{ padding: "1rem", textAlign: "center", color: "#64748b" }}>
              Ödeme bilgileri yükleniyor...
            </div>
          ) : paymentQuery.data ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "0.75rem",
                background: paymentQuery.data.status === 'paid' || paymentQuery.data.status === 'captured' ? "#f0fdf4" : "#fefce8",
                padding: "1rem",
                borderRadius: "8px",
                border: `1px solid ${paymentQuery.data.status === 'paid' || paymentQuery.data.status === 'captured' ? "#bbf7d0" : "#fef08a"}`,
              }}
            >
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Ödeme Durumu</span>
                <p style={{ margin: "0.25rem 0 0" }}>
                  <Badge variant={
                    paymentQuery.data.status === 'paid' || paymentQuery.data.status === 'captured' ? 'success' :
                    paymentQuery.data.status === 'pending' ? 'warning' :
                    paymentQuery.data.status === 'failed' ? 'danger' : 'neutral'
                  }>
                    {paymentQuery.data.status === 'paid' ? 'Ödendi' :
                     paymentQuery.data.status === 'captured' ? 'Tahsil Edildi' :
                     paymentQuery.data.status === 'pending' ? 'Beklemede' :
                     paymentQuery.data.status === 'failed' ? 'Başarısız' :
                     paymentQuery.data.status}
                  </Badge>
                </p>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Ödeme Tutarı</span>
                <p style={{ margin: "0.25rem 0 0", fontWeight: 600, color: "#16a34a" }}>
                  {formatCurrency(paymentQuery.data.amount_minor)}
                </p>
              </div>
              {paymentQuery.data.mode && (
                <div>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Ödeme Yöntemi</span>
                  <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>
                    {paymentQuery.data.mode === 'CASH' ? 'Nakit' :
                     paymentQuery.data.mode === 'POS' ? 'POS / Kart' :
                     paymentQuery.data.mode === 'GATEWAY_LIVE' ? 'Online Ödeme' :
                     paymentQuery.data.mode}
                  </p>
                </div>
              )}
              {paymentQuery.data.paid_at && (
                <div>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Ödeme Tarihi</span>
                  <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>
                    {formatDate(paymentQuery.data.paid_at)}
                  </p>
                </div>
              )}
              {paymentQuery.data.transaction_id && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>İşlem ID</span>
                  <p style={{ margin: "0.25rem 0 0", fontWeight: 500, fontFamily: "monospace", fontSize: "0.75rem" }}>
                    {paymentQuery.data.transaction_id}
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
        {(reservation.qr_code || reservation.qr_token) && (
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
        {reservation.notes && (
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
              <p style={{ margin: 0, fontSize: "0.875rem" }}>{reservation.notes}</p>
            </div>
          </section>
        )}

        {/* Source */}
        {reservation.origin && (
          <div style={{ fontSize: "0.75rem", color: "#64748b", textAlign: "right" }}>
            Kaynak: {(() => {
              try {
                return new URL(reservation.origin).hostname;
              } catch {
                return reservation.origin;
              }
            })()}
          </div>
        )}
      </div>
    </Modal>
  );
}
