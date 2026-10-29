import { TextDecoder, TextEncoder } from "node:util";
import * as SecureStore from "expo-secure-store";
import { fetch } from "expo/fetch";
import { fileFormData, request, upload } from "../src/api";
import type { Source } from "../src/storage";

jest.mock("../src/storage", () => ({
  fileRoot: "file://documents",
  uid: () => "device-id",
}));
jest.mock("expo-file-system", () => ({
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get name() {
      return decodeURIComponent(this.uri.split("/").pop()!);
    }
    get type() {
      const ext = this.uri.split(".").pop()!;
      return (
        {
          pdf: "application/pdf",
          png: "image/png",
          jpg: "image/jpeg",
          zip: "application/zip",
          json: "application/json",
        } as Record<string, string>
      )[ext];
    }
    async bytes() {
      return new Uint8Array([37, 80, 68, 70, 45, 0, 255, 13, 10]);
    }
  },
}));

// Exercise Expo's real multipart encoder, including its rejection of URI-only parts.
const { convertFormDataAsync } = jest.requireActual(
  "expo/src/winter/fetch/convertFormData",
);
const { installFormDataPatch } = jest.requireActual("expo/src/winter/FormData");
const rnFormDataModule = jest.requireActual(
  "react-native/Libraries/Network/FormData",
);
const ExpoFormData = installFormDataPatch(
  rnFormDataModule.default ?? rnFormDataModule,
);
const OriginalFormData = globalThis.FormData;
const encoded: { bytes: Uint8Array; headers: Record<string, string> }[] = [];

beforeAll(() => {
  Object.assign(globalThis, {
    TextEncoder,
    TextDecoder,
    FormData: ExpoFormData,
  });
});
afterAll(() => {
  globalThis.FormData = OriginalFormData;
});
beforeEach(() => {
  jest.clearAllMocks();
  encoded.length = 0;
  (SecureStore.getItemAsync as jest.Mock).mockImplementation(
    async (name: string) =>
      name === "apiBase" ? "https://example.test" : "test-session",
  );
  (fetch as jest.Mock).mockImplementation(
    async (_url: string, options: RequestInit) => {
      const result = await convertFormDataAsync(options.body, "test-boundary");
      encoded.push({
        bytes: result.body,
        headers: options.headers as Record<string, string>,
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "prepared-source", pageCount: 3 }),
      };
    },
  );
});

it("reproduces the reported SDK rejection for the old URI-only upload", async () => {
  const oldBody = new FormData();
  oldBody.append("file", {
    uri: "file://paper.pdf",
    name: "paper.pdf",
    type: "application/pdf",
  } as any);
  await expect(convertFormDataAsync(oldBody)).rejects.toThrow(
    "Unsupported FormDataPart implementation",
  );
});

it.each([
  ["pdf", "application/pdf", "/v1/documents"],
  ["png", "image/png", "/v1/documents"],
  ["jpg", "image/jpeg", "/v1/documents"],
  ["zip", "application/zip", "/v1/debug/import"],
  ["json", "application/json", "/v1/debug/import"],
])(
  "serializes actual file bytes for %s without a URI-only part",
  async (extension, mime, endpoint) => {
    const source: Source = {
      id: "local",
      uri: `file://documents/retained%20paper.${extension}`,
      originalUri: "file://original",
      name: `original.${extension}`,
      mime,
      selected: [],
    };
    const result =
      endpoint === "/v1/documents"
        ? await upload(source)
        : await request(endpoint, {
            method: "POST",
            body: fileFormData(source),
          });
    expect(result.pageCount).toBe(3);
    expect(fetch).toHaveBeenCalledWith(
      `https://example.test${endpoint}`,
      expect.any(Object),
    );
    const text = new TextDecoder().decode(encoded[0].bytes);
    expect(text).toContain(`content-type: ${mime}`);
    expect(text).toContain(`filename="retained%20paper.${extension}"`);
    expect(text).toContain('name="file"');
    const rawBytes = Array.from(encoded[0].bytes);
    const marker = [37, 80, 68, 70, 45, 0, 255, 13, 10];
    expect(
      rawBytes.some((_, i) =>
        marker.every((value, j) => rawBytes[i + j] === value),
      ),
    ).toBe(true);
    expect(text).not.toContain("file://");
    expect(encoded[0].headers.Authorization).toBe("Bearer test-session");
    expect(encoded[0].headers["Content-Type"]).toBeUndefined();
  },
);
