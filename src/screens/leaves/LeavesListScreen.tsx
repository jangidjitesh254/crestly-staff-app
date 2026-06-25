import React from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Leave } from "../../types/api";
import { useCancelLeave, useLeaves } from "../../hooks/queries";
import { useAuth } from "../../store/auth";
import {
  Badge,
  Button,
  Card,
  Screen,
  SectionLabel,
  StateView,
} from "../../components/ui";
import { TopBar } from "../../components/TopBar";
import { PageHead } from "../../components/PageHead";
import { getErrorMessage } from "../../lib/api";
import { formatBreadcrumbDate, formatShort, todayIso } from "../../lib/dates";
import { colors, fontSize, radius, space, leaveStatusColor } from "../../theme";
import type { MoreStackParams } from "../../navigation/types";

type Props = NativeStackScreenProps<MoreStackParams, "LeavesList">;

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

  return (
    <View style={localStyles.root}>
    <TopBar showBack onBack={() => navigation.goBack()} />
    <Screen
      refreshing={leaves.isRefetching}
      onRefresh={() => void leaves.refetch()}
    >
      <PageHead
        crumb="My Day"
        date={formatBreadcrumbDate(todayIso())}
        title="My Leaves"
        subtitle="Apply for and track your leave requests."
      />

      {canApply ? (
        <Button
          label="Apply for leave"
          onPress={() => navigation.navigate("ApplyLeave")}
        />
      ) : null}

      <StateView
        loading={leaves.isLoading}
        error={leaves.error ? new Error(getErrorMessage(leaves.error)) : undefined}
        onRetry={() => void leaves.refetch()}
      />

      {leaves.data ? (
        <>
          {leaves.data.balances.length > 0 ? (
            <>
              <SectionLabel>Balance this year</SectionLabel>
              <View style={styles.balanceGrid}>
                {leaves.data.balances.map((b) => (
                  <View key={b.leaveTypeId} style={styles.balance}>
                    <Text style={styles.balanceLeft}>{b.left}</Text>
                    <Text style={styles.balanceCode}>{b.shortCode}</Text>
                    <Text style={styles.balanceMeta}>
                      of {b.quota} · {b.taken} used
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <SectionLabel>
            Applications{leaves.data.pendingCount > 0
              ? ` · ${leaves.data.pendingCount} pending`
              : ""}
          </SectionLabel>

          {leaves.data.items.length === 0 ? (
            <StateView empty emptyText="You haven’t applied for any leave yet." />
          ) : (
            leaves.data.items.map((l) => {
              const sc = leaveStatusColor[l.status] ?? leaveStatusColor.pending;
              return (
                <Card key={l.id}>
                  <View style={styles.rowHead}>
                    <Text style={styles.leaveType}>{l.leaveType}</Text>
                    <Badge
                      label={l.status.toUpperCase()}
                      bg={sc.bg}
                      fg={sc.fg}
                    />
                  </View>
                  <Text style={styles.dates}>
                    {formatShort(l.fromDate)} – {formatShort(l.toDate)} ·{" "}
                    {l.days} day{l.days === 1 ? "" : "s"}
                    {l.halfDay !== "none" ? " · half day" : ""}
                  </Text>
                  {l.reason ? (
                    <Text style={styles.reason}>{l.reason}</Text>
                  ) : null}
                  {l.decisionNote ? (
                    <Text style={styles.decision}>
                      {l.decidedByName ? `${l.decidedByName}: ` : ""}
                      {l.decisionNote}
                    </Text>
                  ) : null}
                  {l.status === "pending" ? (
                    <Button
                      label="Cancel request"
                      variant="danger"
                      loading={cancel.isPending && cancel.variables === l.id}
                      onPress={() => confirmCancel(l)}
                    />
                  ) : null}
                </Card>
              );
            })
          )}
        </>
      ) : null}
    </Screen>
    </View>
  );
}

const localStyles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.white } });

const styles = StyleSheet.create({
  balanceGrid: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  balance: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius[3],
    padding: space[3],
    minWidth: 96,
    flexGrow: 1,
  },
  balanceLeft: { fontSize: fontSize.displayS, fontWeight: "800", color: colors.ink },
  balanceCode: {
    fontSize: fontSize.bodyS,
    fontWeight: "700",
    color: colors.orangeDeep,
  },
  balanceMeta: { fontSize: fontSize.cap, color: colors.ink60 },

  rowHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  leaveType: { fontSize: fontSize.h2, fontWeight: "700", color: colors.ink },
  dates: { fontSize: fontSize.bodyS, color: colors.ink80 },
  reason: { fontSize: fontSize.bodyS, color: colors.ink60 },
  decision: {
    fontSize: fontSize.bodyS,
    color: colors.ink60,
    fontStyle: "italic",
  },
});
