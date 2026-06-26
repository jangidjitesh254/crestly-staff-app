import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Leave } from "../../types/api";
import { useCancelLeave, useLeaves } from "../../hooks/queries";
import { useAuth } from "../../store/auth";
import { Screen, StateView } from "../../components/ui";
import { TopBar } from "../../components/TopBar";
import { getErrorMessage } from "../../lib/api";
import { formatShort } from "../../lib/dates";
import { colors, fontSize, radius, space, leaveStatusColor } from "../../theme";
import type { MoreStackParams } from "../../navigation/types";
import type { LeaveBalance } from "../../types/api";

type Props = NativeStackScreenProps<MoreStackParams, "LeavesList">;

function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}
function statusIcon(s: string): keyof typeof Ionicons.glyphMap {
  return s === "approved" ? "checkmark-circle"
    : s === "rejected" ? "close-circle"
    : s === "cancelled" ? "ban" : "time";
}

export function LeavesListScreen({ navigation }: Props) {
  const { hasPerm } = useAuth();
  const leaves = useLeaves();
  const cancel = useCancelLeave();
  const canApply = hasPerm("leaves.apply");

  function confirmCancel(leave: Leave) {
    Alert.alert("Cancel leave?", "This withdraws your pending request.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel leave",
        style: "destructive",
        onPress: async () => {
          try {
            await cancel.mutateAsync(leave.id);
          } catch (err) {
            Alert.alert("Could not cancel", getErrorMessage(err));
          }
        },
      },
    ]);
  }

  const pending = leaves.data?.pendingCount ?? 0;

  return (
    <View style={styles.root}>
      <TopBar showBack onBack={() => navigation.goBack()} />
      <Screen refreshing={leaves.isRefetching} onRefresh={() => void leaves.refetch()}>
        {/* Header */}
        <Text style={styles.title}>My leaves</Text>
        <Text style={styles.subtitle}>Apply for and track your leave requests.</Text>

        {canApply ? (
          <Pressable
            onPress={() => navigation.navigate("ApplyLeave")}
            android_ripple={{ color: "rgba(255,255,255,0.2)" }}
            style={({ pressed }) => [styles.applyBtn, pressed && { opacity: 0.9 }]}
          >
            <Ionicons name="add" size={20} color={colors.white} />
            <Text style={styles.applyText}>Apply for leave</Text>
          </Pressable>
        ) : null}

        <StateView
          loading={leaves.isLoading}
          error={leaves.error ? new Error(getErrorMessage(leaves.error)) : undefined}
          onRetry={() => void leaves.refetch()}
        />

        {leaves.data ? (
          <>
            {leaves.data.balances.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Balance this year</Text>
                <View style={styles.grid}>
                  {leaves.data.balances.map((b) => (
                    <BalanceTile key={b.leaveTypeId} b={b} />
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.section}>
              <View style={styles.appHead}>
                <Text style={styles.sectionTitle}>Applications</Text>
                {pending > 0 ? (
                  <View style={styles.pendPill}>
                    <Text style={styles.pendText}>{pending} pending</Text>
                  </View>
                ) : null}
              </View>

              {leaves.data.items.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="document-text-outline" size={26} color={colors.ink40} />
                  <Text style={styles.emptyText}>You haven’t applied for any leave yet.</Text>
                </View>
              ) : (
                <View style={{ gap: space[3] }}>
                  {leaves.data.items.map((l) => {
                    const sc = leaveStatusColor[l.status] ?? leaveStatusColor.pending;
                    return (
                      <View key={l.id} style={styles.appCard}>
                        <View style={styles.appTop}>
                          <View style={[styles.appIcon, { backgroundColor: sc.bg }]}>
                            <Ionicons name={statusIcon(l.status)} size={18} color={sc.fg} />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.appType} numberOfLines={1}>{l.leaveType}</Text>
                            <Text style={styles.appDates} numberOfLines={1}>
                              {formatShort(l.fromDate)} – {formatShort(l.toDate)} · {l.days} day{l.days === 1 ? "" : "s"}
                              {l.halfDay !== "none" ? " · half day" : ""}
                            </Text>
                          </View>
                          <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
                            <Text style={[styles.statusText, { color: sc.fg }]}>{titleCase(l.status)}</Text>
                          </View>
                        </View>

                        {l.reason ? <Text style={styles.appReason}>{l.reason}</Text> : null}
                        {l.decisionNote ? (
                          <Text style={styles.appDecision}>
                            {l.decidedByName ? `${l.decidedByName}: ` : ""}{l.decisionNote}
                          </Text>
                        ) : null}

                        {l.status === "pending" ? (
                          <Pressable
                            onPress={() => confirmCancel(l)}
                            disabled={cancel.isPending && cancel.variables === l.id}
                            style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.85 }]}
                          >
                            <Text style={styles.cancelText}>
                              {cancel.isPending && cancel.variables === l.id ? "Cancelling…" : "Cancel request"}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        ) : null}
      </Screen>
    </View>
  );
}

function BalanceTile({ b }: { b: LeaveBalance }) {
  const has = b.quota > 0;
  const pct = has ? Math.min(100, Math.round((b.taken / b.quota) * 100)) : 0;
  return (
    <View style={styles.bTile}>
      <View style={styles.bTop}>
        <Text style={styles.bCode}>{b.shortCode}</Text>
        <Text style={styles.bLeft}>{has ? `${b.left} left` : "—"}</Text>
      </View>
      {has ? (
        <>
          <View style={styles.bTrack}>
            <View style={[styles.bFill, { width: `${Math.max(4, pct)}%` }]} />
          </View>
          <Text style={styles.bMeta}>{b.taken} of {b.quota} used</Text>
        </>
      ) : (
        <Text style={styles.bMeta}>Not allotted</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },

  /* Header */
  title: { fontSize: 28, fontWeight: "900", color: colors.ink, letterSpacing: -0.8 },
  subtitle: { fontSize: fontSize.body, color: colors.ink60, marginTop: 4, marginBottom: space[2] },

  applyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.orange,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: space[2],
    shadowColor: colors.orange,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 16,
    elevation: 4,
  },
  applyText: { color: colors.white, fontSize: fontSize.bodyL, fontWeight: "800", letterSpacing: 0.1 },

  section: { gap: space[3], marginTop: space[3] },
  sectionTitle: { fontSize: fontSize.h2, fontWeight: "800", color: colors.ink, letterSpacing: -0.2 },

  /* Balance grid */
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: space[3] },
  bTile: {
    width: "48%",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 18,
    padding: space[4],
    gap: 10,
  },
  bTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  bCode: { fontSize: fontSize.bodyL, fontWeight: "900", color: colors.ink, letterSpacing: -0.2 },
  bLeft: { fontSize: fontSize.bodyS, fontWeight: "700", color: colors.ink60 },
  bTrack: { height: 7, backgroundColor: "#F0EEEA", borderRadius: 999, overflow: "hidden" },
  bFill: { height: "100%", borderRadius: 999, backgroundColor: colors.orange },
  bMeta: { fontSize: fontSize.cap, color: colors.ink60, fontWeight: "600" },

  /* Applications */
  appHead: { flexDirection: "row", alignItems: "center", gap: space[2] },
  pendPill: {
    backgroundColor: colors.warnSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
  pendText: { fontSize: 11, fontWeight: "800", color: colors.warn, letterSpacing: 0.3 },

  appCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 18,
    padding: space[4],
    gap: space[2],
  },
  appTop: { flexDirection: "row", alignItems: "center", gap: space[3] },
  appIcon: {
    width: 40, height: 40, borderRadius: radius[4],
    alignItems: "center", justifyContent: "center",
  },
  appType: { fontSize: fontSize.bodyL, fontWeight: "800", color: colors.ink },
  appDates: { fontSize: fontSize.bodyS, color: colors.ink60, marginTop: 2, fontWeight: "600" },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.2 },
  appReason: { fontSize: fontSize.bodyS, color: colors.ink80, lineHeight: 19 },
  appDecision: { fontSize: fontSize.bodyS, color: colors.ink60, fontStyle: "italic", lineHeight: 19 },

  cancelBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.errorSoft,
    borderRadius: radius[3],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    marginTop: space[1],
  },
  cancelText: { fontSize: fontSize.bodyS, fontWeight: "800", color: colors.error },

  /* Empty */
  empty: {
    alignItems: "center",
    gap: space[2],
    backgroundColor: "#F8F7F5",
    borderRadius: 18,
    paddingVertical: space[6],
    paddingHorizontal: space[4],
  },
  emptyText: { fontSize: fontSize.bodyS, color: colors.ink60, textAlign: "center" },
});
