import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { zipSync, strToU8 } from "fflate";
import {
  parseOCR,
  startAttempt,
  transition,
  demoQuestions,
} from "../packages/shared/src/index.js";
const aiMode = vi.hoisted(() => ({ available: false, ids: [] as string[] }));
vi.mock("../services/api/src/ocr.js", async (importOriginal) => {
  const real = await importOriginal<any>();
  return {
    ...real,
    runOCR: async (id: string) => ({
      raw: {
        pages: [
          { index: 0, markdown: "1. Synthetic OCR question\n(A) a\n(B) b" },
        ],
      },
      parsed: parseOCR(id, [
        { index: 0, markdown: "1. Synthetic OCR question\n(A) a\n(B) b" },
      ]),
    }),
    boundarySuggestions: async () => [],
    verifyModels: async () => {
      if (!aiMode.available) throw Error("No test credentials");
      return { ocr: "mock", text: "mock", textAvailable: true };
    },
    aiClient: () => ({
      chat: {
        complete: async () => ({
          choices: [
            {
              message: { content: JSON.stringify({ insightIds: aiMode.ids }) },
            },
          ],
        }),
      },
    }),
  };
});
import { createApp } from "../services/api/src/app.js";
let app: Awaited<ReturnType<typeof createApp>>,
  dir: string,
  token: string,
  otherToken: string;
