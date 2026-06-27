/**
 * Diary day editor — the period grid for a class/section on a date. Each period
 * card carries the topic taught + homework; saving upserts that one period via
 * POST /diary. Your own periods are badged; you can still fill any period.
 */
import React, { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../../store/auth";
import { useDiaryDay, useSaveDiary } from "../../hooks/queries";
import { Button, Card, FadeInView, Screen, StateView, TextField } from "../../components/ui";
import { TopBar } from "../../components/TopBar";
import { PageHead } from "../../components/PageHead";
import { InfoCard } from "../../components/InfoCard";
import { getErrorMessage } from "../../lib/api";
import { formatLong } from "../../lib/dates";
import { colors, fontSize, radius, space, tints } from "../../theme";
import type { MoreStackParams } from "../../navigation/types";
import type { DiaryEntry } from "../../types/api";

type Props = NativeStackScreenProps<MoreStackParams, "DiaryDay">;

export function DiaryDayScreen({ route, navigation }: Props) {
  const { date, classSlug, className, section } = route.params;
  const { user } = useAuth();
  const day = useDiaryDay(classSlug, section, date);
  const d = day.data;

  return (
    <View style={styles.root}>
      <TopBar showBack onBack={() => navigation.goBack()} />
      <Screen refreshing={day.isFetching} onRefresh={() => void day.refetch()}>
        <PageHead
          crumb="Diary"
          title={`${className} · ${section}`}
          subtitle={formatLong(date)}
        />

        {d?.isHoliday ? (
          <InfoCard
            variant="warn"
            lead={d.holidayName ?? "Holiday."}
            body="This is a non-working day. You can still log a diary note if needed."
          />
        ) : null}

        <StateView
          loading={day.isLoading}
          error={day.error}
          empty={!day.isLoading && !day.error && (d?.entries.length ?? 0) === 0}
          emptyText="No periods scheduled for this section on this day."
          onRetry={() => void day.refetch()}
        />

        {(d?.entries ?? []).map((e, i) => {
          const own = e.teacherUserId != null && e.teacherUserId === user?.id;
          return (
            <FadeInView key={e.periodId ?? `idx-${i}`} delay={Math.min(i * 40, 240)}>
              {own ? (
                <DiaryPeriodCard entry={e} date={date} classSlug={classSlug} section={section} />
              ) : (
                <ReadOnlyPeriodCard entry={e} />
              )}
            </FadeInView>
          );
        })}

        {d && d.entries.length > 0 ? (
          <Text style={styles.note}>You can only edit the periods you teach — tap Save under each one.</Text>
        ) : null}
      </Screen>
    </View>
  );
}

/** A period the signed-in teacher teaches — fully editable. */
function DiaryPeriodCard({
  entry,
  date,
  classSlug,
  section,
}: {
  entry: DiaryEntry;
  date: string;
  classSlug: string;
  section: string;
}) {
  const save = useSaveDiary();
  const [topic, setTopic] = useState(entry.topic ?? "");
  const [homework, setHomework] = useState(entry.homework ?? "");
  const [baseTopic, setBaseTopic] = useState(entry.topic ?? "");
  const [baseHw, setBaseHw] = useState(entry.homework ?? "");

  const lockable = entry.periodId == null;
  const dirty = topic !== baseTopic || homework !== baseHw;
  const saved = !dirty && baseTopic.trim().length > 0;
  const canSave = !lockable && topic.trim().length > 0 && dirty && !save.isPending;

  const time =
    entry.startTime && entry.endTime
      ? `${entry.startTime.slice(0, 5)}–${entry.endTime.slice(0, 5)}`
      : null;

  function onSave() {
    if (entry.periodId == null) return;
    const t = topic.trim();
    const hw = homework.trim();
    save.mutate(
      { classSlug, sectionCode: section, diaryDate: date, periodId: entry.periodId, topic: t, homework: hw ? hw : null },
      {
        onSuccess: () => {
          setTopic(t);
          setHomework(hw);
          setBaseTopic(t);
          setBaseHw(hw);
        },
        onError: (e) => Alert.alert("Couldn't save", getErrorMessage(e)),
      },
    );
  }

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={styles.periodPill}>
          <Text style={styles.periodPillText}>{entry.periodName ?? `P${entry.periodNo ?? ""}`}</Text>
          {time ? <Text style={styles.periodTime}>{time}</Text> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.subject} numberOfLines={1}>{entry.subjectName ?? "—"}</Text>
          {entry.teacherName ? (
            <Text style={styles.teacher} numberOfLines={1}>{entry.teacherName}</Text>
          ) : null}
        </View>
        <View style={styles.ownBadge}>
          <Text style={styles.ownBadgeText}>YOUR PERIOD</Text>
        </View>
        {saved ? <Ionicons name="checkmark-circle" size={20} color={tints.mint.deep} /> : null}
      </View>

      <TextField
        label="Taught"
        value={topic}
        onChangeText={setTopic}
        placeholder="Topic covered this period"
        multiline
        maxLength={600}
        style={styles.area}
      />
      <TextField
        label="Homework"
        value={homework}
        onChangeText={setHomework}
        placeholder="Optional — what to do at home"
        multiline
        maxLength={1200}
        style={styles.area}
      />

      <Button
        label={save.isPending ? "Saving…" : saved ? "Saved" : "Save"}
        onPress={onSave}
        loading={save.isPending}
        disabled={!canSave}
        variant={saved ? "secondary" : "primary"}
      />
    </Card>
  );
}

