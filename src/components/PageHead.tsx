/**
 * Page-level header used at the top of every screen body.
 *
 *   OVERVIEW · SUN 24 MAY 2026          ← mono breadcrumb, orange ·
 *   Hi, Kamlesh.                         ← big display title, orange period
 *   Teacher                              ← optional subtitle
 *
 * The orange period at the end of the title is the brand's signature accent.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fontSize, space } from "../theme";

interface Props {
  crumb: string;
  /** Right-hand part of the breadcrumb, e.g. "SUN 24 MAY 2026". */
  date?: string;
  title: string;
  subtitle?: string;
}

export function PageHead({ crumb, date, title, subtitle }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.crumbRow}>
        <Text style={styles.crumb}>{crumb.toUpperCase()}</Text>
        {date ? (
          <>
            <View style={styles.dot} />
            <Text style={styles.crumb}>{date.toUpperCase()}</Text>
          </>
        ) : null}
      </View>
      <Text style={styles.title}>
        {title}
        <Text style={styles.titleDot}>.</Text>
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  crumbRow: { flexDirection: "row", alignItems: "center", gap: space[2] },
  crumb: {
    fontSize: fontSize.label,
    fontWeight: "800",
    color: colors.orangeDeep,
    letterSpacing: 1.6,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.ink40,
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  titleDot: { color: colors.orange },
  subtitle: { fontSize: fontSize.bodyL, color: colors.ink60 },
});
