import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useClasses, useMyClasses } from "../../hooks/queries";
import { useAuth } from "../../store/auth";
import { Card, FadeInView, Screen, SectionLabel, StateView, Stepper } from "../../components/ui";
import { TopBar } from "../../components/TopBar";
import { PageHead } from "../../components/PageHead";
import { InfoCard } from "../../components/InfoCard";
import { getErrorMessage } from "../../lib/api";
import { addDays, formatBreadcrumbDate, formatLong, todayIso } from "../../lib/dates";
import { colors, fontSize, radius, space, tints } from "../../theme";
import type { AttendanceStackParams } from "../../navigation/types";

type Props = NativeStackScreenProps<AttendanceStackParams, "AttendanceHome">;

interface MarkableSection {
  classSlug: string;
  className: string;
  section: string;
  studentCount: number | null;
}

export function AttendanceHomeScreen({ navigation }: Props) {
  const { hasPerm } = useAuth();
  const [date, setDate] = useState(todayIso());
  // Authoritative scope: the class teacher's own section(s) (admins get all).
  const my = useMyClasses();
  // Best-effort enrichment for the student count (may be unavailable for teachers).
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
            subtitle="Mark daily attendance for your class."
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
  const canMarkAll = my.data?.canMarkAll ?? false;

  // slug|section → studentCount (when /classes is readable).
  const countBySection = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of classes.data ?? []) {
      for (const s of c.sections) m.set(`${c.slug}|${s.code}`, s.studentCount);
    }
    return m;
  }, [classes.data]);

  const sections: MarkableSection[] = useMemo(() => {
    return (my.data?.classes ?? [])
      .map((c) => ({
        classSlug: c.classSlug,
        className: c.className,
        section: c.sectionCode,
        studentCount: countBySection.get(`${c.classSlug}|${c.sectionCode}`) ?? null,
      }))
      .sort((a, b) =>
        a.classSlug === b.classSlug
          ? a.section.localeCompare(b.section)
          : a.classSlug.localeCompare(b.classSlug),
      );
  }, [my.data, countBySection]);

  return (
    <View style={styles.root}>
      <TopBar />
      <Screen refreshing={my.isRefetching} onRefresh={() => void my.refetch()}>
        <PageHead
          crumb="Records"
          date={formatBreadcrumbDate(todayIso())}
          title="Attendance"
          subtitle={
            canMarkAll
              ? "Pick a class and section to mark attendance."
              : "Mark attendance for the class you are the class teacher of."
          }
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
          {canMarkAll
            ? `All sections · ${sections.length}`
            : sections.length === 1
              ? "Your class"
              : `Your classes · ${sections.length}`}
        </SectionLabel>

        <StateView
          loading={my.isLoading && !my.data}
          error={!my.data && my.error ? new Error(getErrorMessage(my.error)) : undefined}
          onRetry={() => void my.refetch()}
        />

        {my.data && sections.length === 0 ? (
          <InfoCard
            lead={canMarkAll ? "No sections found." : "You're not a class teacher."}
            body={
              canMarkAll
                ? "No classes are set up yet. Add sections from the web admin."
                : "Only the assigned class teacher can mark a section's attendance. If you should be one, ask your coordinator to set you as the class teacher of a section."
            }
          />
        ) : null}

        {sections.map((a, i) => (
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
                  Section {a.section}
                  {a.studentCount != null
                    ? ` · ${a.studentCount} ${a.studentCount === 1 ? "student" : "students"}`
                    : ""}
                </Text>
                {!canMarkAll ? (
                  <View style={styles.ctBadge}>
                    <Ionicons name="ribbon-outline" size={12} color={tints.mint.deep} />
                    <Text style={styles.ctBadgeText}>CLASS TEACHER</Text>
                  </View>
                ) : null}
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

  ctBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: tints.mint.base,
    borderRadius: radius.pill,
    paddingHorizontal: space[2],
    paddingVertical: 2,
    marginTop: space[2],
  },
  ctBadgeText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: tints.mint.deep,
    letterSpacing: 1,
  },
});
