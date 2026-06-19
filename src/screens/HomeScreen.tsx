import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { MaterialTopTabScreenProps } from "@react-navigation/material-top-tabs";
import { useAuth } from "../store/auth";
import { useLeaves, useMyPunches } from "../hooks/queries";
import { isForbidden } from "../lib/api";
import { FadeInView, Screen } from "../components/ui";
import { TopBar } from "../components/TopBar";
import { PageHead } from "../components/PageHead";
import { formatBreadcrumbDate, todayIso } from "../lib/dates";
import { colors, fontSize, radius, space, tints } from "../theme";
import type { MainTabParams } from "../navigation/types";

type Props = MaterialTopTabScreenProps<MainTabParams, "Home">;

function clockTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface ActionItem {
  key: string;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: { base: string; deep: string };
  go: () => void;
  enabled: boolean;
}

export function HomeScreen({ navigation }: Props) {
  const { user, hasPerm } = useAuth();
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const today = todayIso();
  const myPunches = useMyPunches(user?.id ?? 0, today);
  const leaves = useLeaves();

  const punchesItems = myPunches.data?.items ?? [];
  const lastPunch = punchesItems.length > 0 ? punchesItems[0] : null;
  const punchHistoryBlocked = !!myPunches.error && isForbidden(myPunches.error);

  const pendingLeaves = leaves.data?.pendingCount ?? 0;
  const leaveDaysLeft = (leaves.data?.balances ?? []).reduce((s, b) => s + b.left, 0);

  const actions: ActionItem[] = [
    {
      key: "attendance",
      label: "Mark Attendance",
      hint: "Daily class register",
      icon: "checkbox-outline",
      tint: tints.mint,
      go: () => navigation.navigate("Attendance"),
      enabled: hasPerm("attendance.view"),
    },
    {
      key: "punch",
      label: "Punch In / Out",
      hint: "Record your own attendance",
      icon: "time-outline",
      tint: tints.sky,
      go: () => navigation.navigate("Punch"),
      enabled: hasPerm("staff.punch"),
    },
    {
      key: "leaves",
      label: "My Leaves",
      hint: "Apply for and track leave",
      icon: "calendar-outline",
      tint: tints.wheat,
      go: () =>
        navigation.navigate("Profile", { screen: "LeavesList" } as never),
      enabled: true,
    },
  ];

  return (
    <View style={styles.root}>
      <TopBar />
      <Screen>
        <PageHead
          crumb="Overview"
          date={formatBreadcrumbDate(today)}
          title={`Hi, ${firstName}`}
          subtitle={user?.roleName ?? user?.roleSlug ?? "Staff"}
        />

        {/* Today's check-in status */}
        {hasPerm("staff.punch") ? (
          <FadeInView delay={0}>
            <StatusCard
              lastPunch={lastPunch}
              blocked={punchHistoryBlocked}
              onAction={() => navigation.navigate("Punch")}
            />
          </FadeInView>
        ) : null}

        {/* Quick stats */}
        <FadeInView delay={80}>
          <View style={styles.statsRow}>
            <StatTile
              label="Pending Leaves"
              value={pendingLeaves}
              icon="time-outline"
              tint={tints.mustard}
            />
            <StatTile
              label="Leave Days Left"
              value={leaveDaysLeft}
              icon="calendar-outline"
              tint={tints.mint}
            />
          </View>
        </FadeInView>

        <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>

        {actions.map((a, i) => (
          <FadeInView key={a.key} delay={140 + i * 50}>
            <ActionRow item={a} />
          </FadeInView>
        ))}

        <Text style={styles.footer}>
          Powered by{" "}
          <Text style={styles.footerStrong}>Shadowbiz Startups Developer.</Text>
          {"\n"}Built to support the school ecosystem.
        </Text>
      </Screen>
    </View>
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
        <Text style={styles.statusHint}>
          Tap below to record your location + selfie.
        </Text>
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
          <Text style={[styles.statusLabel, { color: tints.mint.deep }]}>
            CHECKED IN
          </Text>
        </View>
        <Text style={styles.statusTitle}>
          Since {clockTime(lastPunch.punchedAt)}
        </Text>
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
        <Text style={styles.statusTitle}>
          Punched out at {clockTime(lastPunch.punchedAt)}
        </Text>
        <Text style={styles.statusHint}>Tap below if you need to punch in again.</Text>
        <PressBtn label="Punch In Again" onPress={onAction} variant="secondary" />
      </View>
    );
  }
  return (
    <View style={[styles.statusCard, { backgroundColor: tints.wheat.base }]}>
      <Text style={[styles.statusLabel, { color: tints.wheat.deep }]}>TODAY</Text>
      <Text style={styles.statusTitle}>You haven't punched in yet</Text>
      <Text style={styles.statusHint}>
        Capture your location + selfie to start your day.
      </Text>
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

function ActionRow({ item }: { item: ActionItem }) {
  return (
    <Pressable
      onPress={item.enabled ? item.go : undefined}
      disabled={!item.enabled}
      android_ripple={
        item.enabled ? { color: "rgba(16,13,10,0.08)" } : undefined
      }
      style={({ pressed }) => [
        styles.action,
        pressed && item.enabled && styles.actionPressed,
        !item.enabled && styles.actionOff,
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: item.tint.base }]}>
        <Ionicons name={item.icon} size={22} color={item.tint.deep} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionLabel}>{item.label}</Text>
        <Text style={styles.actionHint}>
          {item.enabled ? item.hint : "Not enabled for your role"}
        </Text>
      </View>
      {item.enabled ? (
        <Ionicons name="chevron-forward" size={20} color={colors.ink40} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.creamSoft },

  sectionLabel: {
    fontSize: fontSize.label,
    fontWeight: "800",
    color: colors.ink40,
    letterSpacing: 1.6,
    marginTop: space[3],
  },

  /* Status card */
  statusCard: {
    borderRadius: 20,
    padding: space[4],
    gap: space[2],
    borderWidth: 1,
    borderColor: "rgba(16,13,10,0.06)",
  },
  statusHead: { flexDirection: "row", alignItems: "center", gap: space[2] },
  statusDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  statusLabel: {
    fontSize: fontSize.label,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  statusTitle: {
    fontSize: fontSize.displayS,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.4,
  },
  statusHint: { fontSize: fontSize.bodyS, color: colors.ink60 },

  /* Inline button (used inside status cards) */
  btn: {
    backgroundColor: colors.orange,
    borderRadius: radius[3],
    paddingVertical: space[3],
    alignItems: "center",
    marginTop: space[2],
  },
  btnSecondary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.ruleStrong,
  },
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
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: radius[3],
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.ink40,
    letterSpacing: 1.4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.6,
    lineHeight: 30,
  },

  /* Action rows */
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.rule,
    padding: space[4],
    overflow: "hidden",
  },
  actionPressed: { transform: [{ scale: 0.98 }] },
  actionOff: { opacity: 0.55 },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: radius[3],
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { fontSize: fontSize.bodyL, fontWeight: "700", color: colors.ink },
  actionHint: { fontSize: fontSize.bodyS, color: colors.ink60 },

  /* Footer */
  footer: {
    marginTop: space[6],
    paddingTop: space[5],
    borderTopWidth: 1,
    borderTopColor: colors.rule,
    fontSize: fontSize.bodyS,
    color: colors.ink40,
    textAlign: "center",
    lineHeight: 20,
  },
  footerStrong: { color: colors.ink, fontWeight: "700" },
});
