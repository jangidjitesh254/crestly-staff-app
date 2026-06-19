/**
 * Sky-tinted information card used for empty/explainer states.
 *
 *   (i)  Bold lead. Body text describing what's happening, with
 *        `inline mono` for code-like references such as `Classes → Edit
 *        section.`
 *
 * Matches the web ERP's empty-state pattern.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontSize, radius, space, tints } from "../theme";

interface Props {
  lead: string;
  body: string;
  /** Optional inline mono code shown as a hint after the body, e.g. "Classes → Edit section". */
  hint?: string;
  variant?: "info" | "warn" | "success";
}

const VARIANTS = {
  info: {
    bg: tints.sky.base,
    accent: tints.sky.deep,
    icon: "information-circle-outline" as const,
  },
  warn: {
    bg: colors.warnSoft,
    accent: colors.warn,
    icon: "alert-circle-outline" as const,
  },
  success: {
    bg: tints.mint.base,
    accent: tints.mint.deep,
    icon: "checkmark-circle-outline" as const,
  },
};

export function InfoCard({ lead, body, hint, variant = "info" }: Props) {
  const v = VARIANTS[variant];
  return (
    <View style={[styles.card, { backgroundColor: v.bg }]}>
      <Ionicons name={v.icon} size={22} color={v.accent} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.body}>
          <Text style={styles.lead}>{lead}</Text>
          {body ? " " + body : ""}
        </Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: space[3],
    padding: space[4],
    borderRadius: radius[4],
  },
  body: {
    fontSize: fontSize.body,
    color: colors.ink80,
    lineHeight: 20,
  },
  lead: { fontWeight: "800", color: colors.ink },
  hint: {
    fontSize: fontSize.bodyS,
    color: colors.ink80,
    fontFamily: undefined,
    letterSpacing: 0.2,
  },
});
