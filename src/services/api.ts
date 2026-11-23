interface ApiResponse {
  ok: boolean;
  status: number;
  json: () => Promise<any>;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<ApiResponse> {
  if (!path.startsWith('/api/')) {
    throw new Error('API requests must use a relative /api/ URL.');
  }

  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, { ...options, headers });
  const body = await response.text();
  let data: any = null;

  if (body.trim()) {
    try {
      data = JSON.parse(body);
    } catch {
      if (response.ok) {
        throw new Error(`The server returned an invalid response (HTTP ${response.status}).`);
      }
      data = { message: body.trim() };
    }
  } else if (response.ok) {
    throw new Error(`The server returned an empty response (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const responseMessage = typeof data?.error === 'string'
      ? data.error
      : typeof data?.message === 'string' && !data.message.startsWith('<')
        ? data.message.slice(0, 300)
        : `The request failed (HTTP ${response.status}).`;
    throw new Error(responseMessage);
  }

  return {
    ok: response.ok,
    status: response.status,
    json: async () => data
  };
}
