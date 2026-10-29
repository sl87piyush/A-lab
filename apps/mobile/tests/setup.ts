jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  },
  useLocalSearchParams: () => ({ id: "test-attempt" }),
  useFocusEffect: jest.fn(),
}));
jest.mock("expo-camera", () => ({
  CameraView: "CameraView",
  useCameraPermissions: () => [
    { granted: false },
    jest.fn(async () => ({ granted: false })),
  ],
}));
jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true })),
}));
jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(async () => ({ canceled: true })),
}));
jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: "jpeg" },
}));
jest.mock("expo-file-system", () => ({
  Directory: class {
    create() {}
  },
  File: class {
    size = 5;
    uri = "file://test";
    copy() {}
  },
  Paths: { document: "file://documents" },
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(),
}));
jest.mock("react-native-webview", () => ({ WebView: "WebView" }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
