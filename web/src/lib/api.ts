import type {
  SessionInfo,
  AgoraTokenResponse,
  AdminConfig,
} from '../types';

const TOKEN_KEY = 'xgoat_admin_token';

export function getAdminToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

/** 将后端错误映射为面向用户的友好文案 */
function mapFriendlyMessage(statusCode: number, serverMsg: string): string {
  const msg = (serverMsg || '').toLowerCase();
  if (statusCode === 401) {
    if (msg.includes('ended') || msg.includes('失效') || msg.includes('结束')) {
      return '共享已结束，链接已失效';
    }
    return '链接无效或无权限访问';
  }
  if (statusCode === 403) return '无权限访问';
  if (statusCode === 404) return '资源不存在或链接已失效';
  if (statusCode === 429) return '操作过于频繁，请稍后再试';
  if (statusCode >= 500) return '服务器暂时不可用，请稍后重试';
  return serverMsg || '请求失败，请稍后重试';
}

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const token = getAdminToken();
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    let serverMsg = '';
    let statusCode = res.status;
    try {
      const data = await res.json();
      serverMsg = data?.message || data?.error || '';
      if (typeof data?.statusCode === 'number') statusCode = data.statusCode;
    } catch {
      try {
        serverMsg = await res.text();
      } catch {
        serverMsg = res.statusText;
      }
    }
    throw new ApiError(statusCode, mapFriendlyMessage(statusCode, serverMsg));
  }
  return res.json() as Promise<T>;
}

export const api = {
  getShareInfo(token: string): Promise<SessionInfo> {
    return request('/api/share/info?t=' + encodeURIComponent(token));
  },
  getShareToken(
    token: string,
    role: 'publisher' | 'subscriber',
  ): Promise<AgoraTokenResponse> {
    return request(
      '/api/share/token?t=' + encodeURIComponent(token) + '&role=' + role,
    );
  },
  adminLogin(
    password: string,
  ): Promise<{
    ok: boolean;
    token?: string;
    message?: string;
    locked?: boolean;
    retryAfter?: number;
    remaining?: number;
  }> {
    return request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },
  getAdminConfig(): Promise<AdminConfig> {
    return request('/api/admin/config');
  },
  updateAdminConfig(config: Partial<AdminConfig>): Promise<{ ok: boolean }> {
    return request('/api/admin/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },
  updatePassword(oldPassword: string, newPassword: string) {
    return request('/api/admin/password', {
      method: 'PUT',
      body: JSON.stringify({ oldPassword, newPassword }),
    });
  },
  listSessions(): Promise<SessionInfo[]> {
    return request('/api/admin/sessions');
  },
  createManualShare(data: {
    sharerUserId: string;
    sharerUsername: string;
    guildId?: string;
    targetChannelId?: string;
  }): Promise<SessionInfo> {
    return request('/api/admin/sessions/manual', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  endSession(id: string): Promise<{ ok: boolean }> {
    return request('/api/admin/sessions/' + id, { method: 'DELETE' });
  },
  deleteSessionRecord(id: string): Promise<{ ok: boolean }> {
    return request('/api/admin/sessions/' + id + '/record', { method: 'DELETE' });
  },
};
