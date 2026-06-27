import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Holiday, HolidayType } from "../../types/api";
import { useHolidayCalendar } from "../../hooks/queries";
import { Card, FadeInView, Screen, SectionLabel, StateView } from "../../components/ui";
import { TopBar } from "../../components/TopBar";
import { PageHead } from "../../components/PageHead";
import { getErrorMessage } from "../../lib/api";
import {
  academicYearLabel,
  currentAcademicYear,
  dayPad,
  monthShort,
  monthYearUpper,
  weekdayLong,
} from "../../lib/dates";
import { colors, fontSize, radius, space, tints } from "../../theme";
import type { MoreStackParams } from "../../navigation/types";

type Props = NativeStackScreenProps<MoreStackParams, "Holidays">;

const TYPE_TINT: Record<HolidayType, { bg: string; fg: string; label: string }> = {
  public:   { bg: tints.mint.base,    fg: tints.mint.deep,    label: "PUBLIC" },
  school:   { bg: tints.wheat.base,   fg: tints.wheat.deep,   label: "SCHOOL" },
  optional: { bg: tints.sky.base,     fg: tints.sky.deep,     label: "OPTIONAL" },
  weekend:  { bg: "#F4F3F0",       fg: colors.ink60,       label: "WEEKEND" },
};

export function HolidaysScreen({ navigation }: Props) {
  const currentAY = currentAcademicYear();
  const [ay, setAy] = useState(currentAY);
  const calendar = useHolidayCalendar(ay);

  const years = useMemo(() => [currentAY - 1, currentAY, currentAY + 1], [currentAY]);

  // Group holidays by YYYY-MM month so we can render month sections like the web.
  const monthGroups = useMemo(() => {
    const map = new Map<string, Holiday[]>();
    for (const h of calendar.data?.items ?? []) {
      const key = h.holidayDate.slice(0, 7); // YYYY-MM
      const bucket = map.get(key);
      if (bucket) bucket.push(h);
      else map.set(key, [h]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [calendar.data]);

  const ayLabel = academicYearLabel(ay);

  return (
    <View style={localRoot.root}>
    <TopBar showBack onBack={() => navigation.goBack()} />
    <Screen
      refreshing={calendar.isRefetching}
      onRefresh={() => void calendar.refetch()}
    >
      <PageHead crumb={`School · ${ayLabel}`} title="Holidays" />

      {/* Year selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.yearRow}
      >
        {years.map((y) => {
          const active = y === ay;
          return (
            <Pressable
              key={y}
              onPress={() => setAy(y)}
              android_ripple={{ color: "rgba(245,239,227,0.2)" }}
              style={[styles.yearChip, active && styles.yearChipActive]}
            >
              <Text style={[styles.yearChipText, active && styles.yearChipTextActive]}>
                {academicYearLabel(y)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Stats — 2x2 grid */}
      <FadeInView delay={0}>
        <View style={styles.statsGrid}>
          <StatTile
            label="Total Holidays"
            value={calendar.data?.totalHolidays ?? 0}
            sub={`in ${ayLabel}`}
            icon="calendar"
            tint={tints.mint}
          />
          <StatTile
            label="Upcoming · 60 days"
            value={calendar.data?.upcomingIn60Days ?? 0}
            sub="from today"
            icon="time"
            tint={tints.wheat}
          />
        </View>
        <View style={[styles.statsGrid, { marginTop: space[3] }]}>
          <StatTile
            label="Sundays"
            value={calendar.data?.sundayCount ?? 0}
            sub="auto-counted as paid off"
            icon="moon"
            tint={tints.sky}
          />
          <StatTile
            label="Working Days"
            value={calendar.data?.workingDays ?? 0}
            sub="non-Sunday, non-holiday"
            icon="briefcase"
            tint={tints.mustard}
          />
        </View>
      </FadeInView>

      <StateView
        loading={calendar.isLoading && !calendar.data}
        error={
          !calendar.data && calendar.error
            ? new Error(getErrorMessage(calendar.error))
            : undefined
        }
        empty={
          !calendar.isLoading && (calendar.data?.items.length ?? 0) === 0
        }
        emptyText={`No holidays recorded for ${ayLabel}.`}
        onRetry={() => void calendar.refetch()}
      />

      {monthGroups.map(([monthKey, list], gi) => {
        const sampleIso = `${monthKey}-01`;
        return (
          <FadeInView key={monthKey} delay={60 + gi * 50}>
            <View style={styles.monthBlock}>
              <View style={styles.monthHead}>
                <SectionLabel>{monthYearUpper(sampleIso)}</SectionLabel>
                <Text style={styles.monthCount}>
                  {list.length} {list.length === 1 ? "holiday" : "holidays"}
                </Text>
              </View>
              <View style={{ gap: space[2] }}>
                {list.map((h) => (
                  <HolidayRow key={h.id} holiday={h} />
                ))}
              </View>
            </View>
          </FadeInView>
        );
      })}
    </Screen>
    </View>
  );
}

const localRoot = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.white } });

