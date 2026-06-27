/**
 * School Calendar (staff) — the merged feed (events + holidays + exams) for a
 * month, with an optional class filter. Staff can add new events and tap an
 * editable row (their own events) to edit or delete it; holidays and exam
 * datesheet rows come from other modules and are read-only here.
 */
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCalendarFeed, useClasses } from "../../hooks/queries";
import { Card, FadeInView, Screen, StateView, Stepper } from "../../components/ui";
import { TopBar } from "../../components/TopBar";
import { PageHead } from "../../components/PageHead";
import { dayPad, monthShort, weekdayLong } from "../../lib/dates";
import { colors, fontSize, radius, space, tints } from "../../theme";
import type { MoreStackParams } from "../../navigation/types";
import type { CalendarCategory, CalendarFeedItem } from "../../types/api";

type Props = NativeStackScreenProps<MoreStackParams, "Calendar">;
type Tint = { base: string; deep: string };

const CATEGORY: Record<CalendarCategory, { tint: Tint; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  event: { tint: tints.sky, icon: "sparkles-outline", label: "Event" },
  ptm: { tint: tints.peach, icon: "people-outline", label: "PTM" },
  function: { tint: tints.rose, icon: "musical-notes-outline", label: "Function" },
  activity: { tint: tints.mint, icon: "color-palette-outline", label: "Activity" },
  sports: { tint: tints.mustard, icon: "football-outline", label: "Sports" },
  exam: { tint: tints.rose, icon: "school-outline", label: "Exam" },
  fee: { tint: tints.peach, icon: "wallet-outline", label: "Fee" },
  meeting: { tint: tints.sky, icon: "chatbubbles-outline", label: "Meeting" },
  notice: { tint: tints.wheat, icon: "megaphone-outline", label: "Notice" },
  holiday: { tint: tints.mint, icon: "sunny-outline", label: "Holiday" },
  other: { tint: tints.wheat, icon: "ellipse-outline", label: "Other" },
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (d: Date) => `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;

export function CalendarScreen({ navigation }: Props) {
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const month = monthKey(cursor);
  const classes = useClasses();
  const feed = useCalendarFeed(month, classFilter);

  function step(delta: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  const days = useMemo(() => {
    const map = new Map<string, CalendarFeedItem[]>();
    for (const it of feed.data?.items ?? []) {
      const bucket = map.get(it.date);
      if (bucket) bucket.push(it);
      else map.set(it.date, [it]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [feed.data]);

  return (
    <View style={styles.root}>
      <TopBar showBack onBack={() => navigation.goBack()} />
      <Screen refreshing={feed.isFetching} onRefresh={() => void feed.refetch()}>
        <PageHead crumb="School" title="Calendar" subtitle="Events, holidays & exams." />

        {/* New event */}
        <Pressable
          onPress={() => navigation.navigate("CalendarEventEdit", {})}
          android_ripple={{ color: "rgba(255,255,255,0.18)" }}
          style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.9 }]}
        >
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={styles.newText}>New event</Text>
        </Pressable>

        <Stepper label={monthLabel(cursor)} onPrev={() => step(-1)} onNext={() => step(1)} />

        {/* Class filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <FilterChip label="All classes" active={classFilter == null} onPress={() => setClassFilter(null)} />
          {(classes.data ?? []).map((c) => (
            <FilterChip
              key={c.id}
              label={c.name}
              active={classFilter === c.slug}
              onPress={() => setClassFilter(c.slug)}
            />
          ))}
        </ScrollView>

        <StateView
          loading={feed.isLoading}
          error={feed.error}
          empty={!feed.isLoading && !feed.error && days.length === 0}
          emptyText="Nothing on the calendar this month."
          onRetry={() => void feed.refetch()}
        />

        {days.map(([date, items], gi) => (
          <FadeInView key={date} delay={Math.min(gi * 40, 240)}>
            <View style={styles.dayBlock}>
              <View style={styles.dayHead}>
                <View style={styles.datePill}>
                  <Text style={styles.datePillDay}>{dayPad(date)}</Text>
                  <Text style={styles.datePillMon}>{monthShort(date)}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.dayWeekday}>{weekdayLong(date)}</Text>
                  <Text style={styles.dayCount}>
                    {items.length} {items.length === 1 ? "entry" : "entries"}
                  </Text>
                </View>
                {items.some((i) => i.isHoliday) ? (
                  <View style={styles.offBadge}>
                    <Text style={styles.offBadgeText}>HOLIDAY</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ gap: space[2] }}>
                {items.map((it) => (
                  <CalRow
                    key={it.key}
                    item={it}
                    onEdit={
                      it.editable
                        ? () => navigation.navigate("CalendarEventEdit", { eventId: it.refId })
                        : undefined
                    }
                  />
                ))}
              </View>
            </View>
          </FadeInView>
        ))}
      </Screen>
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function timeRange(it: CalendarFeedItem): string | null {
  if (it.allDay) return "All day";
  if (!it.startTime) return null;
  return it.endTime ? `${it.startTime}–${it.endTime}` : it.startTime;
}

function CalRow({ item, onEdit }: { item: CalendarFeedItem; onEdit?: () => void }) {
  const c = CATEGORY[item.category] ?? CATEGORY.other;
  const tint = item.isHoliday ? { base: colors.cream, deep: colors.ink60 } : c.tint;
  const t = timeRange(item);
  const multiDay = item.endDate && item.endDate !== item.date;

  return (
    <Card style={styles.row} onPress={onEdit}>
      <View style={[styles.rowAccent, { backgroundColor: tint.deep }]} />
      <View style={[styles.rowIcon, { backgroundColor: tint.base }]}>
        <Ionicons name={c.icon} size={18} color={tint.deep} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.rowTags}>
          <View style={[styles.catChip, { backgroundColor: tint.base }]}>
            <Text style={[styles.catChipText, { color: tint.deep }]}>{c.label.toUpperCase()}</Text>
          </View>
          <Text style={styles.scope}>{item.classLabel ?? "School-wide"}</Text>
          {item.audience !== "all" ? (
            <Text style={styles.audience}>{item.audience.toUpperCase()}</Text>
          ) : null}
        </View>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        {(t || item.location || multiDay) ? (
          <View style={styles.metaRow}>
            {t ? <MetaBit icon="time-outline" text={t} /> : null}
            {multiDay ? <MetaBit icon="calendar-outline" text={`till ${dayPad(item.endDate!)} ${monthShort(item.endDate!)}`} /> : null}
            {item.location ? <MetaBit icon="location-outline" text={item.location} /> : null}
          </View>
        ) : null}
      </View>
      {onEdit ? <Ionicons name="create-outline" size={18} color={colors.ink40} /> : null}
    </Card>
  );
}

function MetaBit({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={12} color={colors.ink40} />
      <Text style={styles.metaText} numberOfLines={1}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },

  newBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: colors.orange, borderRadius: radius[3], paddingVertical: space[3],
  },
  newText: { color: colors.white, fontSize: fontSize.bodyL, fontWeight: "800" },

  filterRow: { gap: space[2], paddingVertical: 2 },
  filterChip: {
    paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: radius.pill,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.rule,
  },
  filterChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  filterChipText: { fontSize: fontSize.bodyS, fontWeight: "700", color: colors.ink60 },
  filterChipTextActive: { color: colors.white },

  dayBlock: { gap: space[2] },
  dayHead: { flexDirection: "row", alignItems: "center", gap: space[3], marginTop: space[2] },
  datePill: {
    width: 50, paddingVertical: space[2], borderRadius: radius[3],
    alignItems: "center", backgroundColor: colors.ink,
  },
  datePillDay: { fontSize: 17, fontWeight: "800", color: colors.white, letterSpacing: -0.3 },
  datePillMon: { fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.7)", letterSpacing: 0.6 },
  dayWeekday: { fontSize: fontSize.bodyL, fontWeight: "800", color: colors.ink, letterSpacing: -0.2 },
  dayCount: { fontSize: fontSize.bodyS, color: colors.ink60, marginTop: 1, fontWeight: "600" },
  offBadge: { backgroundColor: tints.mint.base, borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: 3 },
  offBadgeText: { fontSize: 9.5, fontWeight: "800", color: tints.mint.deep, letterSpacing: 1.2 },

  row: { flexDirection: "row", alignItems: "center", gap: space[3], overflow: "hidden" },
  rowAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  rowIcon: { width: 40, height: 40, borderRadius: radius[3], alignItems: "center", justifyContent: "center", marginLeft: 2 },
  rowTags: { flexDirection: "row", alignItems: "center", gap: space[2], flexWrap: "wrap" },
  catChip: { borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: 2 },
  catChipText: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.8 },
  scope: { fontSize: fontSize.label, fontWeight: "700", color: colors.ink40, letterSpacing: 0.3 },
  audience: { fontSize: 9, fontWeight: "800", color: colors.orangeDeep, letterSpacing: 0.6 },
  title: { fontSize: fontSize.body, fontWeight: "800", color: colors.ink, marginTop: 3 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space[3], marginTop: 4 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "100%" },
  metaText: { fontSize: fontSize.bodyS, color: colors.ink60, fontWeight: "600" },
});
