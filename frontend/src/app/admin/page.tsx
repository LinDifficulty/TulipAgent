"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import {
  adminListAccounts,
  adminUpdateAccount,
  adminDeleteAccount,
  adminListGroups,
  adminDeleteGroup,
  adminListGroupMembers,
  type AdminAccount,
  type AdminGroup,
  type GroupMember,
} from "@/lib/api";
import { AccountDialog } from "@/components/admin/account-dialog";
import { GroupDialog } from "@/components/admin/group-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ArrowLeft,
  Shield,
  Users,
  UserPlus,
  Pencil,
  Trash2,
  Copy,
  Check,
  Loader2,
} from "lucide-react";

type Tab = "accounts" | "groups";

export default function AdminPage() {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("accounts");

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [isLoading, isAuthenticated, isAdmin, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) return null;

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* 顶栏 */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-all rounded-lg px-2.5 py-1.5 -ml-2 hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="font-medium">返回</span>
          </button>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold text-foreground">管理后台</span>
          </div>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
          <button
            onClick={() => setTab("accounts")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              tab === "accounts"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            账号管理
          </button>
          <button
            onClick={() => setTab("groups")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              tab === "groups"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            用户组
          </button>
        </div>
      </div>

      {/* 内容 */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        {tab === "accounts" ? <AccountsTab /> : <GroupsTab />}
      </div>
    </div>
  );
}

// ──────────────────────── 账号管理 ────────────────────────

function AccountsTab() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AdminAccount | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [confirmDeleteAccountId, setConfirmDeleteAccountId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [accs, grps] = await Promise.all([
        adminListAccounts(),
        adminListGroups(),
      ]);
      setAccounts(accs);
      setGroups(grps);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (id: number) => {
    setConfirmDeleteAccountId(id);
  };

  const handleConfirmDeleteAccount = async () => {
    const id = confirmDeleteAccountId;
    if (id === null) return;
    setConfirmDeleteAccountId(null);
    try {
      await adminDeleteAccount(id);
      loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "删除失败");
    }
  };

  const toggleActive = async (acc: AdminAccount) => {
    try {
      await adminUpdateAccount(acc.id, { is_active: !acc.is_active });
      loadData();
    } catch {
      // ignore
    }
  };

  const copyToken = (id: number, token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 新增按钮 */}
      <button
        onClick={() => {
          setEditingAccount(null);
          setDialogOpen(true);
        }}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-all"
      >
        <UserPlus className="h-4 w-4" />
        新增账号
      </button>

      {/* 账号对话框 */}
      <AccountDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={loadData}
        editAccount={editingAccount}
        groups={groups}
      />

      {/* 账号列表 */}
      <div className="space-y-2">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className={`bg-card border border-border rounded-xl p-4 transition-all ${
              !acc.is_active ? "opacity-50" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-sm font-semibold text-foreground">
                  {acc.nickname}
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      acc.role === "admin"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {acc.role === "admin" ? "管理员" : "用户"}
                  </span>
                  {!acc.is_active && (
                    <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
                      已禁用
                    </span>
                  )}
                  {acc.group_id && (
                    <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                      {groups.find((g) => g.id === acc.group_id)?.name || `组 #${acc.group_id}`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                    {acc.token}
                  </code>
                  <button
                    onClick={() => copyToken(acc.id, acc.token)}
                    className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                    title="复制令牌"
                  >
                    {copiedId === acc.id ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
                {acc.phone && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs text-muted-foreground">📱 {acc.phone}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {acc.role !== "admin" && (
                  <button
                    onClick={() => toggleActive(acc)}
                    className={`px-2 py-1 text-[11px] font-medium rounded-md transition-all ${
                      acc.is_active
                        ? "bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        : "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                    }`}
                  >
                    {acc.is_active ? "禁用" : "启用"}
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditingAccount(acc);
                    setDialogOpen(true);
                  }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                  title="编辑"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(acc.id)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                  title="删除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {accounts.length === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">
            暂无账号
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDeleteAccountId !== null}
        onClose={() => setConfirmDeleteAccountId(null)}
        onConfirm={handleConfirmDeleteAccount}
        variant="danger"
        title="删除账号"
        message="确定删除此账号？"
      />
    </div>
  );
}

// ──────────────────────── 用户组管理 ────────────────────────

function GroupsTab() {
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AdminGroup | null>(null);
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<number | null>(null);

  // 成员查看状态
  const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null);
  const [groupMembers, setGroupMembers] = useState<Record<number, GroupMember[]>>({});

  const loadData = useCallback(async () => {
    try {
      const [grps, accs] = await Promise.all([
        adminListGroups(),
        adminListAccounts(),
      ]);
      setGroups(grps);
      setAccounts(accs);

      // 预加载所有组的成员数量
      const membersMap: Record<number, GroupMember[]> = {};
      await Promise.all(
        grps.map(async (g) => {
          try {
            const members = await adminListGroupMembers(g.id);
            membersMap[g.id] = members;
          } catch {
            // ignore
          }
        })
      );
      setGroupMembers(membersMap);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 加载指定组的成员
  const loadMembers = async (groupId: number) => {
    try {
      const members = await adminListGroupMembers(groupId);
      setGroupMembers((prev) => ({ ...prev, [groupId]: members }));
    } catch {
      // ignore
    }
  };

  // 展开/收起组成员
  const toggleExpand = async (groupId: number) => {
    if (expandedGroupId === groupId) {
      setExpandedGroupId(null);
    } else {
      setExpandedGroupId(groupId);
      if (!groupMembers[groupId]) {
        await loadMembers(groupId);
      }
    }
  };

  const handleDelete = async (id: number) => {
    setConfirmDeleteGroupId(id);
  };

  const handleConfirmDeleteGroup = async () => {
    const id = confirmDeleteGroupId;
    if (id === null) return;
    setConfirmDeleteGroupId(null);
    try {
      await adminDeleteGroup(id);
      if (expandedGroupId === id) setExpandedGroupId(null);
      loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "删除失败");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 新增按钮 */}
      <button
        onClick={() => {
          setEditingGroup(null);
          setDialogOpen(true);
        }}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-all"
      >
        <Users className="h-4 w-4" />
        新增用户组
      </button>

      {/* 用户组对话框 */}
      <GroupDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={loadData}
        editGroup={editingGroup}
      />

      {/* 组列表 */}
      <div className="space-y-2">
        {/* 独立用户（无分组） */}
        {(() => {
          const independentUsers = accounts.filter((a) => a.group_id === null);
          if (independentUsers.length === 0) return null;
          return (
            <div className="bg-card border border-border rounded-xl overflow-hidden border-dashed">
              <div className="p-4">
                <div
                  className="min-w-0 flex-1 cursor-pointer"
                  onClick={() => setExpandedGroupId(expandedGroupId === -1 ? null : -1)}
                >
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-muted-foreground">独立用户</p>
                    <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                      {independentUsers.length} 人
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    未加入任何分组的用户
                  </p>
                </div>
              </div>
              {expandedGroupId === -1 && (
                <div className="border-t border-border p-4 animate-fade-in">
                  <div className="space-y-1.5">
                    {independentUsers.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg"
                      >
                        <span className="text-sm font-medium text-foreground truncate">
                          {m.nickname}
                        </span>
                        <span
                          className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            m.role === "admin"
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {m.role === "admin" ? "管理员" : "用户"}
                        </span>
                        {!m.is_active && (
                          <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
                            已禁用
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-3 text-center">
                    如需调整成员，请在「账号管理」中修改用户的所属分组
                  </p>
                </div>
              )}
            </div>
          );
        })()}

        {/* 正式分组 */}
        {groups.map((g) => (
          <div
            key={g.id}
            className="bg-card border border-border rounded-xl overflow-hidden"
          >
            {/* 组头部 */}
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div
                  className="min-w-0 flex-1 cursor-pointer"
                  onClick={() => toggleExpand(g.id)}
                >
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{g.name}</p>
                    <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                      {groupMembers[g.id]?.length ?? "?"} 人
                    </span>
                  </div>
                  {g.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {g.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      setEditingGroup(g);
                      setDialogOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                    title="编辑"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(g.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    title="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* 展开的成员列表 */}
            {expandedGroupId === g.id && (
              <div className="border-t border-border p-4 animate-fade-in">
                <div className="space-y-1.5">
                  {(groupMembers[g.id] || []).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      暂无成员
                    </p>
                  )}
                  {(groupMembers[g.id] || []).map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg"
                    >
                      <span className="text-sm font-medium text-foreground truncate">
                        {m.nickname}
                      </span>
                      <span
                        className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          m.role === "admin"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {m.role === "admin" ? "管理员" : "用户"}
                      </span>
                      {!m.is_active && (
                        <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
                          已禁用
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-3 text-center">
                  如需调整成员，请在「账号管理」中修改用户的所属分组
                </p>
              </div>
            )}
          </div>
        ))}
        {groups.length === 0 && accounts.filter((a) => a.group_id === null).length === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">
            暂无用户组
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDeleteGroupId !== null}
        onClose={() => setConfirmDeleteGroupId(null)}
        onConfirm={handleConfirmDeleteGroup}
        variant="danger"
        title="删除用户组"
        message="确定删除此用户组？组内成员将变为独立用户。"
      />
    </div>
  );
}
