import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MaterialTopTabScreenProps } from "@react-navigation/material-top-tabs";
import type { TimetableCell, TimetablePeriod } from "../../types/api";
import { useTimetableForTeacher } from "../../hooks/queries";
import { useAuth } from "../../store/auth";
import { Card, Screen, StateView } from "../../components/ui";
import { TopBar } from "../../components/TopBar";
import { PageHead } from "../../components/PageHead";
import { InfoCard } from "../../components/InfoCard";
import { getErrorMessage } from "../../lib/api";
import { colors, fontSize, radius, space, tints } from "../../theme";
import type { MainTabParams } from "../../navigation/types";

type Props = MaterialTopTabScreenProps<MainTabParams, "Timetable">;

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

/** API uses 1=Mon..6=Sat (per PHP convention). Map 1→Monday, 6→Saturday. */
const DAY_INDEX = [1, 2, 3, 4, 5, 6];

export function TimetableScreen(_props: Props) {
  const { user, hasPerm } = useAuth();
  const userId = user?.id ?? 0;
  const tt = useTimetableForTeacher(userId);
  const [day, setDay] = useState<number>(() => {
    // Default to today (1=Mon..6=Sat); for Sunday land on Monday.
    const js = new Date().getDay(); // 0=Sun..6=Sat
    return js === 0 ? 1 : js;
  });

  const cellsForDay = useMemo(() => {
    const list = (tt.data?.cells ?? [])
      .filter((c) => c.dayOfWeek === day)
      .sort((a, b) => {
        const pa = tt.data?.periods.find((p) => p.id === a.periodId)?.sortOrder ?? 0;
        const pb = tt.data?.periods.find((p) => p.id === b.periodId)?.sortOrder ?? 0;
        return pa - pb;
      });
    return list;
  }, [tt.data, day]);

  if (!hasPerm("timetable.view")) {
    return (
      <View style={styles.root}>
        <TopBar />
        <Screen>
          <PageHead crumb="School" title="Timetable" />
          <InfoCard
            lead="Not enabled."
            body="Timetable viewing is not enabled for your role. Ask an admin to grant you timetable.view."
          />
        </Screen>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <TopBar />
      <Screen
        refreshing={tt.isRefetching}
        onRefresh={() => void tt.refetch()}
      >
        <PageHead
          crumb={tt.data?.scopeLabel ?? "My Timetable"}
          title="Timetable"
          subtitle="Your weekly periods, day by day."
        />

        {/* Day chips */}
        <View style={styles.daysRow}>
          {DAY_INDEX.map((d) => {
            const active = d === day;
            return (
              <Pressable
                key={d}
                onPress={() => setDay(d)}
                android_ripple={{ color: "rgba(245,239,227,0.2)" }}
                style={[styles.dayChip, active && styles.dayChipActive]}
              >
                <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                  {DAY_NAMES[d]?.slice(0, 3).toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <StateView
          loading={tt.isLoading && !tt.data}
          error={!tt.data && tt.error
            ? new Error(getErrorMessage(tt.error))
            : undefined}
          empty={!tt.isLoading && cellsForDay.length === 0}
          emptyText={`No periods scheduled for ${DAY_NAMES[day]}.`}
          onRetry={() => void tt.refetch()}
        />

        {tt.data ? (
          <View style={{ gap: space[2] }}>
            {cellsForDay.map((c) => {
              const period = tt.data!.periods.find((p) => p.id === c.periodId);
              if (!period) return null;
              return <Row key={c.id} cell={c} period={period} />;
            })}
          </View>
        ) : null}
      </Screen>
    </View>
  );
}

function Row({ cell, period }: { cell: TimetableCell; period: TimetablePeriod }) {
  const start = period.startTime.slice(0, 5);
  const end = period.endTime.slice(0, 5);
  const title = cell.subjectName ?? cell.subjectShortCode ?? "Free period";
  const subTitle = `${cell.classSlug.toUpperCase()} · ${cell.sectionCode}`;
  return (
    <Card style={styles.row}>
      <View style={styles.timePill}>
        <Text style={styles.timePillTop}>{start}</Text>
        <Text style={styles.timePillBot}>{end}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {period.isBreak ? (
            <View style={styles.breakBadge}>
              <Text style={styles.breakBadgeText}>BREAK</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.sub}>{subTitle}</Text>
        <View style={styles.metaRow}>
          {cell.room ? <Text style={styles.meta}>Room {cell.room}</Text> : null}
          {cell.subjectName2 ? (
            <Text style={styles.meta}>+ {cell.subjectName2}</Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },

  daysRow: { flexDirection: "row", gap: space[2], flexWrap: "wrap" },
  dayChip: {
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  dayChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  dayChipText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.ink60,
    letterSpacing: 1.2,
  },
  dayChipTextActive: { color: colors.cream },

  row: { flexDirection: "row", gap: space[3], alignItems: "center" },
  timePill: {
    backgroundColor: tints.wheat.base,
    borderRadius: radius[3],
    paddingVertical: space[2],
    paddingHorizontal: space[2],
    alignItems: "center",
    minWidth: 56,
  },
  timePillTop: {
    fontSize: 13,
    fontWeight: "800",
    color: tints.wheat.deep,
    letterSpacing: -0.2,
  },
  timePillBot: { fontSize: 11, color: tints.wheat.deep },

  titleRow: { flexDirection: "row", alignItems: "center", gap: space[2] },
  title: { fontSize: fontSize.bodyL, fontWeight: "800", color: colors.ink },
  sub: { fontSize: fontSize.bodyS, color: colors.ink60, marginTop: 2 },
  metaRow: { flexDirection: "row", gap: space[3], marginTop: 4 },
  meta: { fontSize: fontSize.cap, color: colors.ink40 },

  breakBadge: {
    backgroundColor: tints.peach.base,
    borderRadius: radius.pill,
    paddingHorizontal: space[2],
    paddingVertical: 1,
  },
  breakBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: tints.peach.deep,
    letterSpacing: 1.2,
  },
});
