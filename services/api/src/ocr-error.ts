export type OcrFailureDetails = {
  httpStatus?: number;
  providerCode?: string;
  reason:
    | "authentication"
    | "credits"
    | "quota"
    | "rate-limit"
    | "capacity"
    | "other";
  retryAfterSeconds?: number;
  requestId?: string;
};

// Do not serialize the SDK error itself: it contains the authorized request and
// can contain document data. Return only allowlisted provider metadata.
export function describeOcrFailure(error: unknown): {
  message: string;
  details: OcrFailureDetails;
} {
  const e = (error && typeof error === "object" ? error : {}) as {
    statusCode?: unknown;
    body?: unknown;
    message?: unknown;
    headers?: Headers;
    rawResponse?: { headers?: Headers };
  };
  const httpStatus =
    typeof e.statusCode === "number" &&
    Number.isInteger(e.statusCode) &&
    e.statusCode >= 400 &&
    e.statusCode <= 599
      ? e.statusCode
      : undefined;
  let payload: Record<string, unknown> = {};
  if (typeof e.body === "string" && e.body.length <= 16384) {
    try {
      const parsed = JSON.parse(e.body);
      const candidate = parsed?.error ?? parsed;
      if (
        candidate &&
        typeof candidate === "object" &&
        !Array.isArray(candidate)
      )
        payload = candidate;
    } catch {
      /* Non-JSON upstream bodies are intentionally not returned. */
    }
  }
  const code = String(payload.code ?? "");
  const providerCode =
    /^\d{3,6}$/.test(code) ||
    [
      "rate_limit_exceeded",
      "quota_exceeded",
      "insufficient_quota",
      "insufficient_credits",
      "billing_hard_limit_reached",
      "capacity_exceeded",
    ].includes(code)
      ? code
      : undefined;
  const hint =
    `${typeof payload.message === "string" ? payload.message.slice(0, 2000) : ""} ${providerCode ?? ""}`.toLowerCase();
  const reason: OcrFailureDetails["reason"] =
    httpStatus === 401
      ? "authentication"
      : httpStatus === 402 || /credit|billing/.test(hint)
        ? "credits"
        : /quota|spend|monthly/.test(hint)
          ? "quota"
          : /capacity|overload/.test(hint)
            ? "capacity"
            : httpStatus === 429
              ? "rate-limit"
              : "other";
  const details: OcrFailureDetails = { httpStatus, providerCode, reason };
  const headers = e.rawResponse?.headers ?? e.headers;
  if (headers && typeof headers.get === "function") {
    const retry = headers.get("retry-after");
    if (retry && /^\d{1,7}$/.test(retry))
      details.retryAfterSeconds = Number(retry);
    const id = headers.get("x-request-id");
    if (id && /^[a-f0-9-]{16,64}$/i.test(id)) details.requestId = id;
  }
  const suffix = providerCode ? `; code ${providerCode}` : "";
  let message =
    "OCR processing failed or timed out. Check the source, model access and server credentials.";
  if (httpStatus === 401) message = "Mistral rejected the server API key.";
  else if (reason === "credits")
    message = `Mistral OCR is blocked by account billing/credits (HTTP ${httpStatus ?? 402}${suffix}). Check the account's included usage and credits.`;
  else if (reason === "quota")
    message = `Mistral OCR quota/spending limit reached (HTTP ${httpStatus ?? 429}${suffix}). Check organization and workspace usage limits.`;
  else if (httpStatus === 429)
    message = `Mistral rejected OCR (HTTP 429${suffix}). Check OCR limits, monthly allowance, and the API key's organization/workspace.${details.retryAfterSeconds !== undefined ? ` Provider retry-after: ${details.retryAfterSeconds} seconds.` : ""}`;
  else if (
    typeof e.message === "string" &&
    (/^Configured OCR model [\w.-]+ is unavailable to this account\.$/.test(
      e.message,
    ) ||
      e.message === "MISTRAL_API_KEY is not configured on the backend.")
  )
    message = e.message;
  return { message, details };
}
