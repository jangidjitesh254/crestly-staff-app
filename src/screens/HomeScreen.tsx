/**
 * Staff home — a friendly, interactive dashboard (mirrors the Parents app).
 *
 *   greeting → Crestly brand banner → quick-access grid (navigates to the
 *   other tabs / screens) → today's punch status → leave stats.
 */
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { MaterialTopTabScreenProps } from "@react-navigation/material-top-tabs";
import { useAuth } from "../store/auth";
import { useLeaves, useMyPunches } from "../hooks/queries";
import { isForbidden } from "../lib/api";
import { FadeInView, Screen } from "../components/ui";
import { todayIso } from "../lib/dates";
import { colors, fontSize, radius, shadow, space, tints } from "../theme";
import type { MainTabParams } from "../navigation/types";

type Props = MaterialTopTabScreenProps<MainTabParams, "Home">;

function clockTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function todayLabel(): string {
  return new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
}

interface ActionItem {
  key: string;
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: { base: string; deep: string };
  go: () => void;
}

export function HomeScreen({ navigation }: Props) {
  const { user, hasPerm } = useAuth();
  const firstName = user?.name?.split(" ")[0] ?? null;
  const role = user?.roleName ?? user?.roleSlug ?? "Staff";
  const today = todayIso();
  const myPunches = useMyPunches(user?.id ?? 0, today);
  const leaves = useLeaves();

  const punchesItems = myPunches.data?.items ?? [];
  const lastPunch = punchesItems.length > 0 ? punchesItems[0] : null;
  const punchHistoryBlocked = !!myPunches.error && isForbidden(myPunches.error);
  const pendingLeaves = leaves.data?.pendingCount ?? 0;
  const leaveDaysLeft = (leaves.data?.balances ?? []).reduce((s, b) => s + b.left, 0);

  const actions: ActionItem[] = [
    hasPerm("attendance.view") && {
      key: "att", label: "Attendance", sub: "Class register",
      icon: "checkbox-outline", tint: tints.mint,
      go: () => navigation.navigate("Attendance"),
    },
    hasPerm("staff.punch") && {
      key: "punch", label: "Punch", sub: "In / out",
      icon: "time-outline", tint: tints.sky,
      go: () => navigation.navigate("Punch"),
    },
    {
      key: "tt", label: "Timetable", sub: "Your schedule",
      icon: "grid-outline", tint: tints.peach,
      go: () => navigation.navigate("Timetable"),
    },
    {
      key: "leave", label: "Leaves", sub: "Apply & track",
      icon: "calendar-outline", tint: tints.wheat,
      go: () => navigation.navigate("Profile", { screen: "LeavesList" } as never),
    },
    {
      key: "salary", label: "Salary", sub: "Payslips",
      icon: "wallet-outline", tint: tints.rose,
      go: () => navigation.navigate("Profile", { screen: "Salary" } as never),
    },
    {
      key: "exams", label: "Exams", sub: "Schedule & marks",
      icon: "school-outline", tint: tints.mustard,
      go: () => navigation.navigate("Profile", { screen: "Exams" } as never),
    },
  ].filter(Boolean) as ActionItem[];

  return (
    <SafeAreaView edges={["top"]} style={styles.root}>
      <Screen>
        {/* Top zone — brand + greeting */}
        <FadeInView delay={0}>
          <View style={styles.topRow}>
            <Image source={require("../../assets/icon.png")} style={styles.brandCoin} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.brandName}>Crestly</Text>
              <Text style={styles.portalTag}>Staff Portal</Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate("Notifications" as never)}
              android_ripple={{ color: "rgba(16,13,10,0.10)", borderless: true }}
              style={styles.bellBtn}
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={20} color={colors.ink} />
            </Pressable>
          </View>

          <Text style={styles.greetHi} numberOfLines={1}>
            {firstName ? `Namaste, ${firstName} Ji` : "Namaste"}  🙏
          </Text>
          <Text style={styles.greetDate}>{todayLabel()}  ·  {role}</Text>
        </FadeInView>

        {/* Crestly brand banner */}
        <FadeInView delay={50}>
          <View style={styles.banner}>
            <View style={styles.bannerBlobA} />
            <View style={styles.bannerBlobB} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.bannerKicker}>WELCOME TO</Text>
              <Text style={styles.bannerTitle}>
                Crestly<Text style={styles.bannerDot}>.</Text>
              </Text>
              <Text style={styles.bannerSub}>
                Your school day — attendance, punch, timetable & salary, all in one place.
              </Text>
            </View>
            <View style={styles.bannerBadge}>
              <Image source={require("../../assets/icon.png")} style={styles.bannerBadgeImg} />
            </View>
          </View>
        </FadeInView>

        {/* Quick access */}
        <FadeInView delay={90}>
          <Text style={styles.sectionTitle}>Quick access</Text>
          <View style={styles.grid}>
            {actions.map((a) => (
              <Pressable
                key={a.key}
                onPress={a.go}
                android_ripple={{ color: "rgba(16,13,10,0.06)" }}
                style={({ pressed }) => [
                  styles.action,
                  { backgroundColor: a.tint.base },
                  pressed && { opacity: 0.9 },
                ]}
              >
                <View style={styles.actionIcon}>
                  <Ionicons name={a.icon} size={20} color={a.tint.deep} />
                </View>
                <Text style={[styles.actionLabel, { color: a.tint.deep }]}>{a.label}</Text>
                <Text style={styles.actionSub}>{a.sub}</Text>
              </Pressable>
            ))}
          </View>
        </FadeInView>

        {/* Leave stats */}
        <FadeInView delay={180}>
          <View style={styles.statsRow}>
            <StatTile label="Pending Leaves" value={pendingLeaves} icon="time-outline" tint={tints.mustard} />
            <StatTile label="Leave Days Left" value={leaveDaysLeft} icon="calendar-outline" tint={tints.mint} />
          </View>
        </FadeInView>
      </Screen>
    </SafeAreaView>
  );
}

