export const API_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000/api' : '/api');

export interface SupportMessage {
  id: number;
  conversationId: number;
  senderType: 'user' | 'support' | 'system';
  senderName: string;
  text: string;
  mediaType?: string | null;
  mediaUrl?: string | null;
  createdAt: string;
}

export interface SupportConversation {
  id: number;
  publicId: string;
  displayName: string;
  status: string;
}

export interface SupportSessionResponse {
  success: boolean;
  conversation: SupportConversation;
  messages: SupportMessage[];
  cooldownMs: number;
  retryAfterMs: number;
  message?: string;
}

export interface UserProfileResponse {
  id: number;
  account_id?: string | null;
  accountId?: string | null;
  username: string;
  email?: string | null;
  role: string;
  display_name?: string | null;
  displayName?: string | null;
  avatar?: string | null;
  banned_until?: string | null;
  bannedUntil?: string | null;
  ban_reason?: string | null;
  banReason?: string | null;
  banMessage?: string | null;
  isBanned?: boolean;
}

export interface BannedUserEventDetail {
  isBanned: true;
  message?: string | null;
  bannedUntil?: string | null;
  banReason?: string | null;
}

export const USER_BANNED_EVENT = 'neuralv:user-banned';

function emitBannedUserEvent(detail: BannedUserEventDetail) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<BannedUserEventDetail>(USER_BANNED_EVENT, {
      detail,
    }),
  );
}

function maybeEmitBannedUserEvent(status: number, payload: any) {
  if (status !== 423 && !payload?.isBanned) {
    return;
  }

  emitBannedUserEvent({
    isBanned: true,
    message: payload?.message || payload?.banMessage || '',
    bannedUntil: payload?.bannedUntil || payload?.banned_until || null,
    banReason: payload?.banReason || payload?.ban_reason || null,
  });
}

export interface AdminUserSearchResponse {
  success: boolean;
  user?: {
    id: number;
    accountId: string;
    username: string;
    email: string;
    role: string;
    displayName?: string | null;
    avatar?: string | null;
    bannedUntil?: string | null;
    banReason?: string | null;
    isBanned: boolean;
  };
  stats?: {
    totalOrders: number;
    pendingOrders: number;
    approvedOrders: number;
    rejectedOrders: number;
    supportConversations: number;
    lastOrderAt?: string | null;
    lastSupportActivityAt?: string | null;
  };
  recentOrders?: Array<{
    id: number;
    link?: string | null;
    fileUrl?: string | null;
    status: string;
    createdAt: string;
    licenseKey?: string | null;
  }>;
  message?: string;
}

