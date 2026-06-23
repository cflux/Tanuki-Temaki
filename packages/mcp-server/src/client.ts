const BACKEND_URL = process.env.TANUKI_BACKEND_URL ?? 'http://localhost:3000';
const API_KEY = process.env.TANUKI_API_KEY;

if (!API_KEY) {
  process.stderr.write('Error: TANUKI_API_KEY environment variable is required\n');
  process.exit(1);
}

export async function agentGet<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`/api/agent${path}`, BACKEND_URL);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    let message: string;
    try {
      message = (JSON.parse(body) as { error: string }).error;
    } catch {
      message = body;
    }
    throw new Error(`Agent API error ${response.status}: ${message}`);
  }

  return response.json() as Promise<T>;
}
