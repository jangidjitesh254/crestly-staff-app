/**
 * "Update the app" helper — opens the store listing so the user can pull the
 * latest build. Android is the primary target (the app is distributed via the
 * Play Store as `in.crestly.staff`); iOS falls back to an App Store search.
 *
 * Uses React Native's built-in Linking (no extra dependency). `market://` /
 * `itms-apps://` open the store app directly when installed; we fall back to
 * the https listing if the scheme can't be handled (e.g. emulator, web).
 */
import { Linking, Platform } from "react-native";
import Constants from "expo-constants";

/** Play Store application id — must match app.json android.package. */
const ANDROID_PACKAGE = "in.crestly.staff";
/** App display name, used for the iOS App Store fallback search. */
const APP_NAME = "Crestly Staff";

/** Current installed version, e.g. "1.0.0". */
export function appVersion(): string {
  return (
    Constants.expoConfig?.version ??
    (Constants.expoConfig?.extra?.appVersion as string | undefined) ??
    "1.0.0"
  );
}

async function open(primary: string, fallback: string): Promise<void> {
  try {
    const ok = await Linking.canOpenURL(primary);
    await Linking.openURL(ok ? primary : fallback);
  } catch {
    try {
      await Linking.openURL(fallback);
    } catch {
      // Nothing else we can do — the caller surfaces a generic message.
    }
  }
}

/** Open the store page for this app so the user can update to the latest build. */
export async function openAppUpdate(): Promise<void> {
  if (Platform.OS === "android") {
    await open(
      `market://details?id=${ANDROID_PACKAGE}`,
      `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
    );
    return;
  }
  const q = encodeURIComponent(APP_NAME);
  await open(`itms-apps://itunes.apple.com/search?term=${q}`, `https://apps.apple.com/search?term=${q}`);
}
