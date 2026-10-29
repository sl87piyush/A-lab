import React, { useState } from "react";
import {
  ActivityIndicator,
  useWindowDimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { WebView } from "react-native-webview";
import katex from "katex";
import type { Question } from "@attemply/shared";
export const C = {
  navy: "#172633",
  lime: "#D9F94B",
  bg: "#F7F8F5",
  white: "#FFFFFF",
  muted: "#68766F",
  line: "#E2E7DF",
  red: "#A93D35",
  amber: "#8B5D19",
  soft: "#EEF2E8",
};
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: {
    padding: 22,
    gap: 18,
    paddingBottom: 40,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 22,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: C.navy,
    letterSpacing: -1,
    lineHeight: 38,
  },
  h2: { fontSize: 21, fontWeight: "700", color: C.navy, letterSpacing: -0.5 },
  body: { fontSize: 16, lineHeight: 24, color: C.navy },
  small: { fontSize: 13, lineHeight: 19, color: C.muted },
  label: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
    color: C.muted,
  },
  button: {
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 13,
    backgroundColor: C.navy,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  buttonText: { fontSize: 15, fontWeight: "700", color: C.white },
  field: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    padding: 14,
    color: C.navy,
    fontSize: 16,
    minHeight: 48,
  },
  pill: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: C.soft,
  },
  error: { color: C.red, fontSize: 14, lineHeight: 21 },
  divider: { height: 1, backgroundColor: C.line },
  stat: { fontSize: 30, fontWeight: "800", color: C.navy },
  option: {
    borderWidth: 1.5,
    borderColor: C.line,
    borderRadius: 15,
    padding: 16,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  selected: { backgroundColor: "#F4FBD7", borderColor: C.navy },
});
export function Screen({
  children,
  title,
  back = true,
  footer,
}: {
  children: React.ReactNode;
  title?: string;
  back?: boolean;
  footer?: React.ReactNode;
}) {
  return (
    <SafeAreaView style={s.screen}>
      <View
        style={[
          s.between,
          { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 12 },
        ]}
      >
        {back ? (
          <Pressable
            accessibilityLabel="Back"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/")
            }
            style={{ padding: 8 }}
          >
            <Ionicons name="arrow-back" size={23} color={C.navy} />
          </Pressable>
        ) : (
          <Text style={[s.h2, { letterSpacing: -1 }]}>
            attemply
            <Text style={{ color: C.muted, fontWeight: "400" }}> / lab</Text>
          </Text>
        )}
        <Text style={[s.label, { flexShrink: 1, textAlign: "right" }]}>
          {title ?? "YOUR PRACTICE, REBUILT"}
        </Text>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        {children}
      </ScrollView>
      {footer && (
        <View
          style={{
            padding: 16,
            borderTopWidth: 1,
            borderColor: C.line,
            backgroundColor: C.white,
          }}
        >
          {footer}
        </View>
      )}
    </SafeAreaView>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function Button({
  children,
  onPress,
  kind = "primary",
  icon,
  disabled = false,
}: {
  children: React.ReactNode;
  onPress: () => void;
  kind?: "primary" | "lime" | "ghost" | "danger";
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const light = kind === "lime" || kind === "ghost";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={() => {
        setBusy(true);
        Promise.resolve(onPress())
          .catch(() => {})
          .finally(() => setBusy(false));
      }}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor:
            kind === "lime"
              ? C.lime
              : kind === "ghost"
                ? C.soft
                : kind === "danger"
                  ? C.red
                  : C.navy,
          opacity: disabled || busy ? 0.5 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={light ? C.navy : C.white} />
      ) : (
        icon && (
          <Ionicons name={icon} size={19} color={light ? C.navy : C.white} />
        )
      )}
      <Text style={[s.buttonText, light && { color: C.navy }]}>{children}</Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={s.small}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={C.muted}
        style={[
          s.field,
          props.multiline && { minHeight: 100, textAlignVertical: "top" },
        ]}
        {...props}
      />
    </View>
  );
}
export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.pill}>
      <Text style={[s.small, { fontWeight: "700" }]}>{children}</Text>
    </View>
  );
}
export function Heading({
  eyebrow,
  children,
  detail,
}: {
  eyebrow?: string;
  children: React.ReactNode;
  detail?: string;
}) {
  return (
    <View style={{ gap: 10 }}>
      {eyebrow && <Text style={s.label}>{eyebrow}</Text>}
      <Text style={s.title}>{children}</Text>
      {detail && <Text style={s.body}>{detail}</Text>}
    </View>
  );
}
function RichTextContent({ text }: { text: string }) {
  const [height, setHeight] = useState(48);
  const [failed, setFailed] = useState(false);
  if (!/[\$]|\\\(|\\\[/.test(text))
    return (
      <Text selectable style={s.body}>
        {text}
      </Text>
    );
  let warning = false;
  const escape = (v: string) =>
    v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let html = "";
  let last = 0;
  const pattern =
    /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)/g;
  for (const match of text.matchAll(pattern)) {
    html += escape(text.slice(last, match.index));
    try {
      html += katex.renderToString(
        match[1] ?? match[2] ?? match[3] ?? match[4],
        {
          displayMode: Boolean(match[1] ?? match[3]),
          throwOnError: true,
          trust: false,
          strict: "warn",
          output: "mathml",
        },
      );
    } catch {
      warning = true;
      html += escape(match[0]);
    }
    last = (match.index ?? 0) + match[0].length;
  }
  html += escape(text.slice(last));
  if (failed)
    return (
      <View>
        <Text style={s.error}>
          Equation renderer unavailable. Check the original source.
        </Text>
        <Text selectable style={s.body}>
          {text}
        </Text>
      </View>
    );
  const document = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=3"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'"><style>body{font-family:-apple-system, sans-serif;font-size:17px;line-height:1.65;color:${C.navy};margin:0;white-space:pre-wrap;overflow-wrap:anywhere}math{font-size:1.12em}math[display=block]{overflow-x:auto;padding:8px 0}</style></head><body>${html}<script>const send=()=>window.ReactNativeWebView.postMessage(String(Math.ceil(document.body.getBoundingClientRect().height)));new ResizeObserver(send).observe(document.body);send();</script></body></html>`;
  return (
    <View>
      {warning && (
        <Text style={s.error}>
          Equation needs correction. Compare with the original source.
        </Text>
      )}
      <WebView
        originWhitelist={["about:blank"]}
        source={{ html: document, baseUrl: "about:blank" }}
        style={{ height: Math.max(48, height), backgroundColor: "transparent" }}
        scrollEnabled={false}
        javaScriptEnabled
        allowFileAccess={false}
        onError={() => setFailed(true)}
        onShouldStartLoadWithRequest={(r) => r.url === "about:blank"}
        onMessage={(e) => {
          const n = Number(e.nativeEvent.data);
          if (Number.isFinite(n) && n > 0) setHeight(Math.min(n + 8, 8000));
        }}
      />
    </View>
  );
}
export const RichText = React.memo(RichTextContent);
export function ZoomImage({
  uri,
  label = "View source image",
}: {
  uri: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false),
    [bad, setBad] = useState(false),
    [scale, setScale] = useState(1);
  const dimensions = useWindowDimensions();
  const source =
    uri === "demo:triangle" ? require("../assets/triangle.png") : { uri };
  return (
    <>
      <Pressable accessibilityLabel={label} onPress={() => setOpen(true)}>
        <Image
          source={source}
          style={{
            width: "100%",
            height: 190,
            borderRadius: 12,
            backgroundColor: C.soft,
          }}
          resizeMode="contain"
          onError={() => setBad(true)}
        />
        <Text style={bad ? s.error : s.small}>
          {bad
            ? "Image unavailable. Reopen the original source."
            : label + " ↗"}
        </Text>
      </Pressable>
      <Modal
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={s.screen}>
          <Button onPress={() => setOpen(false)}>Close image</Button>
          <View style={[s.row, { padding: 12 }]}>
            <Button
              kind="ghost"
              onPress={() => setScale((v) => Math.max(1, v - 0.5))}
            >
              Zoom −
            </Button>
            <Text style={s.small}>{Math.round(scale * 100)}%</Text>
            <Button
              kind="ghost"
              onPress={() => setScale((v) => Math.min(5, v + 0.5))}
            >
              Zoom +
            </Button>
          </View>
          <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
            <ScrollView maximumZoomScale={5} minimumZoomScale={1}>
              <Image
                source={source}
                style={{
                  width: dimensions.width * scale,
                  height: Math.max(300, dimensions.height - 200) * scale,
                }}
                resizeMode="contain"
              />
            </ScrollView>
          </ScrollView>
          <Text style={[s.small, { padding: 16 }]}>
            Use Zoom + / −, then scroll to inspect the image. iPhone also
            supports pinch to zoom.
          </Text>
        </SafeAreaView>
      </Modal>
    </>
  );
}
export function QuestionBody({ question }: { question: Question }) {
  return (
    <View style={{ gap: 16 }}>
      <RichText text={question.text} />
      {question.images.map((im) => (
        <ZoomImage key={im.id} uri={im.uri} label="Zoom diagram" />
      ))}
    </View>
  );
}
export function formatTime(ms: number) {
  const n = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${(n % 60).toString().padStart(2, "0")}`;
}