/** A period taught by someone else — shown for context, never editable. */
function ReadOnlyPeriodCard({ entry }: { entry: DiaryEntry }) {
  const time =
    entry.startTime && entry.endTime
      ? `${entry.startTime.slice(0, 5)}–${entry.endTime.slice(0, 5)}`
      : null;
  const hasTopic = entry.topic.trim().length > 0;
  return (
    <Card style={{ ...styles.card, ...styles.roCard }}>
      <View style={styles.head}>
        <View style={[styles.periodPill, styles.roPill]}>
          <Text style={styles.roPillText}>{entry.periodName ?? `P${entry.periodNo ?? ""}`}</Text>
          {time ? <Text style={styles.roPillTime}>{time}</Text> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.subject} numberOfLines={1}>{entry.subjectName ?? "—"}</Text>
          {entry.teacherName ? (
            <Text style={styles.teacher} numberOfLines={1}>{entry.teacherName}</Text>
          ) : null}
        </View>
        <Ionicons name="lock-closed" size={15} color={colors.ink40} />
      </View>
      {hasTopic ? (
        <View style={{ gap: space[1] }}>
          <Text style={styles.roLabel}>TAUGHT</Text>
          <Text style={styles.roText}>{entry.topic}</Text>
          {entry.homework && entry.homework.trim() ? (
            <>
              <Text style={[styles.roLabel, { marginTop: space[2] }]}>HOMEWORK</Text>
              <Text style={styles.roText}>{entry.homework}</Text>
            </>
          ) : null}
        </View>
      ) : (
        <Text style={styles.roEmpty}>Not logged yet by this period's teacher.</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },

  card: { gap: space[3] },
  head: { flexDirection: "row", alignItems: "center", gap: space[3] },
  periodPill: {
    minWidth: 52,
    paddingHorizontal: space[2],
    paddingVertical: space[2],
    borderRadius: radius[3],
    backgroundColor: tints.wheat.base,
    alignItems: "center",
  },
  periodPillText: { fontSize: fontSize.bodyS, fontWeight: "800", color: tints.wheat.deep },
  periodTime: { fontSize: 9.5, fontWeight: "700", color: tints.wheat.deep, marginTop: 1 },
  subject: { fontSize: fontSize.bodyL, fontWeight: "800", color: colors.ink },
  teacher: { fontSize: fontSize.bodyS, color: colors.ink60, marginTop: 1, fontWeight: "600" },
  ownBadge: {
    backgroundColor: tints.mint.base,
    borderRadius: radius.pill,
    paddingHorizontal: space[2],
    paddingVertical: 3,
  },
  ownBadgeText: { fontSize: 9, fontWeight: "800", color: tints.mint.deep, letterSpacing: 0.8 },

  area: { minHeight: 64, paddingTop: space[3], textAlignVertical: "top" },

  /* Read-only (other teachers' periods) */
  roCard: { backgroundColor: colors.creamSoft },
  roPill: { backgroundColor: "#EDEAE3" },
  roPillText: { fontSize: fontSize.bodyS, fontWeight: "800", color: colors.ink60 },
  roPillTime: { fontSize: 9.5, fontWeight: "700", color: colors.ink40, marginTop: 1 },
  roLabel: { fontSize: fontSize.label, fontWeight: "800", color: colors.ink40, letterSpacing: 0.8 },
  roText: { fontSize: fontSize.body, color: colors.ink80, lineHeight: 19 },
  roEmpty: { fontSize: fontSize.bodyS, color: colors.ink40, fontStyle: "italic" },

  note: { fontSize: fontSize.bodyS, color: colors.ink40, textAlign: "center", fontStyle: "italic" },
});
