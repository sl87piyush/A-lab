import { describe, it, expect } from "vitest";
import { describeOcrFailure } from "../services/api/src/ocr-error.js";

describe("safe OCR failure diagnostics", () => {
  it("preserves a provider rate code and retry advice without leaking SDK requests", () => {
    const secret = "private-key-not-for-output";
    const document = "private-document-bytes";
    const result = describeOcrFailure({
      statusCode: 429,
      body: JSON.stringify({
        message: "Rate limit exceeded",
        type: "rate_limited",
        code: "1300",
        debug: secret,
        document,
      }),
      message: secret,
      rawRequest: { headers: { authorization: secret }, body: document },
      headers: new Headers({
        "retry-after": "30",
        "x-request-id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      }),
    });
    expect(result.details).toEqual({
      httpStatus: 429,
      providerCode: "1300",
      reason: "rate-limit",
      retryAfterSeconds: 30,
      requestId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });
    expect(result.message).toContain("organization/workspace");
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain(document);
  });
  it("distinguishes account quota from a transient throughput limit", () => {
    const result = describeOcrFailure({
      statusCode: 429,
      body: JSON.stringify({
        error: {
          message: "Monthly workspace quota exhausted",
          code: "quota_exceeded",
        },
      }),
    });
    expect(result.details.reason).toBe("quota");
    expect(result.message).toContain("organization and workspace usage");
    expect(result.message).not.toContain("Retry later");
  });
  it("reports exhausted credits separately", () => {
    expect(describeOcrFailure({ statusCode: 402 }).details.reason).toBe(
      "credits",
    );
  });
  it("does not echo an HTML response, arbitrary code or unsafe headers", () => {
    const raw = "private-provider-value";
    const result = describeOcrFailure({
      statusCode: 429,
      body: JSON.stringify({ code: raw, message: `<html>${raw}</html>` }),
      headers: new Headers({ "retry-after": raw, "x-request-id": raw }),
    });
    expect(JSON.stringify(result)).not.toContain(raw);
    expect(result.details.providerCode).toBeUndefined();
    expect(result.details.retryAfterSeconds).toBeUndefined();
    expect(result.details.requestId).toBeUndefined();
  });
  it("keeps safe configuration errors and rejects arbitrary exception text", () => {
    const text =
      "Configured OCR model test-ocr is unavailable to this account.";
    expect(describeOcrFailure(new Error(text)).message).toBe(text);
    expect(
      describeOcrFailure(new Error("Bearer private-token")).message,
    ).not.toContain("private-token");
  });
});
