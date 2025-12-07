import React from "react";
import clsx from "clsx";
import {
  CheckCircle2 as CheckCircle,
  Clock,
  Ban,
  AlertTriangle,
  XOctagon as XCircle,
  PauseCircle,
  CircleSlash,
  Shield,
  UserCheck,
  UserX,
  Package,
  Wallet,
} from "../../../lib/lucide";
import styles from "./StatusBadge.module.css";

type StatusVariant =
  | "success"
  | "warning"
  | "danger"
  | "muted"
  | "info"
  | "primary";

const iconMap: Record<string, React.ReactNode> = {
  paid: <CheckCircle className="h-3.5 w-3.5" />,
  captured: <CheckCircle className="h-3.5 w-3.5" />,
  pending: <Clock className="h-3.5 w-3.5" />,
  authorized: <Shield className="h-3.5 w-3.5" />,
  cancelled: <CircleSlash className="h-3.5 w-3.5" />,
  failed: <XCircle className="h-3.5 w-3.5" />,
  refunded: <Wallet className="h-3.5 w-3.5" />,
  reserved: <PauseCircle className="h-3.5 w-3.5" />,
  active: <Package className="h-3.5 w-3.5" />,
  completed: <CheckCircle className="h-3.5 w-3.5" />,
  no_show: <Ban className="h-3.5 w-3.5" />,
  idle: <PauseCircle className="h-3.5 w-3.5" />,
  occupied: <UserCheck className="h-3.5 w-3.5" />,
  out_of_service: <UserX className="h-3.5 w-3.5" />,
  inactive: <PauseCircle className="h-3.5 w-3.5" />,
};

const variantMap: Record<string, StatusVariant> = {
  paid: "success",
  captured: "success",
  authorized: "info",
  pending: "warning",
  reserved: "warning", // Kahverengi - Rezervasyon
  active: "primary",
  completed: "success",
  cancelled: "muted",
  failed: "danger",
  refunded: "muted",
  no_show: "muted",
  idle: "success", // Yeşil - Boş
  occupied: "danger", // Kırmızı - Dolu
  out_of_service: "danger",
  inactive: "muted",
};

export interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, className }) => {
  const normalized = status?.toLowerCase?.() ?? "default";
  const variant = variantMap[normalized] ?? "info";
  const icon = iconMap[normalized] ?? <AlertTriangle className="h-3.5 w-3.5" />;

  return (
    <span className={clsx(styles.badge, styles[`badge--${variant}`], className)}>
      <span className={styles.badge__icon}>{icon}</span>
      <span className={styles.badge__label}>{label ?? status}</span>
    </span>
  );
};
