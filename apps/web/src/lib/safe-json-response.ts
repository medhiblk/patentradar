/** Keep server HTML/proxy errors out of browser JSON.parse errors, especially on WebKit. */
export async function safeJsonResponse(response: Response) {
  let data: Awaited<ReturnType<Response["json"]>>;
  try { data = JSON.parse(await response.text()); }
  catch { throw new Error(`Unreadable service response (HTTP ${response.status}). Your input has been retained; retry.`); }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Unexpected service response. Retry without closing your project.");
  if (!response.ok) {
    const message = typeof data.error === "string" ? data.error : typeof data.error?.message === "string" ? data.error.message : `Service unavailable (HTTP ${response.status}).`;
    throw new Error(message);
  }
  return data;
}