export const API = {
  getUsers: async () => {
    try {
      const response = await fetch(`${API_URL}/users`);
      return await response.json();
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  requestRegistrationCode: async (username: string, email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/register/request-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      return await response.json();
    } catch (error) {
      console.error(error);
      return { success: false, message: 'Ошибка соединения с сервером' };
    }
  },

  verifyRegistrationCode: async (email: string, code: string) => {
    try {
      const response = await fetch(`${API_URL}/register/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      return await response.json();
    } catch (error) {
      console.error(error);
      return { success: false, message: 'Ошибка соединения с сервером' };
    }
  },

  loginUser: async (loginInput: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: loginInput, password }),
      });
      return await response.json();
    } catch (error) {
      console.error(error);
      return { success: false, message: 'Ошибка соединения с сервером' };
    }
  },

  logout: (navigate: (path: string) => void) => {
    localStorage.removeItem('neuralv_id');
    localStorage.removeItem('neuralv_username');
    localStorage.removeItem('neuralv_role');
    navigate('/login');
    window.location.reload();
  },

  getOrders: async (userId?: string | null) => {
    try {
      const url = userId ? `${API_URL}/orders?user_id=${userId}` : `${API_URL}/orders`;
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  submitOrder: async (userId: string, link: string, file: File | null) => {
    const formData = new FormData();
    formData.append('user_id', userId);
    if (link) formData.append('link', link);
    if (file) formData.append('file', file);

    try {
      const response = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        body: formData,
      });
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const data = await response.json();
        maybeEmitBannedUserEvent(response.status, data);
        return data;
      }

      if (response.status === 413) {
        return {
          success: false,
          message: 'Файл слишком большой. Загрузите файл меньше 64 МБ.',
        };
      }

      const text = await response.text();
      return {
        success: false,
        message: text.trim() || `Ошибка сервера при отправке заявки (${response.status}).`,
      };
    } catch (error) {
      console.error('Submit Error:', error);
      return { success: false, message: 'Ошибка соединения с сервером' };
    }
  },

  updateStatus: async (id: string, status: string) => {
    let licenseKey = null;
    if (status === 'active') {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let key = 'NV-';
      for (let i = 0; i < 4; i += 1) {
        for (let j = 0; j < 4; j += 1) {
          key += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (i < 3) key += '-';
      }
      licenseKey = key;
    }

    try {
      const response = await fetch(`${API_URL}/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, licenseKey }),
      });
      return await response.json();
    } catch (error) {
      console.error(error);
      return { success: false };
    }
  },

  deleteOrder: async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/orders/${id}`, { method: 'DELETE' });
      return await response.json();
    } catch (error: any) {
      console.error(error);
      return { success: false, message: error.message };
    }
  },

  getUserProfile: async (userId: string): Promise<UserProfileResponse | null> => {
    try {
      const response = await fetch(`${API_URL}/user/${userId}`);
      const data = await response.json();
      maybeEmitBannedUserEvent(response.status, data);
      return data;
    } catch (error) {
      console.error(error);
      return null;
    }
  },

  updateProfile: async (
    userId: string,
    displayName: string,
    avatar: string | null,
    password?: string,
    oldPassword?: string,
  ) => {
    try {
      const bodyData: Record<string, string | null> = {
        id: userId,
        display_name: displayName,
        avatar,
      };

      if (password && oldPassword) {
        bodyData.password = password;
        bodyData.oldPassword = oldPassword;
      }

      const response = await fetch(`${API_URL}/user/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });
      const data = await response.json();
      maybeEmitBannedUserEvent(response.status, data);
      return data;
    } catch (error: any) {
      console.error(error);
      return { success: false, message: error.message };
    }
  },

  searchAdminUserByAccountId: async (accountId: string): Promise<AdminUserSearchResponse> => {
    try {
      const response = await fetch(
        `${API_URL}/admin/users/search?accountId=${encodeURIComponent(accountId)}`,
      );
      return await response.json();
    } catch (error: any) {
      console.error(error);
      return { success: false, message: error.message };
    }
  },

  banUserByAccountId: async (accountId: string, durationHours: number, reason: string) => {
    try {
      const response = await fetch(`${API_URL}/admin/users/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, durationHours, reason }),
      });
      return await response.json();
    } catch (error: any) {
      console.error(error);
      return { success: false, message: error.message };
    }
  },

  unbanUserByAccountId: async (accountId: string) => {
    try {
      const response = await fetch(`${API_URL}/admin/users/unban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      return await response.json();
    } catch (error: any) {
      console.error(error);
      return { success: false, message: error.message };
    }
  },

  scanVirusTotal: async (orderId: string) => {
    try {
      const response = await fetch(`${API_URL}/virustotal/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      return await response.json();
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  },

  getVirusTotalReport: async (analysisId: string) => {
    try {
      const response = await fetch(`${API_URL}/virustotal/report/${analysisId}`);
      return await response.json();
    } catch (error: any) {
      return { error: true, message: error.message };
    }
  },

  initSupportSession: async (
    clientId: string,
    userId?: string | null,
    displayName?: string | null,
  ): Promise<SupportSessionResponse> => {
    const response = await fetch(`${API_URL}/support/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, userId, displayName }),
    });
    const data = await response.json();
    maybeEmitBannedUserEvent(response.status, data);
    return data;
  },

  sendSupportMessage: async (payload: {
    conversationId: number;
    clientId: string;
    userId?: string | null;
    displayName?: string | null;
    text: string;
  }) => {
    const response = await fetch(`${API_URL}/support/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    maybeEmitBannedUserEvent(response.status, data);
    return {
      status: response.status,
      ...data,
    };
  },

  getSupportMessages: async (
    conversationId: number,
    clientId: string,
    userId: string,
    afterId = 0,
  ) => {
    const response = await fetch(
      `${API_URL}/support/conversations/${conversationId}/messages?clientId=${encodeURIComponent(clientId)}&userId=${encodeURIComponent(userId)}&afterId=${afterId}`,
    );
    return await response.json();
  },

  buildSupportStreamUrl: (conversationId: number, clientId: string, userId: string) =>
    `${API_URL}/support/conversations/${conversationId}/stream?clientId=${encodeURIComponent(clientId)}&userId=${encodeURIComponent(userId)}`,
};