/* ---------------------------------------------------------------- pieces */

function StatusCard({
  lastPunch,
  blocked,
  onAction,
}: {
  lastPunch: { punchType: "in" | "out"; punchedAt: string; isOutside: boolean } | null;
  blocked: boolean;
  onAction: () => void;
}) {
  if (blocked) {
    return (
      <View style={[styles.statusCard, { backgroundColor: tints.sky.base }]}>
        <Text style={[styles.statusLabel, { color: tints.sky.deep }]}>TODAY</Text>
        <Text style={styles.statusTitle}>Ready to check in</Text>
        <Text style={styles.statusHint}>Tap below to record your location + selfie.</Text>
        <PressBtn label="Punch In / Out" onPress={onAction} />
      </View>
    );
  }
  if (lastPunch?.punchType === "in") {
    return (
      <View style={[styles.statusCard, { backgroundColor: tints.mint.base }]}>
        <View style={styles.statusHead}>
          <View style={styles.statusDot}>
            <Ionicons name="checkmark" size={14} color={colors.white} />
          </View>
          <Text style={[styles.statusLabel, { color: tints.mint.deep }]}>CHECKED IN</Text>
        </View>
        <Text style={styles.statusTitle}>Since {clockTime(lastPunch.punchedAt)}</Text>
        <Text style={styles.statusHint}>
          {lastPunch.isOutside ? "Marked outside the campus geofence." : "On campus."}
        </Text>
        <PressBtn label="Punch Out" onPress={onAction} variant="secondary" />
      </View>
    );
  }
  if (lastPunch?.punchType === "out") {
    return (
      <View style={[styles.statusCard, { backgroundColor: tints.peach.base }]}>
        <Text style={[styles.statusLabel, { color: tints.peach.deep }]}>TODAY</Text>
        <Text style={styles.statusTitle}>Punched out at {clockTime(lastPunch.punchedAt)}</Text>
        <Text style={styles.statusHint}>Tap below if you need to punch in again.</Text>
        <PressBtn label="Punch In Again" onPress={onAction} variant="secondary" />
      </View>
    );
  }
  return (
    <View style={[styles.statusCard, { backgroundColor: tints.wheat.base }]}>
      <Text style={[styles.statusLabel, { color: tints.wheat.deep }]}>TODAY</Text>
      <Text style={styles.statusTitle}>You haven't punched in yet</Text>
      <Text style={styles.statusHint}>Capture your location + selfie to start your day.</Text>
      <PressBtn label="Punch In Now" onPress={onAction} />
    </View>
  );
}

function PressBtn({
  label,
  onPress,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(245,239,227,0.2)" }}
      style={({ pressed }) => [
        styles.btn,
        variant === "secondary" && styles.btnSecondary,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.btnLabel, variant === "secondary" && styles.btnLabelSecondary]}>
        {label}
      </Text>
    </Pressable>
  );
}

