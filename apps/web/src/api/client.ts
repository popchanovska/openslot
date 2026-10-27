const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}


interface Options {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
}

export async function api<T>(path: string, { method = 'GET', body }: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message[0] : data?.message;
    if (!msg && res.status >= 500) {
      // No JSON body: the request never reached the API (it isn't running, crashed on
      // startup, or is still waking up on free hosting).
      throw new ApiError(
        res.status,
        "Can't reach the API. If you're running it locally, check the [api] lines in the terminal for a startup error.",
      );
    }
    throw new ApiError(res.status, msg || `Something went wrong (${res.status}). Try again.`);
  }
  return data as T;
}

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Something went wrong. Try again.';
}