const setup = "test-private-setup";
const auth = () => ({ authorization: `Bearer ${token}` });
const upload = (bytes: Uint8Array, mime: string, name = "source") => {
  const boundary = "attemply-test-boundary";
  return {
    headers: {
      ...auth(),
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${mime}\r\n\r\n`,
      ),
      Buffer.from(bytes),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  };
};
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "attemply-tests-"));
  process.env.ATTEMPLY_SETUP_CODE = setup;
  app = await createApp({ dataDir: dir, test: true });
  await app.ready();
  const pair = async (deviceId: string) =>
    (
      await app.inject({
        method: "POST",
        url: "/v1/auth/pair",
        payload: { code: setup, deviceId },
      })
    ).json().token;
  token = await pair("11111111-1111-4111-8111-111111111111");
  otherToken = await pair("22222222-2222-4222-8222-222222222222");
});
afterAll(async () => {
  await app.close();
  await rm(dir, { recursive: true, force: true });
});
describe("private API integration (OCR provider mocked)", () => {
  it("serves health without leaking secrets", async () => {
    const res = await app.inject("/health");
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain(setup);
  });
  it("requires authentication for every import route", async () => {
    expect(
      (await app.inject({ method: "POST", url: "/v1/imports", payload: {} }))
        .statusCode,
    ).toBe(401);
    expect((await app.inject("/v1/imports/123/status")).statusCode).toBe(401);
  });
  it("rejects an incorrect setup code", async () => {
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/auth/pair",
          payload: {
            code: "wrong",
            deviceId: "11111111-1111-4111-8111-111111111111",
          },
        })
      ).statusCode,
    ).toBe(401);
  });
  it("rejects an expired session", async () => {
    const expired = app.jwt.sign(
      { sub: "11111111-1111-4111-8111-111111111111" },
      { expiresIn: -1 },
    );
    expect(
      (
        await app.inject({
          url: "/v1/capabilities",
          headers: { authorization: `Bearer ${expired}` },
        })
      ).statusCode,
    ).toBe(401);
  });
  it("rejects fake MIME signatures", async () => {
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/documents",
          ...upload(Buffer.from("not a PDF"), "application/pdf"),
        })
      ).statusCode,
    ).toBe(415);
  });
  it("rejects corrupt PDFs with an actionable error", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/v1/documents",
      ...upload(Buffer.from("%PDF-broken"), "application/pdf"),
    });
    expect(r.statusCode).toBe(400);
    expect(r.body).toContain("corrupt");
  });
  it("validates page selections before starting a job", async () => {
    const image = await sharp({
      create: { width: 50, height: 50, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    const d = (
      await app.inject({
        method: "POST",
        url: "/v1/documents",
        ...upload(image, "image/png"),
      })
    ).json();
    const r = await app.inject({
      method: "POST",
      url: "/v1/imports",
      headers: auth(),
      payload: { documentId: d.id, pages: [4] },
    });
    expect(r.statusCode).toBe(400);
  });
  it("creates a real image preview and isolates document ownership", async () => {
    const image = await sharp({
      create: { width: 50, height: 50, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    const res = await app.inject({
      method: "POST",
      url: "/v1/documents",
      ...upload(image, "image/png"),
    });
    expect(res.statusCode).toBe(200);
    const d = res.json();
    const thumb = await app.inject({
      url: `/v1/documents/${d.id}/pages/0`,
      headers: auth(),
    });
    expect(thumb.headers["content-type"]).toContain("image/jpeg");
    expect(thumb.rawPayload[0]).toBe(255);
    expect(
      (
        await app.inject({
          url: `/v1/documents/${d.id}/pages/0`,
          headers: { authorization: `Bearer ${otherToken}` },
        })
      ).statusCode,
    ).toBe(404);
  });
  it("prepares a multi-page synthetic PDF using Poppler", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([200, 200]);
    pdf.addPage([200, 200]);
    const res = await app.inject({
      method: "POST",
      url: "/v1/documents",
      ...upload(await pdf.save(), "application/pdf"),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().pageCount).toBe(2);
    expect(
      (
        await app.inject({
          url: `/v1/documents/${res.json().id}/pages/1`,
          headers: auth(),
        })
      ).statusCode,
    ).toBe(200);
  });
  it("runs upload → asynchronous OCR job → parsed question result", async () => {
    const image = await sharp({
      create: { width: 50, height: 50, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    const d = (
      await app.inject({
        method: "POST",
        url: "/v1/documents",
        ...upload(image, "image/png"),
      })
    ).json();
    const job = await app.inject({
      method: "POST",
      url: "/v1/imports",
      headers: auth(),
      payload: { documentId: d.id, pages: [0] },
    });
    expect(job.statusCode).toBe(202);
    let state = "";
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 20));
      state = (
        await app.inject({
          url: `/v1/imports/${job.json().id}/status`,
          headers: auth(),
        })
      ).json().state;
      if (state === "complete") break;
    }
    expect(state).toBe("complete");
    const result = (
      await app.inject({
        url: `/v1/imports/${job.json().id}/result`,
        headers: auth(),
      })
    ).json();
    expect(result.result.questions).toHaveLength(1);
    expect(result.result.questions[0].key).toBeUndefined();
    expect(result.raw.pages).toHaveLength(1);
  });
  it("keeps analysis useful when the model is unavailable", async () => {
    const a = transition(
      startAttempt(
        "a",
        demoQuestions,
        { title: "t", minutes: 1, correct: 4, incorrect: -1, mode: "timed" },
        Date.now() - 1000,
      ),
      { type: "submit" },
    );
    const res = await app.inject({
      method: "POST",
      url: "/v1/analysis",
      headers: auth(),
      payload: a,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().kind).toBe("deterministic");
    expect(res.json().insights).toEqual([]);
  });
  it("rejects invalid analysis input", async () => {
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/analysis",
          headers: auth(),
          payload: { score: 999 },
        })
      ).statusCode,
    ).toBe(400);
  });
  it("imports OCR export ZIPs with page-local images", async () => {
    const bytes = zipSync({
      "document/pages/page-1/markdown.md": strToU8(
        "1. See ![img-0.jpeg](img-0.jpeg)\n(A) a\n(B) b",
      ),
      "document/pages/page-1/img-0.jpeg": new Uint8Array([255, 216, 255]),
    });
    const res = await app.inject({
      method: "POST",
      url: "/v1/debug/import",
      ...upload(bytes, "application/zip", "ocr.zip"),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().result.questions[0].images[0].id).toContain(
      "/page-0/img-0.jpeg",
    );
  });
  it("does not accept arbitrary paths as document IDs", async () => {
    expect(
      (
        await app.inject({
          url: "/v1/documents/not-a-uuid/pages/0",
          headers: auth(),
        })
      ).statusCode,
    ).toBe(400);
  });
  it("limits AI output to evidence-derived candidate facts", async () => {
    aiMode.available = true;
    aiMode.ids = ["demo-1"];
    try {
      const a = transition(
        transition(
          startAttempt("ai", demoQuestions, {
            title: "AI",
            minutes: 1,
            correct: 4,
            incorrect: -1,
            mode: "timed",
          }),
          { type: "answer", values: ["B"] },
        ),
        { type: "submit" },
      );
      const response = await app.inject({
        method: "POST",
        url: "/v1/analysis",
        headers: auth(),
        payload: a,
      });
      expect(response.json().kind).toBe("ai");
      expect(response.json().insights[0].text).toContain("Question 1: correct");
      expect(response.json().insights[0].questionIds).toEqual(["demo-1"]);
    } finally {
      aiMode.available = false;
    }
  });
  it("drops invented AI evidence IDs", async () => {
    aiMode.available = true;
    aiMode.ids = ["invented-question"];
    try {
      const a = transition(
        startAttempt("ai", demoQuestions, {
          title: "AI",
          minutes: 1,
          correct: 4,
          incorrect: -1,
          mode: "timed",
        }),
        { type: "submit" },
      );
      const response = await app.inject({
        method: "POST",
        url: "/v1/analysis",
        headers: auth(),
        payload: a,
      });
      expect(response.json().insights).toEqual([]);
    } finally {
      aiMode.available = false;
    }
  });
  it("bounds concurrent source preparation as well as OCR jobs", async () => {
    const image = await sharp({
      create: { width: 50, height: 50, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    const results = await Promise.all([
      app.inject({
        method: "POST",
        url: "/v1/documents",
        ...upload(image, "image/png"),
      }),
      app.inject({
        method: "POST",
        url: "/v1/documents",
        ...upload(image, "image/png"),
      }),
    ]);
    expect(results.map((result) => result.statusCode).sort()).toEqual([
      200, 429,
    ]);
  });
});
