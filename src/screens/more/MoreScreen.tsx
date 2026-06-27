/**
 * Profile tab — a dark identity hero (centred avatar + quick-action tiles),
 * a collapsible "My details" card, a menu list and sign-out. Mirrors the
 * Parents app profile.
 */
import React, { useState } from "react";
import {
  Alert, Image, LayoutAnimation, Linking, Platform, Pressable,
  StyleSheet, Text, UIManager, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../../store/auth";
import { FadeInView, Screen } from "../../components/ui";
import { appVersion, openAppUpdate } from "../../lib/appUpdate";
import { colors, fontSize, radius, shadow, space, tints } from "../../theme";
import type { MoreStackParams } from "../../navigation/types";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
const EXPAND_ANIM = LayoutAnimation.create(240, "easeInEaseOut", "opacity");

type Props = NativeStackScreenProps<MoreStackParams, "MoreHome">;
type Tint = { base: string; deep: string };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

export function MoreScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const hasPerm = (p: string) => Boolean(user?.permissions.includes(p));

  const name = user?.name ?? "Staff member";
  const role = user?.roleName ?? user?.roleSlug ?? "Staff";
  const subLine = [role, user?.schoolName].filter(Boolean).join("  ·  ");

  const [open, setOpen] = useState(false);
  function toggleDetails() {
    LayoutAnimation.configureNext(EXPAND_ANIM);
    setOpen((v) => !v);
  }

  function confirmSignOut() {
    Alert.alert("Logout?", "You'll need to enter your phone & password again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: () => void signOut() },
    ]);
  }
  function openNotifications() {
    navigation.navigate("Notifications" as never);
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.root}>
      <Screen>
        {/* Hero */}
        <FadeInView delay={0}>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>My Profile</Text>

            <View style={styles.heroCenter}>
              <View style={styles.avi}>
                <Image source={require("../../../assets/avatar-dummy.png")} style={styles.aviImg} />
                <View style={styles.aviBadge}>
                  <Ionicons name="checkmark" size={12} color={colors.white} />
                </View>
              </View>
              <Text style={styles.name} numberOfLines={1}>{name}</Text>
              <Text style={styles.handle} numberOfLines={1}>{subLine}</Text>
            </View>

            <View style={styles.tilesRow}>
              <HeroTile icon="notifications-outline" label="Notifications" onPress={openNotifications} />
              <HeroTile icon="briefcase-outline" label="Leaves" onPress={() => navigation.navigate("LeavesList")} />
              <HeroTile icon="wallet-outline" label="Salary" onPress={() => navigation.navigate("Salary")} />
            </View>
          </View>
        </FadeInView>

        {/* My details (collapsible) */}
        <FadeInView delay={60}>
          <View style={styles.detailCard}>
            <Pressable style={styles.detailHead} onPress={toggleDetails} android_ripple={{ color: "rgba(16,13,10,0.06)" }}>
              <View style={styles.detailAvi}>
                <Text style={styles.detailAviText}>{initials(name)}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.detailName} numberOfLines={1}>{name}</Text>
                <Text style={styles.detailSub} numberOfLines={1}>{role}</Text>
              </View>
              <View style={styles.chev}>
                <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.ink60} />
              </View>
            </Pressable>

            {open ? (
              <View style={styles.detailBody}>
                <View style={styles.factGrid}>
                  <Fact icon="call-outline" tint={tints.mint} label="Phone" value={user?.phone ?? "—"} onPress={user?.phone ? () => Linking.openURL(`tel:${user.phone}`).catch(() => undefined) : undefined} />
                  <Fact icon="mail-outline" tint={tints.sky} label="Email" value={user?.email ?? "—"} onPress={user?.email ? () => Linking.openURL(`mailto:${user.email}`).catch(() => undefined) : undefined} />
                  <Fact icon="business-outline" tint={tints.peach} label="School" value={user?.schoolName ?? "—"} />
                  <Fact icon="id-card-outline" tint={tints.wheat} label="Staff ID" value={user ? `#${user.id}` : "—"} />
                </View>
              </View>
            ) : null}
          </View>
        </FadeInView>

        {/* Menu */}
        <FadeInView delay={120}>
          <View style={styles.menu}>
            <MenuRow
              icon="calendar-outline"
              label="School Calendar"
              sub="Events, holidays & exams"
              onPress={() => navigation.navigate("Calendar")}
            />
            <MenuRow
              icon="document-text-outline"
              label="Tests"
              sub="Create, publish & grade tests"
              onPress={() => navigation.navigate("Tests")}
            />
            {hasPerm("diary.log") ? (
              <MenuRow
                icon="book-outline"
                label="Diary & Homework"
                sub="Log what was taught + homework"
                onPress={() => navigation.navigate("Diary")}
              />
            ) : null}
            <MenuRow
              icon="calendar-clear-outline"
              label="Holidays"
              sub="School holiday calendar"
              onPress={() => navigation.navigate("Holidays")}
            />
            {hasPerm("exams.view") ? (
              <MenuRow
                icon="school-outline"
                label="Exams"
                sub="Exam schedule & marks"
                onPress={() => navigation.navigate("Exams")}
              />
            ) : null}
            <MenuRow
              icon="cloud-download-outline"
              label="Update app"
              sub={`Get the latest version · v${appVersion()}`}
              onPress={() => void openAppUpdate()}
            />
            <MenuRow
              icon="log-out-outline"
              label="Logout"
              sub="End this session on this device"
              danger
              onPress={confirmSignOut}
              last
            />
          </View>
        </FadeInView>
      </Screen>
    </SafeAreaView>
  );
}

