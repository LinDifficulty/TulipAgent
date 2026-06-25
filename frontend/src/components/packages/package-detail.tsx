"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X, RefreshCw, Package } from "lucide-react";
import { getPackageDetail, refreshPackage, PackageDetailData, PackageData } from "@/lib/api";
import { getStatusConfig, StatusBadge } from "./package-status";

interface PackageDetailProps {
  packageId: number | null;
  onClose: () => void;
  onUpdate: (pkg: PackageData) => void;
}

export function PackageDetail({ packageId, onClose, onUpdate }: PackageDetailProps) {
  const [detail, setDetail] = useState<PackageDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!packageId) return;
    try {
      setLoading(true);
      const data = await getPackageDetail(packageId);
      setDetail(data);
    } catch (error) {
      console.error("加载快递详情失败:", error);
    } finally {
      setLoading(false);
    }
  }, [packageId]);

  // 打开详情时从数据库拉取最新数据（纯 DB 读，不调快递100 API）
  useEffect(() => {
    if (packageId) {
      loadDetail();
    } else {
      setDetail(null);
    }
  }, [packageId, loadDetail]);

  const handleRefresh = async () => {
    if (!packageId) return;
    try {
      setRefreshing(true);
      const updated = await refreshPackage(packageId);
      onUpdate(updated);
      await loadDetail();
    } catch (error) {
      console.error("刷新失败:", error);
    } finally {
      setRefreshing(false);
    }
  };

  if (!packageId) return null;

  const statusConfig = getStatusConfig(detail?.status);
  const StatusIcon = statusConfig.icon;

  const dialog = (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative z-10 bg-background border border-border rounded-xl shadow-lg w-[90vw] max-w-lg mx-4 max-h-[80vh] flex flex-col animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${statusConfig.bg}`}>
              <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
            </div>
            <h2 className="text-base font-semibold text-foreground">物流详情</h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 scroll-container">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-lg shimmer bg-muted/30" />
              ))}
            </div>
          ) : detail ? (
            <div className="space-y-5">
              {/* 快递信息卡片 */}
              <div className="p-4 rounded-xl border border-border/50 bg-muted/30">
                <h3 className="font-semibold text-[15px] text-foreground">{detail.item_name}</h3>
                <div className="mt-2 space-y-1.5">
                  <p className="text-xs text-muted-foreground">
                    单号：<span className="font-mono text-foreground/80">{detail.tracking_number}</span>
                  </p>
                  {detail.carrier_name && (
                    <p className="text-xs text-muted-foreground">
                      快递公司：<span className="text-foreground/80">{detail.carrier_name}</span>
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <StatusBadge status={detail.status} className="text-xs px-2.5 py-1" />
                  </div>
                </div>
                {detail.last_update && (
                  <p className="mt-3 text-xs text-muted-foreground border-t border-border/50 pt-3">
                    {detail.last_update}
                  </p>
                )}
              </div>

              {/* 物流轨迹 */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3">物流轨迹</h4>
                {detail.tracking_list && detail.tracking_list.length > 0 ? (
                  <div className="relative pl-5">
                    {/* Timeline line */}
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                    <div className="space-y-4">
                      {detail.tracking_list.map((trace, i) => (
                        <div key={i} className="relative animate-fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
                          {/* Dot */}
                          <div className={`absolute -left-5 top-1.5 w-[15px] h-[15px] rounded-full border-2 ${
                            i === 0
                              ? "bg-primary border-primary"
                              : "bg-background border-border"
                          }`} />
                          <div className="ml-2">
                            <p className={`text-[13px] leading-relaxed ${i === 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                              {trace.context}
                            </p>
                            <p className="text-[11px] text-muted-foreground/70 mt-0.5 tabular-nums">
                              {trace.time}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Package className="h-8 w-8 text-muted-foreground/25 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">暂无物流信息</p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border shrink-0">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "刷新中..." : "刷新状态"}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
