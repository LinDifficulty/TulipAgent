const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// 获取存储的 token
function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("tulip_token");
}

// 构建带认证的 headers
function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extra,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// 统一的 fetch 封装，自动处理 401
async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(url, options);
  if (res.status === 401) {
    // token 失效，清除并跳转登录
    if (typeof window !== "undefined") {
      localStorage.removeItem("tulip_token");
      window.location.href = "/login";
    }
    throw new Error("认证已过期，请重新登录");
  }
  return res;
}

export interface ChatRequest {
  message: string;
  session_id?: string;
}

export interface ChatResponse {
  response: string;
  session_id: string;
  tool_calls: Array<{ name: string; args: Record<string, unknown> }>;
}

export interface EventData {
  id?: number;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  all_day?: boolean;
  remind_before?: number;
  repeat_rule?: string;
  created_by?: string;
}

export interface TodoData {
  id?: number;
  title: string;
  description?: string;
  due_date?: string;
  priority?: "low" | "medium" | "high";
  scope?: string;
  completed?: boolean;
  completed_at?: string;
  deleted?: boolean;
  created_by?: string;
}

// 聊天 API
export async function sendMessage(request: ChatRequest): Promise<ChatResponse> {
  const response = await authFetch(`${API_BASE}/api/chat/send`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(request),
  });
  return response.json();
}

export async function getWelcomeMessage(): Promise<string> {
  const response = await authFetch(`${API_BASE}/api/chat/welcome`, {
    headers: authHeaders(),
  });
  const data = await response.json();
  return data.message;
}

export interface ConversationSummary {
  session_id: string;
  started_at: string;
  last_active: string;
  message_count: number;
  preview: string;
}

export interface ConversationMessage {
  id: number;
  message: string;
  response: string;
  tool_calls: Array<{ name: string; args: Record<string, unknown> }> | null;
  created_at: string;
}

export interface ConversationData {
  session_id: string;
  messages: ConversationMessage[];
}

export async function getConversations(): Promise<ConversationSummary[]> {
  const response = await authFetch(`${API_BASE}/api/chat/conversations`, {
    headers: authHeaders(),
  });
  const data = await response.json();
  return data.conversations;
}

export async function getConversation(sessionId: string): Promise<ConversationData> {
  const response = await authFetch(`${API_BASE}/api/chat/conversations/${sessionId}`, {
    headers: authHeaders(),
  });
  return response.json();
}

