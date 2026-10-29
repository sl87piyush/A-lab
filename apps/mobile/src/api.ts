import * as SecureStore from "expo-secure-store";
import { File } from "expo-file-system";
import { fetch } from "expo/fetch";
import { fileRoot, uid, type Source } from "./storage";
async function timedFetch(url: string, options: RequestInit, ms: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
export async function connection() {
  const base =
    (await SecureStore.getItemAsync("apiBase")) ??
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    "";
  const token = await SecureStore.getItemAsync("session");
  return { base, token };
}
export function validBase(base: string) {
  const url = new URL(base);
  if (url.protocol !== "https:" && !(__DEV__ && url.protocol === "http:"))
    throw Error(
      "Use an HTTPS backend URL. Local HTTP is allowed only in development.",
    );
  return base.replace(/\/$/, "");
}
export async function pair(base: string, code: string) {
  base = validBase(base.trim());
  let deviceId = await SecureStore.getItemAsync("deviceId");
  if (!deviceId) {
    deviceId = uid();
    await SecureStore.setItemAsync("deviceId", deviceId);
  }
  const res = await timedFetch(
    base + "/v1/auth/pair",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, deviceId }),
    },
    20000,
  );
  const data = await res.json();
  if (!res.ok) throw Error(data.error?.message ?? "Connection failed.");
  await SecureStore.setItemAsync("apiBase", base);
  await SecureStore.setItemAsync("session", data.token);
}
export async function request(path: string, options: RequestInit = {}) {
  const { base, token } = await connection();
  if (!base || !token)
    throw Error(
      "Connect your private backend in Settings to use live OCR. The demo works offline.",
    );
  const res = await timedFetch(
    validBase(base) + path,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...options.headers,
      },
    },
    90000,
  );
  const data = await res.json();
  if (!res.ok)
    throw Error(
      res.status === 401
        ? "Session expired. Pair again in Settings."
        : (data.error?.message ?? "The backend request failed. Retry."),
    );
  return data;
}
export function fileFormData(source: Pick<Source, "uri">) {
  const body = new FormData();
  // Expo fetch reads File bytes; React Native's old { uri, name, type } part
  // is rejected by the SDK 58 multipart encoder before the request is sent.
  body.append("file", new File(source.uri));
  return body;
}
export async function upload(source: Source) {
  return request("/v1/documents", {
    method: "POST",
    body: fileFormData(source),
  });
}
export async function downloadThumbnail(documentId: string, page: number) {
  const { base, token } = await connection();
  const target = new File(fileRoot, `${documentId}-page-${page}.jpg`);
  if (target.exists) return target.uri;
  await File.downloadFileAsync(
    `${base}/v1/documents/${documentId}/pages/${page}`,
    target,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return target.uri;
}
export function localizeImages<T extends { questions: any[]; pages: any[] }>(
  result: T,
): T {
  const mapping = new Map<string, string>();
  for (const q of result.questions)
    for (const image of q.images) {
      if (!image.uri.startsWith("data:")) continue;
      let uri = mapping.get(image.id);
      if (!uri) {
        const file = new File(
          fileRoot,
          `${uid()}.${image.uri.includes("image/png") ? "png" : "jpg"}`,
        );
        file.write(image.uri.split(",")[1], { encoding: "base64" });
        uri = file.uri;
        mapping.set(image.id, uri);
      }
      image.uri = uri;
    }
  return result;
}
