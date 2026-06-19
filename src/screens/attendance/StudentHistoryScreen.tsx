import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AttendanceStatus } from "../../types/api";
import { useAttendanceHistory } from "../../hooks/queries";
import { Card, Screen, SectionLabel, StateView, Stepper } from "../../components/ui";
import { TopBar } from "../../components/TopBar";
import { PageHead } from "../../components/PageHead";
import { getErrorMessage } from "../../lib/api";
import { monthLabel } from "../../lib/dates";
import { colors, fontSize, radius, space, statusColor } from "../../theme";
import type { AttendanceStackParams } from "../../navigation/types";

type Props = NativeStackScreenProps<AttendanceStackParams, "StudentHistory">;

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function StudentHistoryScreen({ route, navigation }: Props) {
  const { srNumber, studentName } = route.params;
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12

  const history = useAttendanceHistory(srNumber, year, month);

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;

  function step(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setYear(y);
    setMonth(m);
  }

  const weeks = useMemo(() => {
    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [year, month]);

  const days = history.data?.days ?? {};

  return (
    <View style={localRoot.root}>
    <TopBar showBack onBack={() => navigation.goBack()} />
    <Screen>
      <PageHead
        crumb={`SR #${srNumber}`}
        title={studentName}
        subtitle="Monthly attendance history."
      />

      <Stepper
        label={monthLabel(year, month)}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        nextDisabled={isCurrentMonth}
      />

      <StateView
        loading={history.isLoading}
        error={
          history.error ? new Error(getErrorMessage(history.error)) : undefined
        }
        onRetry={() => void history.refetch()}
      />

      {history.data ? (
        <>
          <View style={styles.tallyRow}>
            <Stat label="Present" n={history.data.present} c={statusColor.present} />
            <Stat label="Absent" n={history.data.absent} c={statusColor.absent} />
            <Stat label="Late" n={history.data.late} c={statusColor.late} />
            <Stat label="Excused" n={history.data.excused} c={statusColor.excused} />
          </View>

          <Card>
            <SectionLabel>{monthLabel(year, month)}</SectionLabel>
            <View style={styles.weekHead}>
              {WEEKDAYS.map((w, i) => (
                <Text key={i} style={styles.weekHeadText}>
                  {w}
                </Text>
              ))}
            </View>
            {weeks.map((week, wi) => (
              <View key={wi} style={styles.week}>
                {week.map((d, di) => {
                  if (d == null) return <View key={di} style={styles.cell} />;
                  const iso = `${year}-${pad(month)}-${pad(d)}`;
                  const status = days[iso] as AttendanceStatus | undefined;
                  const c = status ? statusColor[status] : null;
                  return (
                    <View
                      key={di}
                      style={[
                        styles.cell,
                        styles.cellDay,
                        c ? { backgroundColor: c.bg } : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.cellText,
                          c ? { color: c.fg, fontWeight: "800" } : null,
                        ]}
                      >
                        {d}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </Card>

          <View style={styles.legend}>
            {(["present", "absent", "late", "excused"] as const).map((s) => (
              <View key={s} style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: statusColor[s].bg }]}
                />
                <Text style={styles.legendText}>{s}</Text>
              </View>
            ))}
          </View>

          {history.data.marked === 0 ? (
            <Text style={styles.note}>
              No attendance recorded for this month.
            </Text>
          ) : null}
        </>
      ) : null}
    </Screen>
    </View>
  );
}

const localRoot = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.creamSoft } });

function Stat({
  label,
  n,
  c,
}: {
  label: string;
  n: number;
  c: { bg: string; fg: string };
}) {
  return (
    <View style={[styles.stat, { backgroundColor: c.bg }]}>
      <Text style={[styles.statN, { color: c.fg }]}>{n}</Text>
      <Text style={[styles.statL, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: fontSize.h1, fontWeight: "800", color: colors.ink },
  sr: { fontSize: fontSize.bodyS, color: colors.ink60 },

  tallyRow: { flexDirection: "row", gap: space[2] },
  stat: {
    flex: 1,
    borderRadius: radius[3],
    paddingVertical: space[2],
    alignItems: "center",
  },
  statN: { fontSize: fontSize.h1, fontWeight: "800" },
  statL: { fontSize: 10, fontWeight: "700" },

  weekHead: { flexDirection: "row", marginTop: space[1] },
  weekHeadText: {
    flex: 1,
    textAlign: "center",
    fontSize: fontSize.cap,
    fontWeight: "700",
    color: colors.ink40,
  },
  week: { flexDirection: "row" },
  cell: { flex: 1, aspectRatio: 1, padding: 2 },
  cellDay: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius[2],
  },
  cellText: { fontSize: fontSize.bodyS, color: colors.ink60 },

  legend: { flexDirection: "row", flexWrap: "wrap", gap: space[3] },
  legendItem: { flexDirection: "row", alignItems: "center", gap: space[1] },
  legendDot: { width: 14, height: 14, borderRadius: 4 },
  legendText: {
    fontSize: fontSize.cap,
    color: colors.ink60,
    textTransform: "capitalize",
  },
  note: { fontSize: fontSize.bodyS, color: colors.ink40, textAlign: "center" },
});