// 日程 API
export async function createEvent(event: EventData): Promise<EventData> {
  const response = await authFetch(`${API_BASE}/api/events/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(event),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "创建日程失败");
  }
  return response.json();
}

export async function getEvents(params?: {
  start_date?: string;
  end_date?: string;
}): Promise<EventData[]> {
  const searchParams = new URLSearchParams();
  if (params?.start_date) searchParams.set("start_date", params.start_date);
  if (params?.end_date) searchParams.set("end_date", params.end_date);

  const response = await authFetch(`${API_BASE}/api/events/?${searchParams}`, {
    headers: authHeaders(),
  });
  return response.json();
}

export async function deleteEvent(id: number): Promise<void> {
  await authFetch(`${API_BASE}/api/events/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

export async function updateEvent(
  id: number,
  event: Partial<EventData>
): Promise<EventData> {
  const response = await authFetch(`${API_BASE}/api/events/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(event),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "更新日程失败");
  }
  return response.json();
}

// 待办 API
export async function createTodo(todo: TodoData): Promise<TodoData> {
  const response = await authFetch(`${API_BASE}/api/todos/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(todo),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "创建待办失败");
  }
  return response.json();
}

export async function updateTodo(
  id: number,
  todo: Partial<TodoData>
): Promise<TodoData> {
  const response = await authFetch(`${API_BASE}/api/todos/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(todo),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "更新待办失败");
  }
  return response.json();
}

export async function getTodos(params?: {
  completed?: boolean;
}): Promise<TodoData[]> {
  const searchParams = new URLSearchParams();
  if (params?.completed !== undefined)
    searchParams.set("completed", String(params.completed));

  const response = await authFetch(`${API_BASE}/api/todos/?${searchParams}`, {
    headers: authHeaders(),
  });
  return response.json();
}

export async function completeTodo(id: number): Promise<TodoData> {
  const response = await authFetch(`${API_BASE}/api/todos/${id}/complete`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "完成待办失败");
  }
  return response.json();
}

export async function restoreTodo(id: number): Promise<TodoData> {
  const response = await authFetch(`${API_BASE}/api/todos/${id}/restore`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "恢复待办失败");
  }
  return response.json();
}

export async function deleteTodo(id: number): Promise<void> {
  await authFetch(`${API_BASE}/api/todos/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

// 快递 API
export interface PackageData {
  id?: number;
  tracking_number: string;
  item_name: string;
  phone_last4?: string | null;
  carrier_code?: string;
  carrier_name?: string;
  status?: string;
  last_update?: string;
  tracking_info?: string;
  scope?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}


export interface AnniversaryData {
  id?: number;
  title: string;
  description?: string;
  date: string;
  repeat_rule?: string;
  scope?: string;
  created_by?: string;
}
export interface PackageDetailData extends PackageData {
  tracking_list?: Array<{ time: string; context: string }>;
}

export async function createPackage(pkg: {
  tracking_number: string;
  item_name: string;
  scope?: string;
  phone_last4?: string;
}): Promise<PackageData> {
  const response = await authFetch(`${API_BASE}/api/packages/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(pkg),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || "添加快递失败");
  }
  return response.json();
}

export async function getPackages(params?: {
  status?: string;
}): Promise<PackageData[]> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);

  const response = await authFetch(`${API_BASE}/api/packages/?${searchParams}`, {
    headers: authHeaders(),
  });
  return response.json();
}

export async function getPackageDetail(id: number): Promise<PackageDetailData> {
  const response = await authFetch(`${API_BASE}/api/packages/${id}`, {
    headers: authHeaders(),
  });
  return response.json();
}

export async function updatePackage(
  id: number,
  data: { tracking_number?: string; item_name?: string; scope?: string; phone_last4?: string }
): Promise<PackageData> {
  const response = await authFetch(`${API_BASE}/api/packages/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || "修改快递失败");
  }
  return response.json();
}

export async function refreshPackage(id: number): Promise<PackageData> {
  const response = await authFetch(`${API_BASE}/api/packages/${id}/refresh`, {
    method: "POST",
    headers: authHeaders(),
  });
  return response.json();
}

export async function deletePackage(id: number): Promise<void> {
  await authFetch(`${API_BASE}/api/packages/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}


// 纪念日 API
export async function createAnniversary(data: AnniversaryData): Promise<AnniversaryData> {
  const response = await authFetch(`${API_BASE}/api/anniversaries/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "创建纪念日失败");
  }
  return response.json();
}

export async function getAnniversaries(): Promise<AnniversaryData[]> {
  const response = await authFetch(`${API_BASE}/api/anniversaries/`, {
    headers: authHeaders(),
  });
  return response.json();
}

export async function updateAnniversary(id: number, data: Partial<AnniversaryData>): Promise<AnniversaryData> {
  const response = await authFetch(`${API_BASE}/api/anniversaries/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || "修改纪念日失败");
  }
  return response.json();
}

export async function deleteAnniversary(id: number): Promise<void> {
  await authFetch(`${API_BASE}/api/anniversaries/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

// 工作日志 API
export interface ContentItem {
  index: number;
  content: string;
  added_at: string;
}

export interface WorkLogData {
  id: number;
  contents: ContentItem[];
  summary?: string;
  log_date: string;
  tags?: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

export interface WeeklySummary {
  week_start: string;
  week_end: string;
  logs: WorkLogData[];
  total_count: number;
}

export interface MonthlySummary {
  year: number;
  month: number;
  month_start: string;
  month_end: string;
  logs: WorkLogData[];
  total_count: number;
}

export async function addWorkLogContent(data: {
  content: string;
  log_date?: string;
}): Promise<WorkLogData> {
  const response = await authFetch(`${API_BASE}/api/work-logs/add`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "添加工作内容失败");
  }
  return response.json();
}

export async function getWorkLogs(params?: {
  start_date?: string;
  end_date?: string;
  limit?: number;
}): Promise<WorkLogData[]> {
  const searchParams = new URLSearchParams();
  if (params?.start_date) searchParams.set("start_date", params.start_date);
  if (params?.end_date) searchParams.set("end_date", params.end_date);
  if (params?.limit) searchParams.set("limit", String(params.limit));

  const response = await authFetch(`${API_BASE}/api/work-logs/?${searchParams}`, {
    headers: authHeaders(),
  });
  return response.json();
}

export async function getWeeklySummary(weekOffset?: number): Promise<WeeklySummary> {
  const searchParams = new URLSearchParams();
  if (weekOffset !== undefined) searchParams.set("week_offset", String(weekOffset));

  const response = await authFetch(`${API_BASE}/api/work-logs/summary/weekly?${searchParams}`, {
    headers: authHeaders(),
  });
  return response.json();
}

export async function getMonthlySummary(year?: number, month?: number): Promise<MonthlySummary> {
  const searchParams = new URLSearchParams();
  if (year) searchParams.set("year", String(year));
  if (month) searchParams.set("month", String(month));

  const response = await authFetch(`${API_BASE}/api/work-logs/summary/monthly?${searchParams}`, {
    headers: authHeaders(),
  });
  return response.json();
}

export async function updateWorkLogContent(
  logId: number,
  contentIndex: number,
  newContent: string
): Promise<WorkLogData> {
  const response = await authFetch(
    `${API_BASE}/api/work-logs/${logId}/content/${contentIndex}`,
    {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ content_index: contentIndex, new_content: newContent }),
    }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "更新工作内容失败");
  }
  return response.json();
}

