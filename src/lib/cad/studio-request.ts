export class StudioRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public recoverable: boolean,
  ) {
    super(message);
  }
}
/** Do not call Response.json() blindly: WebKit reports non-JSON bodies as a pattern error. */
export async function studioRequest(
  url: string,
  body: FormData | object,
  timeoutMs = 65000,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      ...(body instanceof FormData
        ? { body }
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
    const raw = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new StudioRequestError(
        response.status === 413
          ? "This file exceeds the hosted upload limit. Use a file smaller than 4 MB."
          : "The document service returned an unreadable response (HTTP " +
            response.status +
            "). Your source is kept; retry reading it.",
        response.status,
        response.status !== 413 &&
          response.status !== 429 &&
          response.status !== 401 &&
          response.status !== 403,
      );
    }
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new StudioRequestError(
        "The document service returned an unexpected response. Your source is kept; retry reading it.",
        response.status,
        ![401, 403, 413, 429].includes(response.status),
      );
    if (!response.ok) {
      const message =
        "error" in data && typeof data.error === "string"
          ? data.error
          : "The document service is unavailable. Retry reading the source.";
      throw new StudioRequestError(
        message,
        response.status,
        response.status >= 500,
      );
    }
    return data;
  } catch (error) {
    if (error instanceof StudioRequestError) throw error;
    throw new StudioRequestError(
      "The upload service could not be reached. Your source is kept; retry reading it.",
      0,
      true,
    );
  } finally {
    clearTimeout(timer);
  }
}
