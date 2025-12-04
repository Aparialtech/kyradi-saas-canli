import { useMemo } from "react";
import { Modal } from "../common/Modal";
import { useTranslation } from "../../hooks/useTranslation";
import type { Reservation } from "../../services/partner/reservations";

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
  const { t } = useTranslation();

  const formatDate = useMemo(() => {
    return (dateStr?: string | null) => {
      if (!dateStr) return "—";
      try {
        return new Date(dateStr).toLocaleString("tr-TR", {
          dateStyle: "medium",
          timeStyle: "short",
        });
      } catch {
        return dateStr;
      }
    };
  }, []);

  const formatCurrency = useMemo(() => {
    return (minor?: number | null) => {
      if (minor == null) return "—";
      return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        minimumFractionDigits: 2,
      }).format(minor / 100);
    };
  }, []);

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
          <h5 style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 600, color: "#475569" }}>
            👤 Misafir Bilgileri
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
          <h5 style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 600, color: "#475569" }}>
            📅 Rezervasyon Bilgileri
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
                {formatDate(reservation.start_datetime ?? reservation.checkin_date)}
              </p>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Çıkış Tarihi</span>
              <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>
                {formatDate(reservation.end_datetime ?? reservation.checkout_date)}
              </p>
            </div>
            {reservation.duration_hours && (
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Süre</span>
                <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>{reservation.duration_hours} saat</p>
              </div>
            )}
            <div>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Depo</span>
              <p style={{ margin: "0.25rem 0 0", fontWeight: 500 }}>{reservation.storage_id ?? "Atanmadı"}</p>
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
            <h5 style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 600, color: "#475569" }}>
              💰 Ücret Bilgileri
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
            Kaynak: {new URL(reservation.origin).hostname}
          </div>
        )}
      </div>
    </Modal>
  );
}

