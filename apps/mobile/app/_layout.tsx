import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider, useStore } from "../src/store";
import { Button, Card, Screen, s } from "../src/ui";
import { Text, View, ActivityIndicator } from "react-native";
function Routes() {
  const { ready, error, retry } = useStore();
  if (!ready)
    return (
      <Screen back={false}>
        <Card>
          {error ? (
            <>
              <Text style={s.error}>{error}</Text>
              <Button onPress={retry}>Retry opening saved data</Button>
            </>
          ) : (
            <ActivityIndicator />
          )}
        </Card>
      </Screen>
    );
  return (
    <View style={{ flex: 1 }}>
      {error && (
        <View style={{ padding: 12, backgroundColor: "#FBE8E1" }}>
          <Text style={s.error}>{error}</Text>
          <Button onPress={retry}>Retry saving</Button>
        </View>
      )}
      <Stack
        screenOptions={{ headerShown: false, animation: "slide_from_right" }}
      />
    </View>
  );
}
export default function Layout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Provider>
        <Routes />
      </Provider>
    </SafeAreaProvider>
  );
}
