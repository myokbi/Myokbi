const PRIVATE_TOKEN_KEY = 'okb_private_token';
const ADMIN_TOKEN_KEY = 'okb_admin_token';
const USER_TOKEN_KEY = 'okb_user_token';

export function getStoredTokens() {
  return {
    privateToken: sessionStorage.getItem(PRIVATE_TOKEN_KEY) || localStorage.getItem(PRIVATE_TOKEN_KEY) || '',
    adminToken: sessionStorage.getItem(ADMIN_TOKEN_KEY) || localStorage.getItem(ADMIN_TOKEN_KEY) || '',
    userToken: sessionStorage.getItem(USER_TOKEN_KEY) || localStorage.getItem(USER_TOKEN_KEY) || '',
  };
}

export function setPrivateToken(token: string) {
  if (token) {
    localStorage.setItem(PRIVATE_TOKEN_KEY, token);
    sessionStorage.setItem(PRIVATE_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(PRIVATE_TOKEN_KEY);
    sessionStorage.removeItem(PRIVATE_TOKEN_KEY);
  }
}

export function setAdminToken(token: string) {
  if (token) {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  }
}

export function setUserToken(token: string) {
  if (token) {
    localStorage.setItem(USER_TOKEN_KEY, token);
    sessionStorage.setItem(USER_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(USER_TOKEN_KEY);
    sessionStorage.removeItem(USER_TOKEN_KEY);
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { privateToken, adminToken, userToken } = getStoredTokens();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (privateToken) headers['x-private-token'] = privateToken;
  if (adminToken) headers['x-admin-token'] = adminToken;
  if (userToken) headers['x-user-token'] = userToken;

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });

  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }

  if (!res.ok) {
    const msg = (data as { error?: string })?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data as T;
}

export function createRealtimeStream(onSync: (eventType: string, payload: unknown) => void): () => void {
  const { privateToken, adminToken, userToken } = getStoredTokens();
  const params = new URLSearchParams();
  if (privateToken) params.set('pt', privateToken);
  if (adminToken) params.set('at', adminToken);
  if (userToken) params.set('ut', userToken);

  const source = new EventSource(`/api/stream?${params.toString()}`);

  const events = [
    'connected',
    'state:updated',
    'config:updated',
    'chat:updated',
    'admin:updated',
    'github:status',
    'broadcast:message',
  ];
  for (const evt of events) {
    source.addEventListener(evt, (e) => {
      try {
        const parsed = JSON.parse((e as MessageEvent).data);
        onSync(evt, parsed);
      } catch {
        onSync(evt, {});
      }
    });
  }

  return () => {
    source.close();
  };
}
