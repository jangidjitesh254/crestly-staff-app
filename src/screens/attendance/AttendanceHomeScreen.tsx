import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { TimetableCell } from "../../types/api";
import { useClasses, useTimetableForTeacher } from "../../hooks/queries";
import { useAuth } from "../../store/auth";
import { Card, FadeInView, Screen, SectionLabel, StateView, Stepper } from "../../components/ui";
import { TopBar } from "../../components/TopBar";
import { PageHead } from "../../components/PageHead";
import { InfoCard } from "../../components/InfoCard";
import { getErrorMessage } from "../../lib/api";
import {
  addDays,
  formatBreadcrumbDate,
  formatLong,
  fromIso,
  todayIso,
  weekdayLong,
} from "../../lib/dates";
import { colors, fontSize, radius, space, tints } from "../../theme";
import type { AttendanceStackParams } from "../../navigation/types";

type Props = NativeStackScreenProps<AttendanceStackParams, "AttendanceHome">;

/** JS Date.getDay() returns 0=Sun..6=Sat. API timetable uses 1=Mon..7=Sun. */
function apiDayOfWeek(iso: string): number {
  const js = fromIso(iso).getDay();
  return js === 0 ? 7 : js;
}

/** "5" → "Class 5"; "11-c" → "Class 11 (C)"; "nur" → "Nur". */
function formatClassSlug(slug: string): string {
  if (/^\d+$/.test(slug)) return `Class ${slug}`;
  const m = slug.match(/^(\d+)-(.+)$/);
  if (m) return `Class ${m[1]} (${m[2]?.toUpperCase()})`;
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

interface SectionAssignment {
  classSlug: string;
  className: string;
  section: string;
  /** All cells (periods) the teacher has for this class+section on the day. */
  periods: TimetableCell[];
}

export function AttendanceHomeScreen({ navigation }: Props) {
  const { user, hasPerm } = useAuth();
  const userId = user?.id ?? 0;
  const [date, setDate] = useState(todayIso());

  const tt = useTimetableForTeacher(userId);
  // Used only to enrich class names; harmless if the teacher lacks classes.view.
  const classes = useClasses();

  if (!hasPerm("attendance.view")) {
    return (
      <View style={styles.root}>
        <TopBar />
        <Screen>
          <PageHead
            crumb="Records"
            date={formatBreadcrumbDate(todayIso())}
            title="Attendance"
            subtitle="Mark daily attendance for your assigned classes."
          />
          <InfoCard
            lead="No access."
            body="Your role does not have access to student attendance. Ask an admin to grant you attendance.view."
          />
        </Screen>
      </View>
    );
  }

  const atToday = date >= todayIso();
  const dow = apiDayOfWeek(date);

  // Slug → friendly class name, when classes.view is granted.
  const classNameBySlug = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of classes.data ?? []) m.set(c.slug, c.name);
    return m;
  }, [classes.data]);

  // Today's periods for this teacher, grouped by (classSlug, sectionCode).
  const assignments: SectionAssignment[] = useMemo(() => {
    const cells = (tt.data?.cells ?? []).filter((c) => c.dayOfWeek === dow);
    const groups = new Map<string, TimetableCell[]>();
    for (const c of cells) {
      const key = `${c.classSlug}|${c.sectionCode}`;
      const bucket = groups.get(key);
      if (bucket) bucket.push(c);
      else groups.set(key, [c]);
    }
    return Array.from(groups.entries())
      .map(([key, periods]) => {
        const [classSlug, section] = key.split("|") as [string, string];
        return {
          classSlug,
          className: classNameBySlug.get(classSlug) ?? formatClassSlug(classSlug),
          section,
          periods,
        };
      })
      .sort((a, b) =>
        a.classSlug === b.classSlug
          ? a.section.localeCompare(b.section)
          : a.classSlug.localeCompare(b.classSlug),
      );
  }, [tt.data, dow, classNameBySlug]);

  const weekday = weekdayLong(date);

  return (
    <View style={styles.root}>
      <TopBar />
      <Screen
        refreshing={tt.isRefetching}
        onRefresh={() => void tt.refetch()}
      >
        <PageHead
          crumb="Records"
          date={formatBreadcrumbDate(todayIso())}
          title="Attendance"
          subtitle="Only the sections you teach on this day are listed."
        />

        <Card>
          <Text style={styles.fieldLabel}>DATE</Text>
          <Stepper
            label={formatLong(date)}
            onPrev={() => setDate(addDays(date, -1))}
            onNext={() => setDate(addDays(date, 1))}
            nextDisabled={atToday}
          />
        </Card>

        <SectionLabel>
          {weekday} · {assignments.length}{" "}
          {assignments.length === 1 ? "section" : "sections"}
        </SectionLabel>

        <StateView
          loading={tt.isLoading && !tt.data}
          error={
            !tt.data && tt.error
              ? new Error(getErrorMessage(tt.error))
              : undefined
          }
          onRetry={() => void tt.refetch()}
        />

        {tt.data && assignments.length === 0 ? (
          <InfoCard
            lead={`No periods on ${weekday}.`}
            body="You don't have any sections in your timetable for this day. Pick another date or ask your coordinator if you should be teaching today."
          />
        ) : null}

        {assignments.map((a, i) => (
          <FadeInView key={`${a.classSlug}|${a.section}`} delay={i * 40}>
            <Pressable
              onPress={() =>
                navigation.navigate("MarkAttendance", {
                  date,
                  classSlug: a.classSlug,
                  className: a.className,
                  section: a.section,
                })
              }
              android_ripple={{ color: "rgba(16,13,10,0.08)" }}
              style={({ pressed }) => [
                styles.card,
                pressed && { transform: [{ scale: 0.98 }] },
              ]}
            >
              <View style={styles.sectionPill}>
                <Text style={styles.sectionPillText}>{a.section}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.classTitle}>{a.className}</Text>
                <Text style={styles.classSub}>
                  Section {a.section} · {a.periods.length}{" "}
                  {a.periods.length === 1 ? "period" : "periods"}
                </Text>
                <View style={styles.periodChips}>
                  {a.periods
                    .slice(0, 3)
                    .map((p) => (
                      <PeriodChip key={p.id} cell={p} />
                    ))}
                  {a.periods.length > 3 ? (
                    <Text style={styles.more}>+{a.periods.length - 3}</Text>
                  ) : null}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.ink40} />
            </Pressable>
          </FadeInView>
        ))}
      </Screen>
    </View>
  );
}