function HolidayRow({ holiday }: { holiday: Holiday }) {
  const t = TYPE_TINT[holiday.type];
  return (
    <Card style={styles.holiday}>
      <View style={[styles.datePill, { backgroundColor: tints.peach.base }]}>
        <Text style={[styles.datePillDay, { color: tints.peach.deep }]}>
          {dayPad(holiday.holidayDate)}
        </Text>
        <Text style={[styles.datePillMon, { color: tints.peach.deep }]}>
          {monthShort(holiday.holidayDate)}
        </Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.holName} numberOfLines={2}>
          {holiday.name}
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.typeBadge, { backgroundColor: t.bg }]}>
            <Text style={[styles.typeBadgeText, { color: t.fg }]}>{t.label}</Text>
          </View>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.meta}>{holiday.isPaid ? "Paid" : "Unpaid"}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.meta}>{weekdayLong(holiday.holidayDate)}</Text>
        </View>
        {holiday.notes ? (
          <Text style={styles.notes} numberOfLines={2}>
            {holiday.notes}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

function StatTile({
  label,
  value,
  sub,
  icon,
  tint,
}: {
  label: string;
  value: number;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: { base: string; deep: string };
}) {
  return (
    <View style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: tint.base }]}>
        <Ionicons name={icon} size={16} color={tint.deep} />
      </View>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  crumb: {
    fontSize: fontSize.label,
    fontWeight: "800",
    color: colors.ink40,
    letterSpacing: 1.6,
  },
  title: {
    fontSize: fontSize.displayM,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.6,
  },
  titleAy: { color: colors.ink },
  titleDot: { color: colors.orange },
  sub: { fontSize: fontSize.bodyS, color: colors.ink60, lineHeight: 19 },

  yearRow: { gap: space[2], paddingVertical: 2 },
  yearChip: {
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  yearChipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  yearChipText: {
    fontSize: fontSize.bodyS,
    fontWeight: "700",
    color: colors.ink60,
  },
  yearChipTextActive: { color: colors.white },

  statsGrid: { flexDirection: "row", gap: space[3] },
  stat: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius[4],
    padding: space[4],
    gap: 6,
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: radius[2],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.ink40,
    letterSpacing: 1.4,
  },
  statValue: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  statSub: { fontSize: 11, color: colors.ink40 },

  monthBlock: { gap: space[2] },
  monthHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  monthCount: { fontSize: fontSize.bodyS, color: colors.ink40 },

  holiday: { flexDirection: "row", gap: space[3], alignItems: "center" },
  datePill: {
    width: 52,
    paddingVertical: space[2],
    borderRadius: radius[3],
    alignItems: "center",
  },
  datePillDay: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  datePillMon: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },

  holName: { fontSize: fontSize.bodyL, fontWeight: "700", color: colors.ink },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    flexWrap: "wrap",
  },
  typeBadge: {
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  metaDot: { color: colors.ink40, fontSize: fontSize.bodyS },
  meta: { fontSize: fontSize.bodyS, color: colors.ink60 },
  notes: { fontSize: fontSize.bodyS, color: colors.ink60, marginTop: 4 },
});
