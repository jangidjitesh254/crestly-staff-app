import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { SalaryDayRow } from "../../types/api";
import { useSalary } from "../../hooks/queries";
import { Card, Screen, SectionLabel, StateView, Stepper } from "../../components/ui";
import { TopBar } from "../../components/TopBar";
import { PageHead } from "../../components/PageHead";
import { getErrorMessage } from "../../lib/api";
import { colors, fontSize, radius, space, tints } from "../../theme";
import type { MoreStackParams } from "../../navigation/types";

type Props = NativeStackScreenProps<MoreStackParams, "Salary">;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function stepMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  let nm = (m ?? 1) + delta;
  let ny = y ?? 2026;
  if (nm < 1) { nm = 12; ny -= 1; }
  if (nm > 12) { nm = 1; ny += 1; }
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}

function rupees(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}

const STATE_COLOR: Record<string, { bg: string; fg: string; label: string }> = {
  computed: { bg: tints.mint.base, fg: tints.mint.deep, label: "Done" },
  pending: { bg: tints.wheat.base, fg: tints.wheat.deep, label: "Pending" },
  absent: { bg: colors.errorSoft, fg: colors.error, label: "Absent" },
  holiday: { bg: tints.sky.base, fg: tints.sky.deep, label: "Holiday" },
  weekend: { bg: colors.cream, fg: colors.ink60, label: "Sunday" },
  sunday: { bg: colors.cream, fg: colors.ink60, label: "Sunday" },
  no_shift: { bg: colors.cream, fg: colors.ink40, label: "No shift" },
  no_salary: { bg: colors.cream, fg: colors.ink40, label: "—" },
  future: { bg: colors.cream, fg: colors.ink40, label: "—" },
};

export function SalaryScreen({ navigation }: Props) {
  const [month, setMonth] = useState(thisMonth());
  const salary = useSalary(month);

  return (
    <View style={styles.root}>
      <TopBar showBack onBack={() => navigation.goBack()} />
      <Screen
        refreshing={salary.isRefetching}
        onRefresh={() => void salary.refetch()}
      >
        <PageHead
          crumb="My Day"
          date={monthLabel(month).toUpperCase()}
          title="My Salary"
          subtitle="Your daily pay ledger for the month."
        />

        <Stepper
          label={monthLabel(month)}
          onPrev={() => setMonth(stepMonth(month, -1))}
          onNext={() => setMonth(stepMonth(month, +1))}
          nextDisabled={month >= thisMonth()}
        />

        <StateView
          loading={salary.isLoading && !salary.data}
          error={!salary.data && salary.error
            ? new Error(getErrorMessage(salary.error))
            : undefined}
          onRetry={() => void salary.refetch()}
        />

        {salary.data ? (
          <>
            {/* Summary */}
            <Card>
              <View style={styles.summaryRow}>
                <Big label="Monthly Salary" value={rupees(salary.data.monthlySalary)} />
              </View>
              <View style={styles.statRow}>
                <Stat label="Marked" value={`${salary.data.daysMarked}/${salary.data.daysInMonth}`} />
                <Stat label="Present" value={salary.data.daysPresent} />
                <Stat label="Absent" value={salary.data.daysAbsent} />
              </View>
              <View style={styles.divider} />
              <View style={styles.kv}>
                <Text style={styles.kvKey}>Total cut</Text>
                <Text style={[styles.kvVal, { color: colors.error }]}>
                  {salary.data.totalCut > 0 ? "−" : ""}
                  {rupees(salary.data.totalCut)}
                </Text>
              </View>
              <View style={styles.kv}>
                <Text style={styles.kvKey}>Net earned</Text>
                <Text style={[styles.kvVal, styles.bold]}>
                  {rupees(salary.data.netEarned)}
                </Text>
              </View>
              <View style={styles.kv}>
                <Text style={styles.kvKey}>Paid out</Text>
                <Text style={styles.kvVal}>
                  {rupees(salary.data.paidViaVoucher)}
                </Text>
              </View>
              <View style={[styles.kv, styles.duePill]}>
                <Text style={[styles.kvKey, { color: colors.orangeDeep }]}>
                  Due
                </Text>
                <Text style={[styles.kvVal, styles.bold, { color: colors.orangeDeep }]}>
                  {rupees(salary.data.due)}
                </Text>
              </View>
            </Card>

            <SectionLabel>Daily ledger</SectionLabel>
            <View style={{ gap: space[2] }}>
              {salary.data.rows.map((r) => (
                <DayRow key={r.date} row={r} />
              ))}
            </View>
          </>
        ) : null}
      </Screen>
    </View>
  );
}

function DayRow({ row }: { row: SalaryDayRow }) {
  const sc = STATE_COLOR[row.state] ?? STATE_COLOR.no_salary!;
  const day = parseInt(row.date.slice(-2), 10);
  return (
    <View style={styles.day}>
      <View style={styles.dayCell}>
        <Text style={styles.dayN}>{day}</Text>
      </View>
      <View style={styles.flex}>
        <View style={styles.dayHead}>
          <Text style={styles.dayPunch}>
            {row.punchIn ? row.punchIn.slice(0, 5) : "—"}
            {" → "}
            {row.punchOut ? row.punchOut.slice(0, 5) : "—"}
          </Text>
          <View style={[styles.stateBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.stateBadgeText, { color: sc.fg }]}>
              {sc.label.toUpperCase()}
            </Text>
          </View>
        </View>
        {row.lateMinutes > 0 || row.earlyMinutes > 0 || row.cut > 0 ? (
          <Text style={styles.dayMeta}>
            {row.lateMinutes > 0 ? `${row.lateMinutes}m late · ` : ""}
            {row.earlyMinutes > 0 ? `${row.earlyMinutes}m early · ` : ""}
            {row.cut > 0 ? `cut ${rupees(row.cut)}` : `net ${rupees(row.net)}`}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Big({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={styles.bigLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.bigValue}>{value}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statN}>{value}</Text>
      <Text style={styles.statL}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.creamSoft },
  flex: { flex: 1 },

  summaryRow: { gap: 4 },
  bigLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.ink40,
    letterSpacing: 1.4,
  },
  bigValue: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.6,
  },

  statRow: { flexDirection: "row", gap: space[2], marginTop: space[2] },
  statBox: {
    flex: 1,
    backgroundColor: colors.cream,
    borderRadius: radius[3],
    padding: space[2],
    alignItems: "center",
  },
  statN: { fontSize: 18, fontWeight: "800", color: colors.ink },
  statL: { fontSize: 9, fontWeight: "800", color: colors.ink40, letterSpacing: 1.2 },

  divider: { height: 1, backgroundColor: colors.rule, marginVertical: space[2] },

  kv: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  kvKey: { fontSize: fontSize.body, color: colors.ink60 },
  kvVal: { fontSize: fontSize.body, color: colors.ink, fontWeight: "600" },
  bold: { fontWeight: "800" },
  duePill: {
    backgroundColor: colors.orangeTint,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius[3],
    marginTop: space[1],
  },

  day: {
    flexDirection: "row",
    gap: space[3],
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius[3],
    padding: space[3],
    alignItems: "center",
  },
  dayCell: {
    width: 38,
    height: 38,
    borderRadius: radius[2],
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  dayN: { fontSize: 16, fontWeight: "800", color: colors.ink },
  dayHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayPunch: { fontSize: fontSize.bodyS, color: colors.ink, fontWeight: "700" },
  dayMeta: { fontSize: fontSize.cap, color: colors.ink60, marginTop: 2 },
  stateBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
  stateBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
});