function HeroTile({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(255,255,255,0.12)" }}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]}
    >
      <Ionicons name={icon} size={20} color={colors.white} />
      <Text style={styles.tileLabel}>{label}</Text>
    </Pressable>
  );
}

function Fact({
  icon,
  tint,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: Tint;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      android_ripple={onPress ? { color: "rgba(16,13,10,0.05)" } : undefined}
      style={styles.fact}
    >
      <View style={[styles.factIcon, { backgroundColor: tint.base }]}>
        <Ionicons name={icon} size={15} color={tint.deep} />
      </View>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue} numberOfLines={1}>{value}</Text>
    </Pressable>
  );
}

function MenuRow({
  icon,
  label,
  sub,
  onPress,
  danger,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  const fg = danger ? colors.error : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      android_ripple={onPress ? { color: "rgba(16,13,10,0.06)" } : undefined}
      style={({ pressed }) => [
        styles.mRow,
        !last && styles.mBorder,
        pressed && onPress && { backgroundColor: "#F4F3F0" },
      ]}
    >
      <View style={[styles.mIcon, danger && { backgroundColor: colors.errorSoft }]}>
        <Ionicons name={icon} size={18} color={danger ? colors.error : colors.ink80} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.mLabel, { color: fg }]} numberOfLines={1}>{label}</Text>
        {sub ? <Text style={styles.mSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {onPress ? (
        <Ionicons name="chevron-forward" size={18} color={danger ? colors.error : colors.ink40} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },

  /* Hero — dark identity card */
  hero: {
    backgroundColor: colors.ink,
    borderRadius: 28,
    padding: space[5],
    overflow: "hidden",
  },
  heroTitle: { textAlign: "center", color: colors.white, fontSize: fontSize.bodyL, fontWeight: "800", letterSpacing: -0.2 },
  heroCenter: { alignItems: "center", marginTop: space[4] },
  avi: {
    width: 92, height: 92, borderRadius: 46,
    backgroundColor: "#E7DFD2",
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "rgba(255,255,255,0.16)",
  },
  aviImg: { width: 86, height: 86, borderRadius: 43 },
  aviBadge: {
    position: "absolute", right: 2, bottom: 2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: tints.mint.deep,
    borderWidth: 3, borderColor: colors.ink,
    alignItems: "center", justifyContent: "center",
  },
  name: { fontSize: fontSize.displayS, fontWeight: "800", color: colors.white, marginTop: space[3], letterSpacing: -0.3 },
  handle: { fontSize: fontSize.bodyS, color: "rgba(255,255,255,0.6)", marginTop: 4, fontWeight: "600" },

  tilesRow: { flexDirection: "row", gap: space[3], marginTop: space[5] },
  tile: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 16,
    paddingVertical: space[3],
    alignItems: "center",
    gap: 7,
  },
  tileLabel: { color: "rgba(255,255,255,0.92)", fontSize: 11, fontWeight: "700" },

  /* Detail card */
  detailCard: {
    backgroundColor: colors.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.rule,
    overflow: "hidden",
    ...shadow.card,
  },
  detailHead: { flexDirection: "row", alignItems: "center", gap: space[3], padding: space[4] },
  detailAvi: {
    width: 48, height: 48, borderRadius: radius[4],
    backgroundColor: colors.orange,
    alignItems: "center", justifyContent: "center",
  },
  detailAviText: { color: colors.white, fontSize: 18, fontWeight: "800" },
  detailName: { fontSize: fontSize.h1, fontWeight: "800", color: colors.ink, letterSpacing: -0.3 },
  detailSub: { fontSize: fontSize.bodyS, color: colors.ink60, marginTop: 2, fontWeight: "600" },
  chev: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#F4F3F0",
    alignItems: "center", justifyContent: "center",
  },

  detailBody: {
    paddingHorizontal: space[4],
    paddingBottom: space[4],
    borderTopWidth: 1,
    borderTopColor: colors.ruleSoft,
    paddingTop: space[4],
  },
  factGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: space[2] },
  fact: {
    width: "48.5%",
    backgroundColor: "#F4F3F0",
    borderRadius: 16,
    padding: space[4],
    gap: 9,
  },
  factIcon: {
    width: 34, height: 34, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
  },
  factLabel: { fontSize: 9.5, fontWeight: "800", color: colors.ink40, letterSpacing: 0.8, textTransform: "uppercase" },
  factValue: { fontSize: 15, fontWeight: "800", color: colors.ink, letterSpacing: -0.2 },

  /* Menu */
  menu: {
    backgroundColor: colors.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.rule,
    overflow: "hidden",
    ...shadow.card,
  },
  mRow: { flexDirection: "row", alignItems: "center", gap: space[3], padding: space[4] },
  mBorder: { borderBottomWidth: 1, borderBottomColor: colors.ruleSoft },
  mIcon: {
    width: 38, height: 38, borderRadius: radius[4],
    backgroundColor: "#F4F3F0",
    alignItems: "center", justifyContent: "center",
  },
  mLabel: { fontSize: fontSize.body, fontWeight: "800" },
  mSub: { fontSize: fontSize.bodyS, color: colors.ink60, marginTop: 2 },
});
