import type { ReactNode } from "react";
import { Drawer } from "../common/Drawer";
import type { Reservation } from "../../services/partner/reservations";
import { ReservationDetailContent } from "./ReservationDetailModal";

interface ReservationDetailDrawerProps {
  reservation: Reservation | null;
  isOpen: boolean;
  onClose: () => void;
  footer?: ReactNode;
}

export function ReservationDetailDrawer({
  reservation,
  isOpen,
  onClose,
  footer,
}: ReservationDetailDrawerProps) {
  if (!reservation || !isOpen) return null;

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Rezervasyon Detayları" footer={footer}>
      <ReservationDetailContent reservation={reservation} isOpen={isOpen} />
    </Drawer>
  );
}
