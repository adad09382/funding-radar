type NextInit = RequestInit & {
  next?: { revalidate?: number | false; tags?: string[] };
};

export function fetchWithTimeout(
  url: string,
  init: NextInit = {},
  ms = 7000
): Promise<Response> {
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), ms);
  return fetch(url, { ...init, signal: ac.signal }).finally(() => clearTimeout(id));
}
