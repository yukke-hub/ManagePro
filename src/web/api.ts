/** ログイン期限切れ・通信失敗(Access のログイン画面へのリダイレクトは fetch では TypeError になる) */
export class SessionError extends Error {}
export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        'X-Requested-With': 'managepro', // 書き込み系 API に必須(CSRF 対策)
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });
  } catch {
    throw new SessionError('network');
  }
  // redirect: 'manual' のとき、Access の再ログインへのリダイレクトは opaqueredirect になる
  if (res.type === 'opaqueredirect' || res.status === 401) throw new SessionError('unauthorized');
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, j.error ?? 'error');
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b: unknown = {}) => request<T>('POST', p, b),
  patch: <T>(p: string, b: unknown) => request<T>('PATCH', p, b),
  del: <T>(p: string) => request<T>('DELETE', p),
};
