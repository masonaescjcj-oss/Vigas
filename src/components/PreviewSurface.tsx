/**
 * frontend/src/components/PreviewSurface.tsx
 * ---------------------------------------------------------------------------
 * Renders a built preview document on whichever platform we're running on:
 *
 *   web    → a sandboxed <iframe srcdoc>
 *   native → react-native-webview with the same HTML
 *
 * Both are browser engines, so the document produced by previewBuilder works
 * unchanged on either. Keeping the platform split in one component means the
 * screens never branch on Platform.OS for this.
 *
 * Scripts are allowed (the preview *is* the user's app running) but the surface
 * is otherwise locked down: no same-origin access on web, no navigation away
 * from the document on native, and no file/universal access.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { Platform, StyleSheet, View } from "react-native";

const RADIUS = 16;
const BACKGROUND = "#0f1115";

/** Web: an opaque-origin iframe, so preview code cannot reach the app's storage. */
const WebPreview = ({ html }: { html: string }) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { unstable_createElement } = require("react-native-web");
  return unstable_createElement("iframe", {
    srcDoc: html,
    sandbox: "allow-scripts allow-modals allow-forms allow-popups",
    style: {
      flex: 1,
      width: "100%",
      height: "100%",
      border: "0",
      borderRadius: RADIUS,
      backgroundColor: BACKGROUND,
    },
  });
};

/** Native: the same document inside a WebView. */
const NativePreview = ({ html }: { html: string }) => {
  // Required lazily so the web bundle never pulls in the native module.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { WebView } = require("react-native-webview");
  return (
    <WebView
      // baseUrl matters: without it, relative URLs and some APIs misbehave on Android.
      source={{ html, baseUrl: "about:blank" }}
      originWhitelist={["*"]}
      style={styles.webview}
      containerStyle={styles.webviewContainer}
      // The preview must run the user's JS, but nothing beyond the document.
      javaScriptEnabled
      domStorageEnabled={false}
      allowFileAccess={false}
      allowUniversalAccessFromFileURLs={false}
      setSupportMultipleWindows={false}
      // Keep the user inside the preview — links open nowhere rather than
      // navigating the WebView away from their app.
      onShouldStartLoadWithRequest={(request: { url: string }) =>
        request.url === "about:blank" || request.url.startsWith("data:")
      }
      // Match the app's dark canvas while the document loads.
      backgroundColor={BACKGROUND}
    />
  );
};

export const PreviewSurface = ({ html }: { html: string }) => (
  <View style={styles.frame}>
    {Platform.OS === "web" ? <WebPreview html={html} /> : <NativePreview html={html} />}
  </View>
);

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    borderRadius: RADIUS,
    overflow: "hidden",
    backgroundColor: BACKGROUND,
  },
  webview: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  webviewContainer: {
    flex: 1,
    borderRadius: RADIUS,
  },
});
