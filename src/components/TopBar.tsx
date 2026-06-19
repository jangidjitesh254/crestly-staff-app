/**
 * App-wide top bar matching the Crestly web ERP header.
 *
 * Left:  small dark brand mark + "Crestly." wordmark with orange period.
 * Right: a notification bell that opens the Notifications screen.
 *
 * Sign-out lives on the Profile tab now, so the bar carries no logout button.
 * Used on every screen instead of the navigator's default headers (those are
 * hidden in RootNavigator) so the brand surface stays consistent.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors, radius, space } from "../theme";

interface Props {
  /** Show a back chevron on the left in place of the brand mark. */
  showBack?: boolean;
  onBack?: () => void;
}

export function TopBar({ showBack, onBack }: Props) {
  // Generic navigation — the bell can be tapped from any tab/stack.
  const navigation = useNavigation<any>();

  function openNotifications() {
    // Opens the root-level Notifications screen directly over the current
    // screen — no detour through the Profile tab.
    navigation.navigate("Notifications");
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.bar}>
        {showBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={10}
            android_ripple={{ color: "rgba(16,13,10,0.08)", borderless: true }}
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={24} color={colors.ink} />
          </Pressable>
        ) : (
          <View style={styles.brand}>
            <View style={styles.mark}>
              <Text style={styles.markLetter}>C</Text>
              <View style={styles.markDot} />
            </View>
            <Text style={styles.wordmark}>
              Crestly<Text style={styles.wordmarkDot}>.</Text>
            </Text>
          </View>
        )}

        <Pressable
          onPress={openNotifications}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          android_ripple={{ color: "rgba(16,13,10,0.08)", borderless: true }}
          style={({ pressed }) => [styles.bellBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.ink} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    minHeight: 56,
  },

  /* Brand */
  brand: { flexDirection: "row", alignItems: "center", gap: space[2] },
  mark: {
    width: 36,
    height: 36,
    borderRadius: radius[3],
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  markLetter: {
    color: colors.white,
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -1,
  },
  markDot: {
    position: "absolute",
    width: 4,
    height: 4,
    backgroundColor: colors.orange,
    borderRadius: 2,
    bottom: 7,
    right: 7,
  },
  wordmark: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.5,
  },
  wordmarkDot: { color: colors.orange },

  /* Back */
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  /* Notification bell */
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
});