export async function deleteWorkLogContent(
  logId: number,
  contentIndex: number
): Promise<WorkLogData> {
  const response = await authFetch(
    `${API_BASE}/api/work-logs/${logId}/content/${contentIndex}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "删除工作内容失败");
  }
  return response.json();
}

export async function updateWorkLog(
  id: number,
  data: { summary?: string; tags?: string }
): Promise<WorkLogData> {
  const response = await authFetch(`${API_BASE}/api/work-logs/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "更新工作日志失败");
  }
  return response.json();
}

export async function deleteWorkLog(id: number): Promise<void> {
  await authFetch(`${API_BASE}/api/work-logs/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}
// 个人资料 API
export async function updateMyProfile(data: {
  nickname?: string;
  phone?: string | null;
  token?: string;
}): Promise<{ id: number; token: string; nickname: string; phone: string | null; role: string; group_id: number | null }> {
  const response = await authFetch(`${API_BASE}/api/auth/me`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "更新个人资料失败");
  }
  return response.json();
}

// 管理后台 API
export interface AdminAccount {
  id: number;
  token: string;
  nickname: string;
  phone: string | null;
  role: string;
  group_id: number | null;
  is_active: boolean;
  created_at: string;
}

export interface AdminGroup {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export async function adminListAccounts(): Promise<AdminAccount[]> {
  const res = await authFetch(`${API_BASE}/api/admin/accounts`, {
    headers: authHeaders(),
  });
  return res.json();
}

export async function adminCreateAccount(data: {
  token: string;
  nickname: string;
  phone?: string | null;
  role?: string;
  group_id?: number | null;
}): Promise<AdminAccount> {
  const res = await authFetch(`${API_BASE}/api/admin/accounts`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "创建账号失败");
  }
  return res.json();
}

export async function adminUpdateAccount(
  id: number,
  data: {
    token?: string;
    nickname?: string;
    phone?: string | null;
    role?: string;
    group_id?: number | null;
    is_active?: boolean;
  }
): Promise<AdminAccount> {
  const res = await authFetch(`${API_BASE}/api/admin/accounts/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "更新账号失败");
  }
  return res.json();
}

export async function adminDeleteAccount(id: number): Promise<void> {
  const res = await authFetch(`${API_BASE}/api/admin/accounts/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "删除账号失败");
  }
}

export async function adminListGroups(): Promise<AdminGroup[]> {
  const res = await authFetch(`${API_BASE}/api/admin/groups`, {
    headers: authHeaders(),
  });
  return res.json();
}

export async function adminCreateGroup(data: {
  name: string;
  description?: string;
}): Promise<AdminGroup> {
  const res = await authFetch(`${API_BASE}/api/admin/groups`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "创建用户组失败");
  }
  return res.json();
}

export async function adminUpdateGroup(
  id: number,
  data: { name?: string; description?: string }
): Promise<AdminGroup> {
  const res = await authFetch(`${API_BASE}/api/admin/groups/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "更新用户组失败");
  }
  return res.json();
}

export async function adminDeleteGroup(id: number): Promise<void> {
  const res = await authFetch(`${API_BASE}/api/admin/groups/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "删除用户组失败");
  }
}

// 用户组成员管理
export interface GroupMember {
  id: number;
  token: string;
  nickname: string;
  role: string;
  is_active: boolean;
}

export async function adminListGroupMembers(groupId: number): Promise<GroupMember[]> {
  const res = await authFetch(`${API_BASE}/api/admin/groups/${groupId}/members`, {
    headers: authHeaders(),
  });
  return res.json();
}

export async function adminAddGroupMember(
  groupId: number,
  accountId: number
): Promise<GroupMember> {
  const res = await authFetch(`${API_BASE}/api/admin/groups/${groupId}/members`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ account_id: accountId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "添加成员失败");
  }
  return res.json();
}

export async function adminRemoveGroupMember(
  groupId: number,
  accountId: number
): Promise<void> {
  const res = await authFetch(
    `${API_BASE}/api/admin/groups/${groupId}/members/${accountId}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "移除成员失败");
  }
}
