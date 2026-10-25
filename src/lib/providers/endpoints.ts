// Environment aliases are configuration, not independent data sources.
export function endpoint(names: string[], fallback: string, suffix = "") {
  const value = names.map(n => process.env[n]?.trim()).find(Boolean) || fallback;
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Invalid provider endpoint configuration');
  if (!suffix) return url.toString();
  const path = url.pathname.replace(/\/+$/, '');
  url.pathname = path.endsWith(suffix) ? path : path + suffix;
  return url.toString().replace(/\/$/, '');
}
