import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Image,
  Linking,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";
import {
  demoQuestions,
  grade,
  matchKeys,
  metrics,
  Mistakes,
  observations,
  priorities,
  startAttempt,
  validateQuestion,
  type Attempt,
  type Question,
  type Settings,
  type Parsed,
} from "@attemply/shared";
import { useStore } from "./store";
import {
  connection,
  downloadThumbnail,
  localizeImages,
  pair,
  request,
  upload,
} from "./api";
import { persistFile, uid, type Source } from "./storage";
import {
  Badge,
  Button,
  C,
  Card,
  Field,
  Heading,
  QuestionBody,
  RichText,
  Screen,
  s,
  ZoomImage,
  formatTime,
} from "./ui";
const showError = (e: unknown) =>
  Alert.alert(
    "Something needs attention",
    e instanceof Error ? e.message : "Please retry.",
  );
const safe = async (fn: () => Promise<void>) => {
  try {
    await fn();
  } catch (e) {
    showError(e);
  }
};
export function Home() {
  const { data, update, effective } = useStore();
  const incomplete = data.attempts.filter((a) => a.submittedAt === null);
  return (
    <Screen back={false} title="PRACTICE WITH PURPOSE">
      <Heading
        eyebrow="YOUR PERSONAL QUESTION LAB"
        detail="Turn the questions in front of you into your next breakthrough."
      >
        From paper.{"\n"}To progress.
      </Heading>
      <Card
        style={{
          backgroundColor: C.navy,
          borderColor: C.navy,
          padding: 24,
          gap: 18,
        }}
      >
        <View style={s.between}>
          <Badge>PHOTO → PRACTICE</Badge>
          <Text style={{ fontSize: 34, color: C.lime }}>⌁</Text>
        </View>
        <Text
          style={[s.title, { color: C.white, fontSize: 27, lineHeight: 33 }]}
        >
          A question sheet.{"\n"}A fresh start.
        </Text>
        <Text style={[s.body, { color: "#C8D2CA" }]}>
          Capture a page, check the questions, and make it a test of your own.
        </Text>
        <Button
          kind="lime"
          icon="scan-outline"
          onPress={() => router.push("/import?pick=camera")}
        >
          Scan questions
        </Button>
      </Card>
      <View style={s.row}>
        <View style={{ flex: 1, minWidth: 130 }}>
          <Button
            icon="document-text-outline"
            kind="ghost"
            onPress={() => router.push("/import?pick=pdf")}
          >
            Upload PDF
          </Button>
        </View>
        <View style={{ flex: 1, minWidth: 130 }}>
          <Button
            icon="images-outline"
            kind="ghost"
            onPress={() => router.push("/import?pick=gallery")}
          >
            Choose photos
          </Button>
        </View>
      </View>
      <Card>
        <View style={s.between}>
          <Text style={s.h2}>Take a test drive</Text>
          <Badge>OFFLINE</Badge>
        </View>
        <Text style={s.body}>
          8 original sample questions. Real timer, scoring, and insights. No
          setup needed.
        </Text>
        <Button
          kind="ghost"
          onPress={() =>
            safe(async () => {
              await update((d) => ({
                ...d,
                questions: demoQuestions,
                ignored: [],
                draftTitle: "The Attemply sample",
                settings: { ...d.settings, title: "The Attemply sample" },
              }));
              router.push("/configure");
            })
          }
        >
          Try demo CBT →
        </Button>
      </Card>
      {incomplete.map((a) => (
        <Card key={a.id}>
          <Badge>IN PROGRESS</Badge>
          <Text style={s.h2}>{a.settings.title}</Text>
          <Text style={s.small}>
            {a.questions.length} questions · answers saved on this device
          </Text>
          <Button onPress={() => router.push(`/attempt/${a.id}`)}>
            Continue test
          </Button>
        </Card>
      ))}
      {data.questions.length > 0 && (
        <Button kind="ghost" onPress={() => router.push("/preview")}>
          Open question workspace ({data.questions.length})
        </Button>
      )}
      <View style={s.between}>
        <Text style={s.h2}>Recent attempts</Text>
        <Text style={s.small}>
          {data.attempts.filter((a) => a.submittedAt !== null).length} saved
        </Text>
      </View>
      {data.attempts
        .filter((a) => a.submittedAt !== null)
        .map((a) => {
          const m = metrics(effective(a));
          return (
            <Pressable
              key={a.id}
              onPress={() => router.push(`/result/${a.id}`)}
            >
              <Card>
                <View style={s.between}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.h2}>{a.settings.title}</Text>
                    <Text style={s.small}>
                      {new Date(a.startedAt).toLocaleDateString()} ·{" "}
                      {m.attempted}/{m.total} attempted
                    </Text>
                  </View>
                  <Text style={s.h2}>
                    {m.score === null ? "—" : `${m.score}/${m.maxScore}`}
                  </Text>
                </View>
              </Card>
            </Pressable>
          );
        })}
      {!data.attempts.length && (
        <Text style={s.small}>
          Your first attempt starts a useful history. Everything stays on this
          device.
        </Text>
      )}
      <Button
        kind="ghost"
        icon="options-outline"
        onPress={() => router.push("/settings")}
      >
        Connection & local data
      </Button>
      <Pressable
        accessibilityLabel="Developer diagnostics"
        onLongPress={() => router.push("/debug")}
        delayLongPress={1000}
      >
        <Text style={[s.label, { textAlign: "center", padding: 10 }]}>
          ATTEMPLY LAB · PRIVATE PROTOTYPE
        </Text>
      </Pressable>
    </Screen>
  );
}
export function SettingsScreen() {
  const { data, clear } = useStore();
  const [base, setBase] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => {
    connection().then((c) => {
      setBase(c.base);
      setStatus(
        c.token
          ? "Paired session stored. Sessions expire after 24 hours."
          : "Demo is ready. Pair for live OCR.",
      );
    });
  }, []);
  return (
    <Screen title="SETTINGS">
      <Heading detail="Connect once to your private OCR service. The Mistral key belongs on your server.">
        Your lab connection
      </Heading>
      <Card>
        <Field
          label="HTTPS backend URL"
          value={base}
          onChangeText={setBase}
          autoCapitalize="none"
          keyboardType="url"
          placeholder="https://your-api.onrender.com"
        />
        <Field
          label="Private setup code"
          value={code}
          onChangeText={setCode}
          secureTextEntry
          autoCapitalize="none"
        />
        <Button
          onPress={() =>
            safe(async () => {
              await pair(base, code);
              setCode("");
              const health = await request("/v1/capabilities");
              setStatus(
                `Connected. OCR: ${health.ocr}. Text model: ${health.textAvailable ? "available" : "unavailable"}.`,
              );
            })
          }
        >
          Pair this device
        </Button>
        <Text style={s.small}>{status}</Text>
      </Card>
      <Card>
        <Text style={s.h2}>Your work stays with you</Text>
        <Text style={s.body}>
          {data.attempts.length} attempts · {data.sources.length} original
          sources. Saved tests, questions, and analysis are available offline.
        </Text>
        <Text style={s.small}>
          New OCR and AI interpretation need a paired backend and internet.
          Server sources expire after 24 hours; device copies remain.
        </Text>
        <Button
          kind="ghost"
          onPress={() =>
            safe(async () => {
              await request("/v1/data", { method: "DELETE" });
              Alert.alert(
                "Server data deleted",
                "Your local sources and attempts are still available.",
              );
            })
          }
        >
          Delete my server imports
        </Button>
        <Button
          kind="danger"
          onPress={() =>
            Alert.alert(
              "Delete all local study data?",
              "This permanently removes local sources, questions, attempts and reports.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete local data",
                  style: "destructive",
                  onPress: () =>
                    safe(async () => {
                      await clear();
                      router.replace("/");
                    }),
                },
              ],
            )
          }
        >
          Delete local data
        </Button>
      </Card>
    </Screen>
  );
}
export function ImportScreen() {
  const store = useStore();
  const { data, update } = store;
  const params = useLocalSearchParams<{ pick?: string }>();
  const [permission, askPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [crop, setCrop] = useState<Source | null>(null);
  const [cropValues, setCropValues] = useState(["0", "0", "100", "100"]);
  const [purpose, setPurpose] = useState<"questions" | "key">("questions");
  const auto = useRef(false);
  const polling = useRef(false);
  async function add(
    uri: string,
    name: string,
    mime: string,
    width?: number,
    height?: number,
  ) {
    const size = new File(uri).size;
    if (size > 25 * 1024 * 1024)
      throw Error("Choose a file smaller than 25 MB.");
    const originalUri = persistFile(uri, name);
    const src: Source = {
      id: uid(),
      uri: originalUri,
      originalUri,
      name,
      mime,
      width,
      height,
      selected: [0],
    };
    await update((d) => ({ ...d, sources: [...d.sources, src] }));
  }
  async function photos() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 20,
      quality: 1,
    });
    if (result.canceled) return;
    for (const asset of result.assets) {
      if (!["image/jpeg", "image/png"].includes(asset.mimeType ?? "image/jpeg"))
        throw Error("Export this photo as JPEG or PNG and try again.");
      await add(
        asset.uri,
        asset.fileName ?? "photo.jpg",
        asset.mimeType ?? "image/jpeg",
        asset.width,
        asset.height,
      );
    }
  }
  async function pdf() {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    await add(asset.uri, asset.name, "application/pdf");
  }
  async function openCamera() {
    const p = permission?.granted ? permission : await askPermission();
    if (!p.granted) {
      Alert.alert(
        "Camera access needed",
        "Allow camera access in your phone settings, or choose a gallery photo.",
        [
          { text: "Use gallery", onPress: () => safe(photos) },
          { text: "Settings", onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }
    setCameraOpen(true);
  }
  useEffect(() => {
    if (auto.current) return;
    auto.current = true;
    if (params.pick === "camera") void safe(openCamera);
    if (params.pick === "gallery") void safe(photos);
    if (params.pick === "pdf") void safe(pdf);
  }, []);
  async function patch(id: string, values: Partial<Source>) {
    await update((d) => ({
      ...d,
      sources: d.sources.map((source) =>
        source.id === id ? { ...source, ...values } : source,
      ),
    }));
  }
  async function prepare(source: Source) {
    setBusy("Uploading original and preparing page previews…");
    try {
      const prepared = await upload(source);
      const thumbnails: string[] = [];
      for (let page = 0; page < prepared.pageCount; page++)
        thumbnails.push(await downloadThumbnail(prepared.id, page));
      await patch(source.id, {
        serverId: prepared.id,
        pageCount: prepared.pageCount,
        thumbnails,
        selected: Array.from(
          { length: Math.min(prepared.pageCount, 20) },
          (_, i) => i,
        ),
      });
    } finally {
      setBusy("");
    }
  }
  async function extract(source: Source) {
    if (!source.serverId) throw Error("Prepare the source first.");
    if (!source.selected.length || source.selected.length > 20)
      throw Error("Select between 1 and 20 pages.");
    const job = await request("/v1/imports", {
      method: "POST",
      body: JSON.stringify({
        documentId: source.serverId,
        pages: source.selected,
        purpose,
      }),
    });
    await update((d) => ({
      ...d,
      pending: [
        ...d.pending.filter(
          (p) => p.sourceId !== source.id || p.purpose !== purpose,
        ),
        { id: job.id, sourceId: source.id, purpose, state: job.state },
      ],
    }));
  }
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      if (polling.current) return;
      polling.current = true;
      try {
        for (const pending of store.data.pending.filter(
          (p) => !["complete", "failed"].includes(p.state),
        )) {
          try {
            const status = await request(`/v1/imports/${pending.id}/status`);
            if (cancelled) return;
            if (status.state === "complete") {
              const job = await request(`/v1/imports/${pending.id}/result`);
              const result = localizeImages(job.result as Parsed);
              const source = store.data.sources.find(
                (src) => src.id === pending.sourceId,
              );
              for (const q of result.questions)
                q.source.originalUri = source?.originalUri;
              if (pending.purpose === "questions" && !result.questions.length)
                showError(
                  Error(
                    "No readable questions found. Try different pages, clearer photos, or inspect developer diagnostics.",
                  ),
                );
              if (pending.purpose === "key" && !job.keys.length)
                showError(
                  Error(
                    "No reliable answer-key entries found. Enter keys manually in the question editor.",
                  ),
                );
              await update((d) => ({
                ...d,
                questions:
                  pending.purpose === "questions"
                    ? [
                        ...d.questions.filter(
                          (q) =>
                            q.source.documentId !== source?.serverId &&
                            !(
                              source?.originalUri &&
                              q.source.originalUri === source.originalUri
                            ),
                        ),
                        ...result.questions,
                      ]
                    : matchKeys(d.questions, job.keys).questions,
                keys: pending.purpose === "key" ? job.keys : d.keys,
                ignored: [...d.ignored, ...result.ignored],
                debug: job,
                pending: d.pending.map((p) =>
                  p.id === pending.id ? { ...p, state: "complete" } : p,
                ),
              }));
            } else if (status.state !== pending.state)
              await update((d) => ({
                ...d,
                pending: d.pending.map((p) =>
                  p.id === pending.id
                    ? { ...p, state: status.state, error: status.error }
                    : p,
                ),
              }));
          } catch (e) {
            if (!cancelled)
              setBusy(
                e instanceof Error
                  ? e.message
                  : "Connection interrupted. Reopen this screen to resume polling.",
              );
          }
        }
      } finally {
        polling.current = false;
      }
    }
    void poll();
    const timer = setInterval(() => void poll(), 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [store.data.pending, store.data.sources]);
  if (cameraOpen)
    return (
      <Screen title="CAPTURE A PAGE">
        <Text style={s.body}>
          Keep the full page in frame, in even light. Avoid blur and glare.
        </Text>
        <CameraView
          ref={camera}
          style={{ height: 430, borderRadius: 20 }}
          facing="back"
          onMountError={() => {
            setCameraOpen(false);
            showError(Error("Camera unavailable. Use the gallery instead."));
          }}
        />
        <Button
          kind="lime"
          icon="camera"
          onPress={() =>
            safe(async () => {
              const image = await camera.current?.takePictureAsync({
                quality: 1,
              });
              if (!image) throw Error("No photo captured. Retry.");
              await add(
                image.uri,
                "capture.jpg",
                "image/jpeg",
                image.width,
                image.height,
              );
              setCameraOpen(false);
            })
          }
        >
          Capture page
        </Button>
        <Button kind="ghost" onPress={() => setCameraOpen(false)}>
          Cancel
        </Button>
      </Screen>
    );
  return (
    <Screen title="SOURCE WORKSPACE">
      <Heading
        eyebrow="01 / BRING YOUR QUESTIONS"
        detail="Preserve the original. Prepare the pages. Then check what OCR found."
      >
        Paper, meet practice.
      </Heading>
      <View style={s.row}>
        <Button
          kind="lime"
          icon="camera-outline"
          onPress={() => safe(openCamera)}
        >
          Camera
        </Button>
        <Button kind="ghost" onPress={() => safe(photos)}>
          Photos
        </Button>
        <Button kind="ghost" onPress={() => safe(pdf)}>
          PDF
        </Button>
      </View>
      <View style={s.row}>
        <Button
          kind={purpose === "questions" ? "primary" : "ghost"}
          onPress={() => setPurpose("questions")}
        >
          Question pages
        </Button>
        <Button
          kind={purpose === "key" ? "primary" : "ghost"}
          onPress={() => setPurpose("key")}
        >
          Answer-key pages
        </Button>
      </View>
      <Text style={s.small}>
        Up to 25 MB per file and 20 selected pages per import. Live OCR uses
        your paired backend. No demo data is substituted on failure.
      </Text>
      {!!busy && (
        <Card>
          <Text style={s.body}>{busy}</Text>
          <Button kind="ghost" onPress={() => setBusy("")}>
            Dismiss message / retry
          </Button>
          <Button kind="ghost" onPress={() => router.push("/settings")}>
            Connection settings
          </Button>
        </Card>
      )}
      {data.sources.map((source, index) => (
        <Card key={source.id}>
          <View style={s.between}>
            <Text style={[s.h2, { flex: 1 }]}>
              {index + 1}. {source.name}
            </Text>
            <Button
              kind="ghost"
              onPress={() =>
                safe(async () => {
                  const referenced = (q: Question) =>
                    q.source.documentId === source.id ||
                    q.source.documentId === source.serverId ||
                    Boolean(
                      q.source.originalUri &&
                      q.source.originalUri === source.originalUri,
                    );
                  if (
                    data.questions.some(referenced) ||
                    data.attempts.some((attempt) =>
                      attempt.questions.some(referenced),
                    )
                  )
                    throw Error(
                      "This original is linked to saved questions or attempts. Keep it for source verification; Settings can delete all local data when you choose.",
                    );
                  if (
                    data.pending.some(
                      (job) =>
                        job.sourceId === source.id &&
                        !["complete", "failed"].includes(job.state),
                    )
                  )
                    throw Error(
                      "Wait for this import to finish before removing its source.",
                    );
                  await update((d) => ({
                    ...d,
                    sources: d.sources.filter((x) => x.id !== source.id),
                  }));
                })
              }
            >
              Remove
            </Button>
          </View>
          {source.mime !== "application/pdf" ? (
            <ZoomImage uri={source.uri} label="Check image before OCR" />
          ) : (
            <Text style={s.small}>
              {source.pageCount
                ? `${source.pageCount} pages · choose pages below`
                : "PDF preserved. Prepare to see page thumbnails."}
            </Text>
          )}
          {source.mime !== "application/pdf" && (
            <View style={s.row}>
              <Button
                kind="ghost"
                onPress={() =>
                  safe(async () => {
                    const r = await manipulateAsync(
                      source.uri,
                      [{ rotate: 90 }],
                      { format: SaveFormat.JPEG, compress: 1 },
                    );
                    await patch(source.id, {
                      uri: persistFile(r.uri, "rotated.jpg"),
                      mime: "image/jpeg",
                      width: r.width,
                      height: r.height,
                      serverId: undefined,
                      thumbnails: undefined,
                    });
                  })
                }
              >
                Rotate 90°
              </Button>
              <Button
                kind="ghost"
                onPress={() => {
                  setCrop(source);
                  setCropValues(["0", "0", "100", "100"]);
                }}
              >
                Crop
              </Button>
            </View>
          )}
          <View style={s.row}>
            <Button
              kind="ghost"
              disabled={index === 0}
              onPress={() =>
                safe(async () => {
                  await update((d) => {
                    const sources = [...d.sources];
                    [sources[index - 1], sources[index]] = [
                      sources[index],
                      sources[index - 1],
                    ];
                    return { ...d, sources };
                  });
                })
              }
            >
              Move up
            </Button>
            <Text style={s.small}>Original retained</Text>
          </View>
          {source.thumbnails && (
            <View style={s.row}>
              {source.thumbnails.map((uri, page) => (
                <Pressable
                  key={uri}
                  accessibilityLabel={`Page ${page + 1}, ${source.selected.includes(page) ? "selected" : "not selected"}`}
                  onPress={() =>
                    safe(async () => {
                      const selected = source.selected.includes(page)
                        ? source.selected.filter((p) => p !== page)
                        : [...source.selected, page];
                      if (selected.length > 20)
                        throw Error("Select at most 20 pages.");
                      await patch(source.id, { selected });
                    })
                  }
                  style={{
                    width: 85,
                    gap: 4,
                    borderWidth: 2,
                    borderColor: source.selected.includes(page)
                      ? C.navy
                      : C.line,
                    padding: 5,
                    borderRadius: 10,
                  }}
                >
                  <Image
                    source={{ uri }}
                    style={{ height: 95, width: "100%" }}
                    resizeMode="contain"
                  />
                  <Text style={s.small}>
                    {source.selected.includes(page) ? "✓ " : ""}Page {page + 1}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {source.selected.length > 1 && source.serverId && (
            <Text style={s.small}>
              Selected page order:{" "}
              {source.selected.map((p) => p + 1).join(" → ")}. Tap off and on to
              reorder.
            </Text>
          )}
          <Button
            disabled={!!busy && !busy.includes("Session")}
            onPress={() =>
              safe(async () => {
                if (!source.serverId) await prepare(source);
                else await extract(source);
              })
            }
          >
            {source.serverId
              ? "Extract selected pages"
              : "Prepare source & page previews"}
          </Button>
          {source.serverId && (
            <Button
              kind="ghost"
              disabled={!!busy}
              onPress={() => safe(() => prepare(source))}
            >
              Prepare source again
            </Button>
          )}
          {data.pending
            .filter((p) => p.sourceId === source.id)
            .map((p) => (
              <View key={p.id} style={{ gap: 8 }}>
                <Badge>
                  {p.purpose.toUpperCase()} · {p.state.toUpperCase()}
                </Badge>
                {p.error && <Text style={s.error}>{p.error}</Text>}
                {p.state === "failed" && (
                  <Button
                    kind="ghost"
                    onPress={() => safe(() => extract(source))}
                  >
                    Retry import
                  </Button>
                )}
                {!["complete", "failed"].includes(p.state) && (
                  <Text style={s.small}>
                    You can leave and reopen this workspace to resume checking
                    the job.
                  </Text>
                )}
              </View>
            ))}
        </Card>
      ))}
      {data.questions.length > 0 && (
        <Button kind="lime" onPress={() => router.push("/preview")}>
          Review {data.questions.length} questions →
        </Button>
      )}
      <Button kind="ghost" onPress={() => router.push("/settings")}>
        Set up live OCR connection
      </Button>
      <Modal
        visible={!!crop}
        onRequestClose={() => setCrop(null)}
        animationType="slide"
      >
        <Screen title="CROP A COPY">
          <Heading detail="Enter a crop rectangle as percentages of the current image. The original is kept.">
            Focus the page
          </Heading>
          {crop && <ZoomImage uri={crop.uri} />}
          <View style={s.row}>
            {["Left %", "Top %", "Width %", "Height %"].map((label, i) => (
              <View key={label} style={{ width: "45%" }}>
                <Field
                  label={label}
                  value={cropValues[i]}
                  keyboardType="decimal-pad"
                  onChangeText={(value) =>
                    setCropValues((values) =>
                      values.map((v, j) => (j === i ? value : v)),
                    )
                  }
                />
              </View>
            ))}
          </View>
          <Button
            onPress={() =>
              safe(async () => {
                if (!crop) return;
                const [x, y, w, h] = cropValues.map(Number);
                if (
                  [x, y, w, h].some((v) => !Number.isFinite(v)) ||
                  x < 0 ||
                  y < 0 ||
                  w <= 0 ||
                  h <= 0 ||
                  x + w > 100 ||
                  y + h > 100
                )
                  throw Error("Crop must fit within 0–100%.");
                const width = crop.width ?? 1000,
                  height = crop.height ?? 1000;
                const result = await manipulateAsync(
                  crop.uri,
                  [
                    {
                      crop: {
                        originX: Math.round((width * x) / 100),
                        originY: Math.round((height * y) / 100),
                        width: Math.round((width * w) / 100),
                        height: Math.round((height * h) / 100),
                      },
                    },
                  ],
                  { format: SaveFormat.JPEG, compress: 1 },
                );
                await patch(crop.id, {
                  uri: persistFile(result.uri, "cropped.jpg"),
                  mime: "image/jpeg",
                  width: result.width,
                  height: result.height,
                  serverId: undefined,
                  thumbnails: undefined,
                });
                setCrop(null);
              })
            }
          >
            Apply crop & preview
          </Button>
          <Button kind="ghost" onPress={() => setCrop(null)}>
            Cancel
          </Button>
        </Screen>
      </Modal>
    </Screen>
  );
}
export function Preview() {
  const { data, update } = useStore();
  const [editing, setEditing] = useState<Question | null>(null);
  const [restoreTo, setRestoreTo] = useState("");
  const ready = data.questions.filter(
    (q) => q.status === "ready" && q.type !== "unsupported",
  );
  return (
    <Screen title="QUESTION WORKSPACE">
      <Heading
        eyebrow="02 / CHECK THE EXTRACTION"
        detail="Compare with the original. Confirm only what you can verify. Missing keys never become guessed answers."
      >
        {data.questions.length} questions.{"\n"}Your final say.
      </Heading>
      <View style={s.row}>
        <Badge>{ready.length} ready</Badge>
        <Badge>{data.questions.length - ready.length} need attention</Badge>
        <Badge>
          {data.questions.filter((q) => q.key?.confirmed).length} confirmed keys
        </Badge>
      </View>
      <Button
        kind="lime"
        disabled={!ready.length}
        onPress={() => router.push("/configure")}
      >
        Configure CBT with {ready.length} ready questions
      </Button>
      <Button kind="ghost" onPress={() => router.push("/import")}>
        Add sources or answer-key pages
      </Button>
      {data.keys.length > 0 && (
        <Card>
          <Text style={s.h2}>Source answer keys found</Text>
          <Text style={s.small}>
            Matches are provisional until you confirm each key in its question
            editor.
          </Text>
          {matchKeys(data.questions, data.keys).warnings.map((w, i) => (
            <Text style={s.error} key={i}>
              {w}
            </Text>
          ))}
        </Card>
      )}
      {data.questions.map((q, index) => (
        <Card key={q.id}>
          <View style={s.between}>
            <Text style={s.label}>
              {q.section} · Q{q.number}
            </Text>
            <Badge>
              {q.status === "ready"
                ? q.key?.confirmed
                  ? "READY · GRADED"
                  : "READY · UNGRADED"
                : q.status.toUpperCase()}
            </Badge>
          </View>
          <QuestionBody question={q} />
          {q.options.map((o) => (
            <View key={o.label + o.text} style={s.row}>
              <Text style={[s.body, { fontWeight: "700" }]}>{o.label}.</Text>
              <View style={{ flex: 1 }}>
                <RichText text={o.text} />
              </View>
            </View>
          ))}
          <Text style={s.small}>
            Source pages: {q.source.pages.map((p) => p + 1).join(", ")} · Key:{" "}
            {q.key?.confirmed
              ? q.key.provenance
              : q.key
                ? "awaiting confirmation"
                : "missing"}
          </Text>
          {q.warnings.map((w, i) => (
            <Text key={i} style={s.error}>
              {w}
            </Text>
          ))}
          <View style={s.row}>
            <Button onPress={() => setEditing(q)}>Edit & verify</Button>
            <Button
              kind="ghost"
              disabled={index === 0}
              onPress={() =>
                safe(async () => {
                  await update((d) => {
                    const questions = [...d.questions];
                    [questions[index - 1], questions[index]] = [
                      questions[index],
                      questions[index - 1],
                    ];
                    return { ...d, questions };
                  });
                })
              }
            >
              Move up
            </Button>
          </View>
          <View style={s.row}>
            <Button
              kind="ghost"
              onPress={() =>
                Alert.alert(
                  "Delete question?",
                  "Its original source remains available.",
                  [
                    { text: "Cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () =>
                        safe(async () => {
                          await update((d) => ({
                            ...d,
                            questions: d.questions.filter((x) => x.id !== q.id),
                          }));
                        }),
                    },
                  ],
                )
              }
            >
              Delete
            </Button>
            <Button
              kind="ghost"
              disabled={index === data.questions.length - 1}
              onPress={() =>
                safe(async () => {
                  await update((d) => {
                    const next = d.questions[index + 1];
                    return {
                      ...d,
                      questions: d.questions
                        .filter((x) => x.id !== next.id)
                        .map((x) =>
                          x.id === q.id
                            ? {
                                ...q,
                                text: q.text + "\n" + next.text,
                                options: [...q.options, ...next.options],
                                images: [...q.images, ...next.images],
                                source: {
                                  ...q.source,
                                  pages: [
                                    ...new Set([
                                      ...q.source.pages,
                                      ...next.source.pages,
                                    ]),
                                  ],
                                },
                                key: undefined,
                                status: "needs-review",
                                warnings: [
                                  "Merged manually. Check text, options, type and answer key.",
                                ],
                              }
                            : x,
                        ),
                    };
                  });
                })
              }
            >
              Merge with next
            </Button>
          </View>
        </Card>
      ))}
      {!!data.ignored.length && (
        <Card>
          <Text style={s.h2}>Ignored content ({data.ignored.length})</Text>
          <Text style={s.small}>
            These blocks were set aside, never discarded. Choose a question ID
            below to restore a block to its text.
          </Text>
          <Field
            label="Restore to question number"
            value={restoreTo}
            onChangeText={setRestoreTo}
          />
          {data.ignored.map((block) => (
            <View
              key={block.id + block.page + block.text}
              style={{ gap: 8, paddingVertical: 10 }}
            >
              <Text selectable style={s.body}>
                {block.text}
              </Text>
              <Text style={s.small}>
                Page {block.page + 1} · {block.reason}
              </Text>
              <Button
                kind="ghost"
                onPress={() =>
                  safe(async () => {
                    const matches = data.questions.filter(
                      (q) => q.number === restoreTo,
                    );
                    if (matches.length !== 1)
                      throw Error(
                        "Enter a unique question number. For duplicate numbers, first change one in the editor.",
                      );
                    await update((d) => ({
                      ...d,
                      ignored: d.ignored.filter((b) => b !== block),
                      questions: d.questions.map((q) =>
                        q.id === matches[0].id
                          ? {
                              ...q,
                              text: q.text + "\n" + block.text,
                              status: "needs-review",
                              warnings: [
                                ...q.warnings,
                                "Restored source block: verify grouping",
                              ],
                            }
                          : q,
                      ),
                    }));
                  })
                }
              >
                Restore block
              </Button>
            </View>
          ))}
        </Card>
      )}
      <Button
        kind="ghost"
        onPress={() =>
          Alert.alert(
            "Clear question workspace?",
            "Saved attempts and original files remain.",
            [
              { text: "Cancel" },
              {
                text: "Clear workspace",
                onPress: () =>
                  safe(async () => {
                    await update((d) => ({
                      ...d,
                      questions: [],
                      ignored: [],
                      keys: [],
                    }));
                  }),
              },
            ],
          )
        }
      >
        Start an empty workspace
      </Button>
      <Modal
        visible={!!editing}
        animationType="slide"
        onRequestClose={() => setEditing(null)}
      >
        {editing && (
          <Editor
            key={editing.id}
            initial={editing}
            onSave={async (q) => {
              await update((d) => ({
                ...d,
                questions: d.questions.map((old) =>
                  old.id === q.id ? q : old,
                ),
              }));
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </Screen>
  );
}
function Editor({
  initial,
  onSave,
  onCancel,
}: {
  initial: Question;
  onSave: (q: Question) => Promise<void>;
  onCancel: () => void;
}) {
  const { data, update } = useStore();
  const [q, setQ] = useState(initial);
  const [options, setOptions] = useState(
    q.options.map((o) => `${o.label}|${o.text}`).join("\n"),
  );
  const [key, setKey] = useState(q.key?.values.join(",") ?? "");
  const [confirmed, setConfirmed] = useState(q.key?.confirmed ?? false);
  const [tolerance, setTolerance] = useState(String(q.key?.tolerance ?? 0));
  const [split, setSplit] = useState("");
  const source = data.sources.find(
    (src) =>
      src.serverId === q.source.documentId ||
      src.id === q.source.documentId ||
      Boolean(q.source.originalUri && src.originalUri === q.source.originalUri),
  );
  const patch = (values: Partial<Question>) =>
    setQ((old) => ({ ...old, ...values }));
  return (
    <Screen
      title="EDIT QUESTION"
      footer={
        <View style={s.row}>
          <Button kind="ghost" onPress={onCancel}>
            Cancel
          </Button>
          <Button
            kind="lime"
            onPress={() =>
              safe(async () => {
                const parsedOptions = options
                  .split("\n")
                  .filter((x) => x.trim())
                  .map((line) => {
                    const i = line.indexOf("|");
                    if (i < 1)
                      throw Error("Write each option as label|content.");
                    return {
                      label: line.slice(0, i).trim(),
                      text: line.slice(i + 1),
                    };
                  });
                const values = key
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean);
                if (
                  !Number.isFinite(Number(tolerance)) ||
                  Number(tolerance) < 0
                )
                  throw Error("Numerical tolerance must be zero or positive.");
                const next = validateQuestion({
                  ...q,
                  options: parsedOptions,
                  key: values.length
                    ? {
                        values,
                        provenance: confirmed
                          ? "manual"
                          : (q.key?.provenance ?? "manual"),
                        confirmed,
                        tolerance: Number(tolerance),
                        updatedAt: Date.now(),
                        source: q.key?.source,
                      }
                    : undefined,
                });
                await onSave(next);
              })
            }
          >
            Save question
          </Button>
        </View>
      }
    >
      <Heading>Check every detail.</Heading>
      <Field
        label="Source question number"
        value={q.number}
        onChangeText={(number) => patch({ number })}
      />
      <Field
        label="Subject / section"
        value={q.section}
        onChangeText={(section) => patch({ section })}
      />
      <Field
        label="Question text (LaTeX is supported)"
        multiline
        value={q.text}
        onChangeText={(text) => patch({ text })}
      />
      <QuestionBody question={q} />
      <Text style={s.label}>QUESTION FORMAT</Text>
      <View style={s.row}>
        {(["single", "multiple", "numerical", "unsupported"] as const).map(
          (type) => (
            <Button
              key={type}
              kind={q.type === type ? "primary" : "ghost"}
              onPress={() => patch({ type })}
            >
              {type}
            </Button>
          ),
        )}
      </View>
      <Field
        label="Options: one label|content per line"
        multiline
        value={options}
        onChangeText={setOptions}
      />
      <Field
        label="Correct answer labels, separated by commas (or numerical value)"
        value={key}
        onChangeText={(value) => {
          setKey(value);
          setConfirmed(false);
        }}
        autoCapitalize="none"
      />
      <Field
        label="Numerical tolerance"
        value={tolerance}
        onChangeText={setTolerance}
        keyboardType="decimal-pad"
      />
      <Button
        kind={confirmed ? "lime" : "ghost"}
        onPress={() => setConfirmed((v) => !v)}
      >
        {confirmed
          ? "✓ I confirmed this key against a trusted source"
          : "Confirm key against a trusted source"}
      </Button>
      <Text style={s.small}>
        Leave the key empty to take this question ungraded.
      </Text>
      {q.warnings.map((w, i) => (
        <Text key={i} style={s.error}>
          {w}
        </Text>
      ))}
      <Button
        kind="ghost"
        onPress={() => patch({ warnings: [], status: "ready" })}
      >
        I checked the original; resolve extraction warnings
      </Button>
      <Button
        kind="ghost"
        onPress={() =>
          safe(async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              quality: 1,
            });
            if (result.canceled) return;
            const uri = persistFile(result.assets[0].uri, "attached.jpg");
            patch({
              images: [
                ...q.images,
                { id: uid(), page: q.source.pages[0], uri },
              ],
            });
          })
        }
      >
        Attach a diagram
      </Button>
      {source && (
        <Card>
          <Text style={s.h2}>Original source</Text>
          {q.source.pages.map((page) => (
            <ZoomImage
              key={page}
              uri={source.thumbnails?.[page] ?? source.originalUri}
              label={`Original page ${page + 1}`}
            />
          ))}
          {source.mime !== "application/pdf" &&
            source.uri !== source.originalUri && (
              <ZoomImage uri={source.originalUri} label="Uncropped original" />
            )}
        </Card>
      )}
      <Card>
        <Text style={s.h2}>Split a merged question</Text>
        <Text style={s.small}>
          Enter the character position where the next question begins. The new
          question needs options and a format check.
        </Text>
        <Field
          label="Split at character"
          value={split}
          onChangeText={setSplit}
          keyboardType="number-pad"
        />
        <Button
          kind="ghost"
          onPress={() =>
            safe(async () => {
              const position = Number(split);
              if (
                !Number.isInteger(position) ||
                position < 1 ||
                position >= q.text.length
              )
                throw Error("Enter a position within the question text.");
              const second: Question = {
                ...q,
                id: uid(),
                number: q.number + "b",
                text: q.text.slice(position),
                options: [],
                key: undefined,
                status: "needs-review",
                warnings: [
                  "Split manually. Assign options and verify the source.",
                ],
              };
              await update((d) => ({
                ...d,
                questions: d.questions.flatMap((old) =>
                  old.id === q.id
                    ? [
                        {
                          ...q,
                          text: q.text.slice(0, position),
                          status: "needs-review",
                          warnings: ["Split manually. Check option ownership."],
                        },
                        second,
                      ]
                    : [old],
                ),
              }));
              onCancel();
            })
          }
        >
          Split & return to workspace
        </Button>
      </Card>
    </Screen>
  );
}
export function Configure() {
  const { data, update } = useStore();
  const [title, setTitle] = useState(data.settings.title);
  const [minutes, setMinutes] = useState(String(data.settings.minutes));
  const [correct, setCorrect] = useState(String(data.settings.correct));
  const [incorrect, setIncorrect] = useState(String(data.settings.incorrect));
  const [mode, setMode] = useState<Settings["mode"]>(data.settings.mode);
  const ready = data.questions.filter(
    (q) => q.status === "ready" && q.type !== "unsupported",
  );
  return (
    <Screen title="TEST SETUP">
      <Heading
        eyebrow="03 / MAKE IT YOUR TEST"
        detail="Only questions marked ready enter this attempt. You can revisit the rest later."
      >
        A little focus.{"\n"}A lot of possibility.
      </Heading>
      <Card>
        <Badge>
          {ready.length} ready questions ·{" "}
          {ready.filter((q) => q.key?.confirmed).length} graded
        </Badge>
        <Field label="Test title" value={title} onChangeText={setTitle} />
        <View style={s.row}>
          <Button
            kind={mode === "timed" ? "primary" : "ghost"}
            onPress={() => setMode("timed")}
          >
            Timed CBT
          </Button>
          <Button
            kind={mode === "practice" ? "primary" : "ghost"}
            onPress={() => setMode("practice")}
          >
            Untimed practice
          </Button>
        </View>
        {mode === "timed" && (
          <Field
            label="Duration in minutes"
            keyboardType="number-pad"
            value={minutes}
            onChangeText={setMinutes}
          />
        )}
        <Text style={s.label}>MARKING SCHEME</Text>
        <View style={s.row}>
          <Button
            kind="ghost"
            onPress={() => {
              setCorrect("4");
              setIncorrect("-1");
            }}
          >
            +4 / −1
          </Button>
          <Button
            kind="ghost"
            onPress={() => {
              setCorrect("1");
              setIncorrect("0");
            }}
          >
            +1 / 0
          </Button>
        </View>
        <Field
          label="Marks for a correct answer"
          value={correct}
          onChangeText={setCorrect}
          keyboardType="numbers-and-punctuation"
        />
        <Field
          label="Marks for an incorrect answer (zero or negative)"
          value={incorrect}
          onChangeText={setIncorrect}
          keyboardType="numbers-and-punctuation"
        />
        <Text style={s.small}>
          Unattempted questions earn 0. Multiple-select uses exact matching,
          without partial credit. Numerical questions use the key's configured
          tolerance. Questions without confirmed keys remain ungraded.
        </Text>
      </Card>
      <Button
        kind="lime"
        disabled={!ready.length}
        onPress={() =>
          safe(async () => {
            const settings: Settings = {
              title: title.trim(),
              minutes: Number(minutes),
              correct: Number(correct),
              incorrect: Number(incorrect),
              mode,
            };
            if (
              !settings.title ||
              settings.title.length > 120 ||
              ![settings.minutes, settings.correct, settings.incorrect].every(
                Number.isFinite,
              ) ||
              settings.minutes < 1 ||
              settings.minutes > 600 ||
              settings.correct < 0 ||
              settings.correct > 100 ||
              settings.incorrect > 0 ||
              settings.incorrect < -100
            )
              throw Error(
                "Use a title, 1–600 minutes and valid marks (+0–100 / −100–0).",
              );
            const attempt = startAttempt(uid(), ready, settings);
            await update((d) => ({
              ...d,
              settings,
              attempts: [attempt, ...d.attempts],
            }));
            router.replace(`/attempt/${attempt.id}`);
          })
        }
      >
        Start {mode === "timed" ? "timed test" : "practice"} →
      </Button>
      <Text style={s.small}>
        Timed tests keep counting in the background. Answers and events are
        saved on this device.
      </Text>
    </Screen>
  );
}
export function AttemptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, act } = useStore();
  const attempt = data.attempts.find((a) => a.id === id);
  const [now, setNow] = useState(Date.now());
  const [palette, setPalette] = useState(false);
  const [number, setNumber] = useState("");
  const latest = useRef(attempt);
  latest.current = attempt;
  useFocusEffect(
    useCallback(() => {
      void act(id, { type: "foreground" }).catch(showError);
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "active")
          void act(id, { type: "foreground" }).catch(showError);
      });
      let ticks = 0;
      const timer = setInterval(() => {
        setNow(Date.now());
        ticks++;
        if (
          ticks % 5 === 0 ||
          (latest.current?.deadline !== null &&
            latest.current?.deadline !== undefined &&
            Date.now() >= latest.current.deadline)
        )
          void act(id, { type: "tick" }).catch(() => {});
      }, 1000);
      return () => {
        clearInterval(timer);
        sub.remove();
        void act(id, { type: "background" }).catch(() => {});
      };
    }, [id]),
  );
  useEffect(() => {
    if (attempt?.submittedAt !== null && attempt?.submittedAt !== undefined)
      router.replace(`/result/${id}`);
  }, [attempt?.submittedAt]);
  useEffect(() => {
    if (attempt) {
      const r = attempt.responses[attempt.questions[attempt.current].id];
      setNumber(r.answer[0] ?? "");
    }
  }, [attempt?.current]);
  if (!attempt)
    return (
      <Screen>
        <Heading>Attempt not found</Heading>
        <Button onPress={() => router.replace("/")}>Home</Button>
      </Screen>
    );
  const q = attempt.questions[attempt.current],
    response = attempt.responses[q.id];
  const saveNumber = async () => {
    if (q.type === "numerical" && number.trim())
      await act(id, { type: "answer", values: [number.trim()] });
  };
  async function go(index: number) {
    await saveNumber();
    await act(id, { type: "visit", index });
  }
  const remaining = attempt.deadline === null ? null : attempt.deadline - now;
  return (
    <Screen
      title="FOCUS MODE"
      footer={
        <View style={{ gap: 10 }}>
          <View style={s.between}>
            <Button
              kind="ghost"
              disabled={attempt.current === 0}
              onPress={() => safe(() => go(attempt.current - 1))}
            >
              ← Previous
            </Button>
            <Button
              kind="lime"
              onPress={() =>
                safe(async () => {
                  await saveNumber();
                  if (attempt.current < attempt.questions.length - 1)
                    await go(attempt.current + 1);
                  else setPalette(true);
                })
              }
            >
              Save & next →
            </Button>
          </View>
          <Button
            kind="ghost"
            onPress={() =>
              safe(async () => {
                await saveNumber();
                const m = metrics(latest.current!);
                Alert.alert(
                  "Submit this test?",
                  `${m.attempted} answered · ${m.total - m.attempted} unanswered. Submission closes this attempt.`,
                  [
                    { text: "Keep solving", style: "cancel" },
                    {
                      text: "Submit test",
                      onPress: () =>
                        safe(async () => {
                          await act(id, { type: "submit" });
                          router.replace(`/result/${id}`);
                        }),
                    },
                  ],
                );
              })
            }
          >
            Submit test
          </Button>
        </View>
      }
    >
      <View style={s.between}>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={s.h2}>{attempt.settings.title}</Text>
          <Text style={s.small}>
            {q.section} · {attempt.current + 1} of {attempt.questions.length}
          </Text>
        </View>
        <Badge>{remaining === null ? "UNTIMED" : formatTime(remaining)}</Badge>
      </View>
      <View style={{ height: 4, backgroundColor: C.line, borderRadius: 2 }}>
        <View
          style={{
            height: 4,
            width: `${((attempt.current + 1) / attempt.questions.length) * 100}%`,
            backgroundColor: C.navy,
          }}
        />
      </View>
      <View style={s.between}>
        <Text style={s.label}>QUESTION {q.number}</Text>
        <Button
          kind="ghost"
          onPress={() =>
            safe(async () => {
              await saveNumber();
              setPalette((v) => !v);
            })
          }
        >
          Palette
        </Button>
      </View>
      {palette && (
        <Card>
          <Text style={s.h2}>Your question map</Text>
          <Text style={s.small}>
            ○ Not visited · ◌ Unanswered · ● Answered · ⚑ Review · ●⚑ Answered +
            review. A navy border shows the current question.
          </Text>
          <View style={s.row}>
            {attempt.questions.map((question, index) => {
              const r = attempt.responses[question.id];
              return (
                <Pressable
                  key={question.id}
                  accessibilityLabel={`Question ${index + 1}, ${!r.visits ? "not visited" : r.answer.length ? "answered" : "unanswered"}${r.marked ? ", marked for review" : ""}`}
                  onPress={() =>
                    safe(async () => {
                      await go(index);
                      setPalette(false);
                    })
                  }
                  style={{
                    minWidth: 49,
                    minHeight: 49,
                    padding: 9,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 12,
                    backgroundColor:
                      r.marked && !r.answer.length
                        ? "#F6E8C9"
                        : r.answer.length
                          ? C.lime
                          : r.visits
                            ? C.soft
                            : C.white,
                    borderWidth: index === attempt.current ? 2 : 1,
                    borderColor: index === attempt.current ? C.navy : C.line,
                  }}
                >
                  <Text style={s.body}>
                    {index + 1}
                    {r.marked ? "⚑" : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      )}
      <Card>
        <QuestionBody question={q} />
        {q.type === "numerical" ? (
          <View style={{ gap: 10 }}>
            <Field
              label="Numerical answer"
              keyboardType="numbers-and-punctuation"
              value={number}
              onChangeText={(value) => {
                setNumber(value);
                if (value.trim() && Number.isFinite(Number(value)))
                  void act(id, {
                    type: "answer",
                    values: [value.trim()],
                  }).catch(showError);
                else if (value === "")
                  void act(id, { type: "clear" }).catch(showError);
              }}
            />
            <Button kind="ghost" onPress={() => safe(saveNumber)}>
              Save numerical response
            </Button>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {q.type === "multiple" && (
              <Text style={s.small}>Select all answers that apply.</Text>
            )}
            {q.options.map((o) => {
              const selected = response.answer.includes(o.label);
              return (
                <Pressable
                  key={o.label}
                  accessibilityRole={
                    q.type === "multiple" ? "checkbox" : "radio"
                  }
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`Option ${o.label}: ${o.text}`}
                  onPress={() =>
                    safe(() =>
                      act(id, {
                        type: "answer",
                        values:
                          q.type === "multiple"
                            ? selected
                              ? response.answer.filter((v) => v !== o.label)
                              : [...response.answer, o.label]
                            : [o.label],
                      }),
                    )
                  }
                  style={[s.option, selected && s.selected]}
                >
                  <View
                    style={{
                      height: 30,
                      width: 30,
                      borderRadius: 10,
                      backgroundColor: selected ? C.navy : C.soft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: selected ? C.white : C.navy,
                        fontWeight: "700",
                      }}
                    >
                      {o.label}
                    </Text>
                  </View>
                  <View pointerEvents="none" style={{ flex: 1 }}>
                    <RichText text={o.text} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>
      <View style={s.row}>
        <Button
          kind={response.marked ? "lime" : "ghost"}
          icon="flag-outline"
          onPress={() => safe(() => act(id, { type: "mark" }))}
        >
          {response.marked ? "Marked for review" : "Mark for review"}
        </Button>
        <Button
          kind="ghost"
          onPress={() =>
            safe(async () => {
              setNumber("");
              await act(id, { type: "clear" });
            })
          }
        >
          Clear response
        </Button>
      </View>
      <Text style={s.small}>
        Changes save automatically. You can leave and continue from Home.
      </Text>
    </Screen>
  );
}
function useAttempt() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const original = store.data.attempts.find((a) => a.id === id);
  return {
    ...store,
    id,
    attempt: original ? store.effective(original) : undefined,
  };
}
async function reattempt(
  a: Attempt,
  questions: Question[],
  update: ReturnType<typeof useStore>["update"],
) {
  if (!questions.length)
    throw Error("No eligible questions in this selection.");
  const settings = {
    ...a.settings,
    title: `Reattempt · ${a.settings.title}`.slice(0, 120),
  };
  const next = startAttempt(uid(), questions, settings, Date.now(), a.id);
  await update((d) => ({ ...d, attempts: [next, ...d.attempts] }));
  router.push(`/attempt/${next.id}`);
}
function Missing() {
  return (
    <Screen>
      <Heading>Saved attempt unavailable</Heading>
      <Button onPress={() => router.replace("/")}>Back to Home</Button>
    </Screen>
  );
}
export function ResultScreen() {
  const { attempt: a, id, update } = useAttempt();
  if (!a || a.submittedAt === null) return <Missing />;
  const m = metrics(a);
  return (
    <Screen title="YOUR RESULT" back={false}>
      <Heading
        eyebrow="ONE ATTEMPT. NEW INFORMATION."
        detail={
          m.graded
            ? `${m.graded} of ${m.total} questions have confirmed keys. ${m.graded < m.total ? "This is a partially graded result." : ""}`
            : "No verified key is available. Your answers, timing and behaviour are saved; a score cannot be reported."
        }
      >
        {a.settings.title}
      </Heading>
      <Card
        style={{ backgroundColor: C.navy, borderColor: C.navy, padding: 26 }}
      >
        <Text style={[s.label, { color: "#BBC9BA" }]}>
          {m.graded ? "YOUR SCORE" : "UNGRADED ATTEMPT"}
        </Text>
        <Text
          style={{
            fontSize: 64,
            fontWeight: "800",
            letterSpacing: -3,
            color: C.lime,
          }}
        >
          {m.score === null ? "—" : m.score}
          <Text style={{ fontSize: 22, color: "#CCD5CE", letterSpacing: 0 }}>
            {m.graded ? ` / ${m.maxScore}` : ""}
          </Text>
        </Text>
        <Text style={[s.body, { color: C.white }]}>
          {m.attempted} questions attempted. Every attempt gives you something
          to work with.
        </Text>
      </Card>
      <View style={s.row}>
        {[
          ["Attempted", `${m.attempted}/${m.total}`],
          ["Attempt rate", `${Math.round(m.attemptRate)}%`],
          ["Elapsed time", formatTime(m.elapsedMs)],
          ...(m.graded
            ? [
                ["Correct", String(m.correct)],
                ["Incorrect", String(m.incorrect)],
                [
                  "Graded accuracy",
                  m.accuracy === null ? "—" : `${Math.round(m.accuracy)}%`,
                ],
                ["Negative marks", String(m.negativeMarks)],
              ]
            : []),
          ["Unattempted", String(m.unattempted)],
        ].map(([label, value]) => (
          <Card key={label} style={{ width: "47%", flexGrow: 1 }}>
            <Text style={s.small}>{label}</Text>
            <Text style={s.stat}>{value}</Text>
          </Card>
        ))}
      </View>
      <Button kind="lime" onPress={() => router.push(`/analysis/${id}`)}>
        Explore your analysis →
      </Button>
      <Button onPress={() => router.push(`/review/${id}`)}>
        Review questions & mistakes
      </Button>
      <View style={s.row}>
        <Button
          kind="ghost"
          onPress={() => safe(() => reattempt(a, a.questions, update))}
        >
          Reattempt all
        </Button>
        <Button
          kind="ghost"
          disabled={!m.incorrect}
          onPress={() =>
            safe(() =>
              reattempt(
                a,
                a.questions.filter(
                  (q) => grade(q, a.responses[q.id]) === "incorrect",
                ),
                update,
              ),
            )
          }
        >
          Reattempt wrong
        </Button>
      </View>
      <Button kind="ghost" onPress={() => router.replace("/")}>
        Back to Home
      </Button>
      <Text style={s.small}>
        Scores are calculated from confirmed keys. Later key corrections retain
        your original submitted responses and key history.
      </Text>
    </Screen>
  );
}
export function AnalysisScreen() {
  const { attempt: a, id, data, update } = useAttempt();
  if (!a || a.submittedAt === null) return <Missing />;
  const m = metrics(a);
  const report = data.reports[id] as
    | {
        kind?: string;
        reason?: string;
        insights?: { text: string; questionIds: string[] }[];
      }
    | undefined;
  const slow = [...m.rows].sort((x, y) => y.activeMs - x.activeMs);
  const high = priorities(a).filter((p) => p.priority > 0);
  const correctMs = m.rows
      .filter((r) => r.result === "correct")
      .reduce((n, r) => n + r.activeMs, 0),
    incorrectMs = m.rows
      .filter((r) => r.result === "incorrect")
      .reduce((n, r) => n + r.activeMs, 0);
  return (
    <Screen title="ATTEMPT ANALYSIS">
      <Heading
        eyebrow="EVIDENCE, THEN INSIGHT"
        detail="A useful reflection of this test, built from your actual responses and active time."
      >
        Find your next step.
      </Heading>
      <Card>
        <Text style={s.h2}>Overview</Text>
        <Badge>DETERMINISTIC OBSERVATIONS</Badge>
        {observations(a).map((line) => (
          <Text key={line} style={s.body}>
            • {line}
          </Text>
        ))}
      </Card>
      <Card>
        <View style={s.between}>
          <Text style={s.h2}>Optional AI interpretation</Text>
          <Badge>{report?.kind === "ai" ? "AI GENERATED" : "OPTIONAL"}</Badge>
        </View>
        <Text style={s.small}>
          AI prioritizes observations from recorded metrics. The displayed facts
          and next steps are generated by deterministic rules. It cannot verify
          your keys or infer mistake reasons.
        </Text>
        {report?.reason && <Text style={s.small}>{report.reason}</Text>}
        {report?.insights?.map((insight, i) => (
          <View key={i} style={{ gap: 4 }}>
            <Text style={s.body}>{insight.text}</Text>
            <Text style={s.small}>
              Evidence:{" "}
              {insight.questionIds
                .map(
                  (qid) =>
                    `Q${a.questions.find((q) => q.id === qid)?.number ?? qid}`,
                )
                .join(", ")}
            </Text>
          </View>
        ))}
        <Button
          kind="ghost"
          onPress={() =>
            safe(async () => {
              try {
                const r = await request("/v1/analysis", {
                  method: "POST",
                  body: JSON.stringify(a),
                });
                await update((d) => ({
                  ...d,
                  reports: { ...d.reports, [id]: r },
                }));
              } catch (e) {
                await update((d) => ({
                  ...d,
                  reports: {
                    ...d.reports,
                    [id]: {
                      kind: "deterministic",
                      reason:
                        e instanceof Error
                          ? e.message
                          : "AI service unavailable.",
                      insights: [],
                    },
                  },
                }));
              }
            })
          }
        >
          Generate / refresh interpretation
        </Button>
      </Card>
      <Card>
        <Text style={s.h2}>Where the time went</Text>
        <Text style={s.small}>
          Elapsed time: {formatTime(m.elapsedMs)}. Background time is excluded
          from active question time.
        </Text>
        {m.graded > 0 && (
          <Text style={s.body}>
            Active time on correct answers: {formatTime(correctMs)}. On
            incorrect answers: {formatTime(incorrectMs)}.
          </Text>
        )}
        {slow.map((r) => (
          <View key={r.id} style={{ gap: 6 }}>
            <View style={s.between}>
              <Text style={s.body}>Question {r.number}</Text>
              <Text style={s.small}>{formatTime(r.activeMs)}</Text>
            </View>
            <View
              style={{ height: 6, backgroundColor: C.soft, borderRadius: 3 }}
            >
              <View
                style={{
                  height: 6,
                  width: `${Math.max(1, (r.activeMs / Math.max(1, slow[0].activeMs)) * 100)}%`,
                  backgroundColor: r.result === "incorrect" ? C.amber : C.navy,
                  borderRadius: 3,
                }}
              />
            </View>
            <Text style={s.small}>
              {r.visits} visits · {r.changes} changes ·{" "}
              {formatTime(r.revisitMs)} on revisits · {r.result}
            </Text>
          </View>
        ))}
      </Card>
      <Card>
        <Text style={s.h2}>Question behaviour</Text>
        {[
          ["Marked", m.rows.filter((r) => r.marked).length],
          ["Revisited", m.rows.filter((r) => r.visits > 1).length],
          [
            "Visited, unanswered",
            m.rows.filter((r) => r.visits > 0 && !r.answer.length).length,
          ],
          ["Never visited", m.rows.filter((r) => !r.visits).length],
          ["Answer changes", m.rows.reduce((n, r) => n + r.changes, 0)],
        ].map(([label, value]) => (
          <View style={s.between} key={label}>
            <Text style={s.body}>{label}</Text>
            <Text style={s.h2}>{value}</Text>
          </View>
        ))}
        <Text style={s.small}>
          A revisit is any visit after the first. Individual visit durations and
          response changes are retained in the event log.
        </Text>
      </Card>
      <Card>
        <Text style={s.h2}>Worth another look</Text>
        {high.length ? (
          high.map((r) => (
            <View key={r.id} style={{ gap: 5 }}>
              <Text style={s.body}>
                Q{r.number} · {r.reasons.join(" · ")}
              </Text>
              <Text style={s.small}>
                Priority {r.priority}; based on observable events and your own
                tags.
              </Text>
            </View>
          ))
        ) : (
          <Text style={s.body}>
            No high-priority mistakes can be established from the available
            evidence.
          </Text>
        )}
        <Button onPress={() => router.push(`/review/${id}`)}>
          Review & tag mistakes
        </Button>
      </Card>
      <Card>
        <Text style={s.h2}>A practical next step</Text>
        <Text style={s.body}>
          {m.incorrect
            ? "Reattempt the incorrect questions without looking at the key. Then compare your method with the source."
            : !m.graded
              ? "Confirm an answer key from a reliable source before drawing conclusions about correctness."
              : "Review questions you marked or spent the most time on, then try a fresh attempt."}
        </Text>
        <Text style={s.small}>
          This report describes this attempt. It does not establish long-term
          topic strength or weakness.
        </Text>
      </Card>
    </Screen>
  );
}
export function ReviewScreen() {
  const { attempt: a, id, act, update, data } = useAttempt();
  const [index, setIndex] = useState(0);
  const [keyValue, setKeyValue] = useState("");
  if (!a || a.submittedAt === null) return <Missing />;
  const q = a.questions[Math.min(index, a.questions.length - 1)],
    r = a.responses[q.id];
  const result = grade(q, r);
  const source = data.sources.find(
    (src) =>
      src.serverId === q.source.documentId ||
      src.id === q.source.documentId ||
      Boolean(q.source.originalUri && src.originalUri === q.source.originalUri),
  );
  return (
    <Screen title="QUESTION REVIEW">
      <Heading eyebrow={`${index + 1} OF ${a.questions.length}`}>
        Make this question count.
      </Heading>
      <View style={s.row}>
        {a.questions.map((question, i) => (
          <Pressable
            key={question.id}
            onPress={() => {
              setIndex(i);
              setKeyValue("");
            }}
            style={{
              padding: 12,
              minWidth: 42,
              minHeight: 44,
              borderRadius: 10,
              backgroundColor: i === index ? C.navy : C.soft,
            }}
          >
            <Text style={{ color: i === index ? C.white : C.navy }}>
              {i + 1}
            </Text>
          </Pressable>
        ))}
      </View>
      <Card>
        <View style={s.between}>
          <Text style={s.label}>
            {q.section} · Q{q.number}
          </Text>
          <Badge>{result.toUpperCase()}</Badge>
        </View>
        <QuestionBody question={q} />
        {q.options.map((o) => (
          <View
            key={o.label}
            style={[s.option, r.answer.includes(o.label) && s.selected]}
          >
            <Text style={s.body}>{o.label}.</Text>
            <View style={{ flex: 1 }}>
              <RichText text={o.text} />
            </View>
            {q.key?.confirmed && q.key.values.includes(o.label) && (
              <Text style={{ color: C.muted }}>✓</Text>
            )}
          </View>
        ))}
        <Text style={s.body}>
          Your response: {r.answer.join(", ") || "Unanswered"}
        </Text>
        <Text style={s.body}>
          Confirmed key:{" "}
          {q.key?.confirmed ? q.key.values.join(", ") : "Unavailable"}
        </Text>
        <Text style={s.small}>
          {q.key?.source ?? q.key?.provenance ?? "No key provenance"} ·{" "}
          {formatTime(r.activeMs)} active · {r.visits} visits · {r.changes}{" "}
          changes
        </Text>
        {q.key?.confirmed && (
          <Text style={s.body}>
            Marks:{" "}
            {result === "correct"
              ? a.settings.correct
              : result === "incorrect"
                ? a.settings.incorrect
                : 0}
          </Text>
        )}
        {q.explanation && (
          <View style={{ gap: 8 }}>
            <Badge>ORIGINAL SAMPLE EXPLANATION</Badge>
            <RichText text={q.explanation} />
          </View>
        )}
        {source &&
          q.source.pages.map((page) => (
            <ZoomImage
              key={page}
              uri={source.thumbnails?.[page] ?? source.originalUri}
              label={`Original source · page ${page + 1}`}
            />
          ))}
      </Card>
      <Card>
        <Text style={s.h2}>What happened here?</Text>
        <Text style={s.small}>
          Only you can identify the reason. No mistake reason is inferred
          automatically.
        </Text>
        <View style={s.row}>
          {Mistakes.map((reason) => (
            <Button
              key={reason}
              kind={r.mistake === reason ? "lime" : "ghost"}
              onPress={() =>
                safe(() =>
                  act(id, { type: "mistake", questionId: q.id, reason }),
                )
              }
            >
              {reason}
            </Button>
          ))}
        </View>
      </Card>
      <Card>
        <Text style={s.h2}>Confirm or correct the key</Text>
        <Text style={s.small}>
          Enter labels separated by commas, or a numerical value. Confirm only
          against a trusted source. The original attempt, response and key
          revision remain saved.
        </Text>
        <Field
          label="Verified answer key"
          value={keyValue}
          onChangeText={setKeyValue}
        />
        <Button
          kind="ghost"
          onPress={() =>
            safe(async () => {
              const values = keyValue
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean);
              const key = {
                values,
                confirmed: true,
                provenance: "manual" as const,
                tolerance: q.key?.tolerance ?? 0,
                updatedAt: Date.now(),
              };
              const checked = validateQuestion({ ...q, key });
              if (!values.length || checked.status !== "ready")
                throw Error("Enter a key that matches this question format.");
              await update((d) => ({
                ...d,
                keyRevisions: {
                  ...d.keyRevisions,
                  [q.id]: [
                    ...(d.keyRevisions[q.id] ?? (q.key ? [q.key] : [])),
                    key,
                  ],
                },
                reports: Object.fromEntries(
                  Object.entries({ ...d.reports, [id]: null }).map(
                    ([attemptId, report]) => [
                      attemptId,
                      d.attempts.some(
                        (attempt) =>
                          attempt.id === attemptId &&
                          attempt.questions.some(
                            (question) => question.id === q.id,
                          ),
                      )
                        ? {
                            kind: "deterministic",
                            reason:
                              "Key changed. Refresh AI interpretation using the updated metrics.",
                            insights: [],
                          }
                        : report,
                    ],
                  ),
                ),
              }));
              setKeyValue("");
            })
          }
        >
          Confirm key & recalculate
        </Button>
      </Card>
      <Button kind="lime" onPress={() => safe(() => reattempt(a, [q], update))}>
        Reattempt this question →
      </Button>
      <Button kind="ghost" onPress={() => router.push(`/analysis/${id}`)}>
        Back to analysis
      </Button>
    </Screen>
  );
}
export function DebugScreen() {
  const { data, update } = useStore();
  const [show, setShow] = useState(false);
  return (
    <Screen title="DEVELOPER DIAGNOSTICS">
      <Heading detail="Long-press the Attemply Lab footer on Home to open this screen.">
        Inspect the evidence.
      </Heading>
      <Card>
        <Text style={s.body}>
          {data.questions.length} questions · {data.ignored.length} ignored
          blocks · {data.pending.length} import jobs
        </Text>
        <Button
          kind="ghost"
          onPress={() =>
            safe(async () => {
              const picked = await DocumentPicker.getDocumentAsync({
                type: [
                  "application/zip",
                  "application/json",
                  "application/x-zip-compressed",
                ],
                copyToCacheDirectory: true,
              });
              if (picked.canceled) return;
              const asset = picked.assets[0];
              if (new File(asset.uri).size > 25 * 1024 * 1024)
                throw Error("Debug import limit is 25 MB.");
              const body = new FormData();
              body.append("file", {
                uri: asset.uri,
                name: asset.name,
                type: asset.mimeType ?? "application/zip",
              } as any);
              const result = await request("/v1/debug/import", {
                method: "POST",
                body,
              });
              const parsed = localizeImages(result.result as Parsed);
              await update((d) => ({
                ...d,
                questions: [...d.questions, ...parsed.questions],
                ignored: [...d.ignored, ...parsed.ignored],
                keys: result.keys,
                debug: result,
              }));
            })
          }
        >
          Import Mistral OCR JSON / ZIP
        </Button>
        <Text style={s.small}>
          ZIP layout: document/pages/page-N/markdown.md, page-metadata.json, and
          image files beside their page Markdown. Requires a paired backend; an
          OCR API key is not needed for debug imports.
        </Text>
        <Button kind="ghost" onPress={() => setShow((v) => !v)}>
          {show ? "Hide" : "Show"} raw OCR / normalized JSON
        </Button>
      </Card>
      {show && (
        <Card>
          <Text
            selectable
            style={{ fontFamily: "monospace", fontSize: 11, color: C.navy }}
          >
            {JSON.stringify(
              {
                latestImport: data.debug,
                questions: data.questions,
                ignored: data.ignored,
                pending: data.pending,
              },
              null,
              2,
            ).slice(0, 180000)}
          </Text>
          <Text style={s.small}>
            Display capped at 180,000 characters. Raw import remains in local
            storage. Session credentials are held separately in SecureStore.
          </Text>
        </Card>
      )}
      <Card>
        <Text style={s.h2}>Event log</Text>
        {data.attempts.map((a) => (
          <View key={a.id}>
            <Text style={s.h2}>{a.settings.title}</Text>
            <Text selectable style={s.small}>
              {JSON.stringify(a.events, null, 2)}
            </Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
