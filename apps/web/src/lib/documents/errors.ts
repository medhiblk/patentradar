export class DocumentError extends Error {
  constructor(public code: string, public status: number, message: string) {
    super(message);
    this.name = "DocumentError";
  }
}

/** Never return provider bodies, document contents or raw PDF parser errors. */
export function documentErrorResponse(error: unknown) {
  let problem: DocumentError;
  const message = error instanceof Error ? error.message : "";
  const upstreamStatus = error && typeof error === "object" && "status" in error ? error.status : undefined;
  if (error instanceof DocumentError) problem = error;
  else if (/Sign in/.test(message))
    problem = new DocumentError("SIGN_IN_REQUIRED", 401, "Sign in to use external AI document interpretation. Your source has been kept.");
  else if (upstreamStatus === 429 || /Rate limit|Daily AI call allowance/.test(message))
    problem = new DocumentError("RATE_LIMITED", 429, "The request or AI allowance limit has been reached. Retry later; your source has been kept.");
  else if (/Cross-origin/.test(message))
    problem = new DocumentError("FORBIDDEN", 403, "This document request is not permitted from this origin.");
  else if (/exceeds 6 MB/.test(message))
    problem = new DocumentError("DOCUMENT_TOO_LARGE", 413, "Choose a document smaller than 4 MB.");
  else
    problem = new DocumentError("DOCUMENT_UNAVAILABLE", 503, "Document interpretation is temporarily unavailable. Your source has been kept; retry or use local extraction without AI.");
  return Response.json({ error: problem.message, code: problem.code }, {
    status: problem.status,
    headers: { "Cache-Control": "no-store", ...(problem.status === 429 ? { "Retry-After": "60" } : {}) },
  });
}
