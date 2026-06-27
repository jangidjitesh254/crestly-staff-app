/**
 * Diary (staff) — pick a section you teach on a given day, then fill the topic
 * taught + homework per period. Sections are derived from your timetable for
 * that weekday; tapping one opens the day's period grid (DiaryDayScreen).
 */
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
import type { MoreStackParams } from "../../navigation/types";

type Props = NativeStackScreenProps<MoreStackParams, "Diary">;

/** JS Date.getDay() returns 0=Sun..6=Sat. API timetable uses 1=Mon..7=Sun. */
function apiDayOfWeek(iso: string): number {
  const js = fromIso(iso).getDay();
  return js === 0 ? 7 : js;
}

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
  periods: TimetableCell[];
}

export function DiaryScreen({ navigation }: Props) {
  const { user, hasPerm } = useAuth();
  const userId = user?.id ?? 0;
  const [date, setDate] = useState(todayIso());
  const tt = useTimetableForTeacher(userId);
  const classes = useClasses();

  if (!hasPerm("diary.log")) {
    return (
      <View style={styles.root}>
        <TopBar showBack onBack={() => navigation.goBack()} />
        <Screen>
          <PageHead crumb="Records" title="Diary" subtitle="Log what was taught + homework." />
          <InfoCard
            lead="No access."
            body="Your role can't write the class diary. Ask an admin to grant you diary.log."
          />
        </Screen>
      </View>
    );
  }

  const atToday = date >= todayIso();
  const dow = apiDayOfWeek(date);

  const classNameBySlug = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of classes.data ?? []) m.set(c.slug, c.name);
    return m;
  }, [classes.data]);

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
      <TopBar showBack onBack={() => navigation.goBack()} />
      <Screen refreshing={tt.isRefetching} onRefresh={() => void tt.refetch()}>
        <PageHead
          crumb="Records"
          date={formatBreadcrumbDate(todayIso())}
          title="Diary"
          subtitle="Pick a section you teach to log the day's diary."
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
          error={!tt.data && tt.error ? new Error(getErrorMessage(tt.error)) : undefined}
          onRetry={() => void tt.refetch()}
        />

        {tt.data && assignments.length === 0 ? (
          <InfoCard
            lead={`No periods on ${weekday}.`}
            body="You don't teach any sections on this day. Pick another date."
          />
        ) : null}

        {assignments.map((a, i) => (
          <FadeInView key={`${a.classSlug}|${a.section}`} delay={i * 40}>
            <Pressable
              onPress={() =>
                navigation.navigate("DiaryDay", {
                  date,
                  classSlug: a.classSlug,
                  className: a.className,
                  section: a.section,
                })
              }
              android_ripple={{ color: "rgba(16,13,10,0.08)" }}
              style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.98 }] }]}
            >
              <View style={styles.sectionPill}>
                <Text style={styles.sectionPillText}>{a.section}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.classTitle}>{a.className}</Text>
                <Text style={styles.classSub}>
                  Section {a.section} · {a.periods.length}{" "}
                  {a.periods.length === 1 ? "period" : "periods"} you teach
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.ink40} />
            </Pressable>
          </FadeInView>
        ))}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  fieldLabel: { fontSize: fontSize.label, fontWeight: "800", color: colors.ink40, letterSpacing: 1.4 },
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
    backgroundColor: tints.wheat.base,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionPillText: { fontSize: 18, fontWeight: "800", color: tints.wheat.deep, letterSpacing: -0.3 },
  classTitle: { fontSize: fontSize.bodyL, fontWeight: "800", color: colors.ink },
  classSub: { fontSize: fontSize.bodyS, color: colors.ink60, marginTop: 2 },
});
