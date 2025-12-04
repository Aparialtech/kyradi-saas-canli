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
  paid: <CheckCircle size={14} />,
  captured: <CheckCircle size={14} />,
  pending: <Clock size={14} />,
  authorized: <Shield size={14} />,
  cancelled: <CircleSlash size={14} />,
  failed: <XCircle size={14} />,
  refunded: <Wallet size={14} />,
  reserved: <PauseCircle size={14} />,
  active: <Package size={14} />,
  completed: <CheckCircle size={14} />,
  no_show: <Ban size={14} />,
  idle: <PauseCircle size={14} />,
  occupied: <UserCheck size={14} />,
  out_of_service: <UserX size={14} />,
};

const variantMap: Record<string, StatusVariant> = {
  paid: "success",
  captured: "success",
  authorized: "info",
  pending: "warning",
  reserved: "warning",
  active: "primary",
  completed: "success",
  cancelled: "muted",
  failed: "danger",
  refunded: "muted",
  no_show: "muted",
  idle: "muted",
  occupied: "primary",
  out_of_service: "danger",
};

export interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, className }) => {
  const normalized = status?.toLowerCase?.() ?? "default";
  const variant = variantMap[normalized] ?? "info";
  const icon = iconMap[normalized] ?? <AlertTriangle size={14} />;

  return (
    <span className={clsx(styles.badge, styles[`badge--${variant}`], className)}>
      <span className={styles.badge__icon}>{icon}</span>
      <span className={styles.badge__label}>{label ?? status}</span>
    </span>
  );
};
