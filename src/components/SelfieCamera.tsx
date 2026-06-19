/**
 * Full-screen modal camera using expo-camera's CameraView.
 *
 * Why not expo-image-picker.launchCameraAsync? It opens the system camera as
 * a separate Activity, which puts Expo Go in the background. Low-memory
 * Android devices then kill Expo Go to reclaim memory, restarting the app.
 *
 * CameraView renders in-process — Expo Go stays in the foreground the whole
 * time, so the OS has no reason to kill it.
 */
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { colors, fontSize, radius, space } from "../theme";

interface Props {
  visible: boolean;
  onCancel: () => void;
  onCapture: (uri: string) => void;
}

export function SelfieCamera({ visible, onCancel, onCapture }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState(false);
  const [ready, setReady] = useState(false);

  async function capture() {
    if (capturing) return;
    const ref = cameraRef.current;
    if (!ref) return;
    setCapturing(true);
    try {
      const photo = await ref.takePictureAsync({
        quality: 0.6,
        base64: false,
        exif: false,
        skipProcessing: true,
      });
      if (photo?.uri) {
        onCapture(photo.uri);
      }
    } finally {
      setCapturing(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.root}>
        {permission?.granted ? (
          <CameraView
            ref={cameraRef}
            facing="front"
            style={styles.camera}
            onCameraReady={() => setReady(true)}
          />
        ) : (
          <View style={styles.permGate}>
            <View style={styles.permIcon}>
              <Ionicons name="camera-outline" size={36} color={colors.cream} />
            </View>
            <Text style={styles.permTitle}>Camera access</Text>
            <Text style={styles.permBody}>
              {permission?.canAskAgain !== false
                ? "Tap below to allow Crestly Staff to use the camera for your check-in selfie."
                : "Camera permission is blocked. Open Settings to enable it for Crestly Staff."}
            </Text>
            <Pressable
              onPress={requestPermission}
              android_ripple={{ color: "rgba(245,239,227,0.2)" }}
              style={({ pressed }) => [styles.permBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.permBtnText}>Grant permission</Text>
            </Pressable>
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={onCancel}
            android_ripple={{ color: "rgba(245,239,227,0.2)", borderless: true }}
            style={styles.headerBtn}
          >
            <Ionicons name="close" size={24} color={colors.cream} />
          </Pressable>
          <Text style={styles.headerTitle}>Take selfie</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Bottom: shutter */}
        {permission?.granted ? (
          <View style={styles.footer}>
            <Text style={styles.hint}>
              Centre your face · tap the shutter
            </Text>
            <Pressable
              onPress={capture}
              disabled={!ready || capturing}
              android_ripple={{ color: "rgba(255,255,255,0.3)", borderless: true }}
              style={({ pressed }) => [
                styles.shutter,
                (pressed || capturing) && { transform: [{ scale: 0.94 }] },
                (!ready || capturing) && { opacity: 0.6 },
              ]}
            >
              {capturing ? (
                <ActivityIndicator color={colors.orange} />
              ) : (
                <View style={styles.shutterInner} />
              )}
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  camera: { ...StyleSheet.absoluteFillObject },

  /* Header */
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 44,
    paddingHorizontal: space[4],
    paddingBottom: space[3],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    color: colors.cream,
    fontSize: fontSize.bodyL,
    fontWeight: "800",
    letterSpacing: -0.2,
  },

  /* Footer / shutter */
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: space[5],
    paddingBottom: space[7],
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    gap: space[4],
  },
  hint: {
    color: "rgba(245,239,227,0.85)",
    fontSize: fontSize.bodyS,
    fontWeight: "600",
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: colors.cream,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.cream,
  },

  /* Permission gate */
  permGate: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    padding: space[5],
    gap: space[3],
  },
  permIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(245,239,227,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  permTitle: {
    color: colors.cream,
    fontSize: fontSize.displayS,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  permBody: {
    color: "rgba(245,239,227,0.7)",
    fontSize: fontSize.body,
    textAlign: "center",
    maxWidth: 320,
    lineHeight: 21,
  },
  permBtn: {
    marginTop: space[3],
    backgroundColor: colors.orange,
    borderRadius: radius[3],
    paddingHorizontal: space[5],
    paddingVertical: space[3],
  },
  permBtnText: {
    color: colors.white,
    fontWeight: "800",
    fontSize: fontSize.body,
  },
});
