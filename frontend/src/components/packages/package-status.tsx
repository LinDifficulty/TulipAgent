"use client";

import { Package, Truck, MapPin, CheckCircle2, AlertCircle, type LucideIcon } from "lucide-react";

export interface StatusConfig {
  icon: LucideIcon;
  color: string;
  bg: string;
  label: string;
  badgeClass: string;
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  未发货: {
    icon: Package,
    color: "text-gray-500",
    bg: "bg-gray-100 dark:bg-gray-800",
    label: "未发货",
    badgeClass: "bg-gray-50 text-gray-500 border border-gray-200/60 dark:bg-gray-800/40 dark:text-gray-400 dark:border-gray-700/30",
  },
  运输中: {
    icon: Truck,
    color: "text-indigo-500",
    bg: "bg-indigo-100 dark:bg-indigo-900/40",
    label: "运输中",
    badgeClass: "bg-indigo-50 text-indigo-600 border border-indigo-200/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/30",
  },
  派送中: {
    icon: MapPin,
    color: "text-violet-500",
    bg: "bg-violet-100 dark:bg-violet-900/40",
    label: "派件中",
    badgeClass: "bg-violet-50 text-violet-600 border border-violet-200/60 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800/30",
  },
  已签收: {
    icon: CheckCircle2,
    color: "text-purple-500",
    bg: "bg-purple-100 dark:bg-purple-900/40",
    label: "已签收",
    badgeClass: "bg-purple-50 text-purple-600 border border-purple-200/60 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/30",
  },
  查询失败: {
    icon: AlertCircle,
    color: "text-red-500",
    bg: "bg-red-100 dark:bg-red-900/40",
    label: "失败",
    badgeClass: "bg-red-50 text-red-500 border border-red-200/60 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/30",
  },
};

export function getStatusConfig(status?: string): StatusConfig {
  return STATUS_CONFIG[status || "未发货"] || STATUS_CONFIG["未发货"];
}

interface StatusBadgeProps {
  status?: string;
  showLabel?: boolean;
  className?: string;
}

export function StatusBadge({ status, showLabel = true, className = "" }: StatusBadgeProps) {
  const config = getStatusConfig(status);
  const StatusIcon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${config.badgeClass} ${className}`}>
      <StatusIcon className="h-3 w-3" />
      {showLabel && config.label}
    </span>
  );
}
