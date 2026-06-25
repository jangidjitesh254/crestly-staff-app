/**
 * Global typography — Plus Jakarta Sans across the whole app.
 *
 * React Native has no "default font", and static custom fonts don't synthesise
 * weights, so we patch Text/TextInput to map each fontWeight in a style to the
 * matching Plus Jakarta Sans face. Every existing `fontWeight` keeps working.
 */
import React from "react";
import { StyleSheet, Text, TextInput } from "react-native";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";

export const fontAssets = {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
};

const FAMILY: Record<string, string> = {
  "100": "PlusJakartaSans_400Regular",
  "200": "PlusJakartaSans_400Regular",
  "300": "PlusJakartaSans_400Regular",
  "400": "PlusJakartaSans_400Regular",
  normal: "PlusJakartaSans_400Regular",
  "500": "PlusJakartaSans_500Medium",
  "600": "PlusJakartaSans_600SemiBold",
  "700": "PlusJakartaSans_700Bold",
  bold: "PlusJakartaSans_700Bold",
  "800": "PlusJakartaSans_800ExtraBold",
  "900": "PlusJakartaSans_800ExtraBold",
};

function familyFor(style: unknown): string {
  const flat = (StyleSheet.flatten(style as never) ?? {}) as { fontWeight?: string | number };
  const w = flat.fontWeight != null ? String(flat.fontWeight) : "400";
  return FAMILY[w] ?? FAMILY["400"];
}

let applied = false;

/** Patch Text + TextInput once so all text renders in Plus Jakarta Sans. */
export function applyGlobalFont(): void {
  if (applied) return;
  applied = true;

  for (const Comp of [Text, TextInput] as unknown as { render?: Function }[]) {
    const orig = Comp.render;
    if (typeof orig !== "function") continue;
    Comp.render = function patched(...args: unknown[]) {
      const el = orig.apply(this, args) as React.ReactElement<{ style?: unknown }>;
      return React.cloneElement(el, {
        style: [{ fontFamily: familyFor(el.props.style) }, el.props.style],
      });
    };
  }
}