function StatTile({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  tint: { base: string; deep: string };
}) {
  return (
    <View style={styles.statTile}>
      <View style={[styles.statIcon, { backgroundColor: tint.base }]}>
        <Ionicons name={icon} size={18} color={tint.deep} />
      </View>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },

  /* Top row */
  topRow: { flexDirection: "row", alignItems: "center", gap: space[3], marginBottom: space[5] },
  brandCoin: { width: 40, height: 40, borderRadius: 20 },
  brandName: { fontSize: 15, fontWeight: "800", color: colors.ink, letterSpacing: -0.2 },
  portalTag: { fontSize: 11, fontWeight: "700", color: colors.orangeDeep, letterSpacing: 0.2, marginTop: 1 },
  bellBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#F4F3F0",
    borderWidth: 1, borderColor: colors.rule,
    alignItems: "center", justifyContent: "center",
  },

  /* Greeting */
  greetHi: { fontSize: 25, fontWeight: "900", color: colors.ink, letterSpacing: -0.7 },
  greetDate: { fontSize: fontSize.bodyS, color: colors.ink60, marginTop: 4, fontWeight: "600" },

  /* Banner — premium dark */
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    backgroundColor: colors.ink,
    borderRadius: 24,
    padding: space[5],
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 5,
  },
  bannerBlobA: {
    position: "absolute", width: 160, height: 160, borderRadius: 80,
    backgroundColor: "rgba(242,92,25,0.20)", right: -44, top: -54,
  },
  bannerBlobB: {
    position: "absolute", width: 96, height: 96, borderRadius: 48,
    backgroundColor: "rgba(242,92,25,0.12)", right: 56, bottom: -44,
  },
  bannerKicker: { fontSize: 10, fontWeight: "900", color: colors.orangeSoft, letterSpacing: 1.8 },
  bannerTitle: { fontSize: 25, fontWeight: "900", color: colors.white, letterSpacing: -0.6, marginTop: 3 },
  bannerDot: { color: colors.orange },
  bannerSub: { fontSize: 12.5, color: "rgba(255,255,255,0.66)", lineHeight: 18, marginTop: 7 },
  bannerBadge: {
    width: 56, height: 56,
    borderRadius: 17,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerBadgeImg: { width: 40, height: 40, borderRadius: 11 },

  /* Section title */
  sectionTitle: {
    fontSize: fontSize.h2, fontWeight: "800", color: colors.ink,
    letterSpacing: -0.3, marginTop: space[2], marginBottom: space[3],
  },

  /* Quick access grid */
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: space[3] },
  action: { width: "48%", borderRadius: 18, paddingHorizontal: space[4], paddingVertical: space[3] },
  actionIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.6)",
    alignItems: "center", justifyContent: "center",
    marginBottom: 10,
  },
  actionLabel: { fontSize: fontSize.body, fontWeight: "800" },
  actionSub: { fontSize: fontSize.bodyS, color: colors.ink60, marginTop: 1 },

  /* Status card */
  statusCard: {
    borderRadius: 22,
    padding: space[4],
    gap: space[2],
    borderWidth: 1,
    borderColor: "rgba(16,13,10,0.06)",
  },
  statusHead: { flexDirection: "row", alignItems: "center", gap: space[2] },
  statusDot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.success,
    alignItems: "center", justifyContent: "center",
  },
  statusLabel: { fontSize: fontSize.label, fontWeight: "800", letterSpacing: 1.6 },
  statusTitle: { fontSize: fontSize.displayS, fontWeight: "800", color: colors.ink, letterSpacing: -0.4 },
  statusHint: { fontSize: fontSize.bodyS, color: colors.ink60 },

  btn: {
    backgroundColor: colors.orange,
    borderRadius: radius[3],
    paddingVertical: space[3],
    alignItems: "center",
    marginTop: space[2],
  },
  btnSecondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.ruleStrong },
  btnLabel: { color: colors.white, fontWeight: "700", fontSize: fontSize.body },
  btnLabelSecondary: { color: colors.ink },

  /* Stat tiles */
  statsRow: { flexDirection: "row", gap: space[3] },
  statTile: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.rule,
    padding: space[4],
    gap: space[2],
    ...shadow.card,
  },
  statIcon: {
    width: 36, height: 36, borderRadius: radius[3],
    alignItems: "center", justifyContent: "center",
  },
  statLabel: { fontSize: 10, fontWeight: "800", color: colors.ink40, letterSpacing: 1.4 },
  statValue: { fontSize: 28, fontWeight: "800", color: colors.ink, letterSpacing: -0.6, lineHeight: 30 },
});
