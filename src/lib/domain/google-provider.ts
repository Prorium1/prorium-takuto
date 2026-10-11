type PublicAuthConfig = { url: string; key: string };
type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export async function googleProviderEnabled(
  config: PublicAuthConfig,
  fetcher: Fetcher = fetch,
): Promise<boolean> {
  try {
    const response = await fetcher(`${config.url}/auth/v1/settings`, {
      headers: { apikey: config.key },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const settings = await response.json();
    return settings?.external?.google === true;
  } catch {
    return false;
  }
}
