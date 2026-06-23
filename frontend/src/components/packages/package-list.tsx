"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Trash2, Plus, RefreshCw, Pencil } from "lucide-react";
import { getPackages, deletePackage, refreshPackage, PackageData } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { emitDataChange, useDataChangeListener } from "@/lib/data-events";
import { PackageDialog } from "./package-dialog";
import { PackageEditDialog } from "./package-edit-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PackageDetail } from "./package-detail";
import { getStatusConfig, StatusBadge } from "./package-status";

export function PackageList() {
  const { account, isAdmin } = useAuth();
  const [packages, setPackages] = useState<PackageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPkg, setEditPkg] = useState<PackageData | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const loadPackages = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPackages();
      setPackages(data);
    } catch (error) {
      console.error("加载快递失败:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  // 监听其他组件实例的数据变更
  useDataChangeListener("packages", loadPackages);

  const handleDelete = async (id: number) => {
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    const id = confirmDeleteId;
    if (id === null) return;
    setConfirmDeleteId(null);
    try {
      await deletePackage(id);
      setPackages((prev) => prev.filter((p) => p.id !== id));
      emitDataChange("packages");
    } catch (error) {
      console.error("删除失败:", error);
    }
  };

  const handleRefresh = async (id: number) => {
    try {
      setRefreshingId(id);
      const updated = await refreshPackage(id);
      setPackages((prev) => prev.map((p) => (p.id === id ? updated : p)));
      emitDataChange("packages");
    } catch (error) {
      console.error("刷新失败:", error);
    } finally {
      setRefreshingId(null);
    }
  };

  const handleCreated = (pkg: PackageData) => {
    setPackages((prev) => [pkg, ...prev]);
    emitDataChange("packages");
  };

  const handleDetailUpdate = (pkg: PackageData) => {
    setPackages((prev) => prev.map((p) => (p.id === pkg.id ? pkg : p)));
    emitDataChange("packages");
  };

  return (
    <>
      <Card className="card-hover overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2.5 text-[15px] md:text-base font-semibold text-render-optimized">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20">
              <Package className="h-4 w-4 text-primary" />
            </div>
            快递追踪
          </CardTitle>
          <Button
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="h-8 rounded-lg text-xs font-medium px-3 gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            添加
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg shimmer bg-muted/30" />
              ))}
            </div>
          ) : packages.length === 0 ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted mb-3">
                <Package className="h-7 w-7 text-muted-foreground/25" />
              </div>
              <p className="text-muted-foreground text-sm font-normal">
                暂无快递
              </p>
              <p className="text-muted-foreground/60 text-xs mt-1">
                输入单号即可追踪包裹
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {packages.map((pkg, i) => {
                const config = getStatusConfig(pkg.status);
                const StatusIcon = config.icon;
                return (
                  <div
                    key={pkg.id}
                    className="group relative p-3.5 rounded-lg border border-border/50 bg-background hover:bg-muted/40 transition-all duration-200 animate-fade-in-up cursor-pointer"
                    style={{ animationDelay: `${i * 60}ms` }}
                    onClick={() => pkg.id && setDetailId(pkg.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-[13px] truncate text-foreground text-render-optimized">
                          {pkg.item_name}
                        </h4>
                        <p className="text-[11px] text-muted-foreground mt-1 font-mono tabular-nums">
                          {pkg.tracking_number}
                        </p>
                      </div>
                      {(pkg.created_by === String(account?.id) || isAdmin) && (
                        <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200"
                              onClick={(e) => {
                                e.stopPropagation();
                                pkg.id && handleRefresh(pkg.id);
                              }}
                              disabled={refreshingId === pkg.id}
                            >
                              <RefreshCw className={`h-3.5 w-3.5 ${refreshingId === pkg.id ? "animate-spin" : ""}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 hover:bg-blue-50 hover:text-blue-500 dark:hover:bg-blue-950/40"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditPkg(pkg);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                pkg.id && handleDelete(pkg.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <StatusBadge status={pkg.status} />
                      <span
                        className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap border ${
                          pkg.scope === "personal"
                            ? "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-600"
                            : pkg.created_by === String(account?.id)
                            ? "bg-blue-100 text-blue-600 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700"
                            : "bg-teal-100 text-teal-600 border-teal-300 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-700"
                        }`}
                      >
                        {pkg.scope === "personal" ? "个人" : pkg.created_by === String(account?.id) ? "共享" : "组内共享"}
                      </span>
                      {pkg.carrier_name && (
                        <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-600">
                          {pkg.carrier_name}
                        </span>
                      )}
                    </div>
                    {(() => {
                      let latestContext = "";
                      try {
                        if (pkg.tracking_info) {
                          const list = JSON.parse(pkg.tracking_info);
                          if (Array.isArray(list) && list.length > 0) {
                            latestContext = list[0].context || "";
                          }
                        }
                      } catch {}
                      if (!latestContext && pkg.last_update) {
                        latestContext = pkg.last_update.replace(/^\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{1,2}(:\d{1,2})?\s*/, "");
                      }
                      return latestContext ? (
                        <p className="mt-2 pt-2 border-t border-border/30 text-[11px] text-muted-foreground truncate">
                          📍 {latestContext}
                        </p>
                      ) : null;
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <PackageDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleCreated}
      />
      <PackageEditDialog
        open={!!editPkg}
        pkg={editPkg}
        onClose={() => setEditPkg(null)}
        onUpdated={(pkg) => {
          setPackages((prev) => prev.map((p) => (p.id === pkg.id ? pkg : p)));
          emitDataChange("packages");
        }}
      />
      <PackageDetail
        packageId={detailId}
        onClose={() => setDetailId(null)}
        onUpdate={handleDetailUpdate}
      />

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleConfirmDelete}
        variant="danger"
        title="删除快递"
        message="确定删除这个快递吗？"
      />
    </>
  );
}