function PeriodChip({ cell }: { cell: TimetableCell }) {
  const label = cell.subjectShortCode ?? cell.subjectName ?? "—";
  return (
    <View style={styles.periodChip}>
      <Text style={styles.periodChipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.creamSoft },

  fieldLabel: {
    fontSize: fontSize.label,
    fontWeight: "800",
    color: colors.ink40,
    letterSpacing: 1.4,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    backgroundColor: colors.white,
    borderRadius: radius[4],
    borderWidth: 1,
    borderColor: colors.rule,
    padding: space[4],
    overflow: "hidden",
  },
  sectionPill: {
    width: 44,
    height: 44,
    borderRadius: radius[3],
    backgroundColor: tints.mint.base,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionPillText: {
    fontSize: 18,
    fontWeight: "800",
    color: tints.mint.deep,
    letterSpacing: -0.3,
  },

  classTitle: { fontSize: fontSize.bodyL, fontWeight: "800", color: colors.ink },
  classSub: { fontSize: fontSize.bodyS, color: colors.ink60, marginTop: 2 },

  periodChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: space[2],
    alignItems: "center",
  },
  periodChip: {
    backgroundColor: colors.cream,
    borderRadius: radius.pill,
    paddingHorizontal: space[2],
    paddingVertical: 1,
  },
  periodChipText: {
    fontSize: fontSize.cap,
    fontWeight: "700",
    color: colors.ink60,
  },
  more: {
    fontSize: fontSize.cap,
    color: colors.ink40,
    fontWeight: "700",
  },
});
