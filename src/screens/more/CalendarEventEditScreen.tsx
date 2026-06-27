/**
 * Create / edit a calendar event. Maps directly onto CalendarEventUpsert.
 *
 * The staff app doesn't bundle a native date picker, so dates use a ±1-day
 * stepper (seeded to today / the event's date) with quick "today" + week
 * jumps; times are HH:MM text fields shown only when the event isn't all-day.
 */
import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  useCalendarEvent,
  useClasses,
  useDeleteCalendarEvent,
  useSaveCalendarEvent,
} from "../../hooks/queries";
import { Button, Card, Screen, StateView, Stepper, TextField } from "../../components/ui";
import { TopBar } from "../../components/TopBar";
import { PageHead } from "../../components/PageHead";
import { getErrorMessage } from "../../lib/api";
import { addDays, formatLong, todayIso } from "../../lib/dates";
import { colors, fontSize, radius, space } from "../../theme";
import type { MoreStackParams } from "../../navigation/types";
import type { CalendarAudience, CalendarCategory, CalendarEventUpsert } from "../../types/api";

type Props = NativeStackScreenProps<MoreStackParams, "CalendarEventEdit">;

const CATEGORIES: CalendarCategory[] = [
  "event", "ptm", "function", "activity", "sports",
  "exam", "fee", "meeting", "notice", "holiday", "other",
];
const AUDIENCES: { value: CalendarAudience; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "staff", label: "Staff" },
  { value: "parents", label: "Parents" },
];

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

export function CalendarEventEditScreen({ route, navigation }: Props) {
  const eventId = route.params?.eventId ?? null;
  const editing = eventId != null;
  const existing = useCalendarEvent(eventId);
  const classes = useClasses();
  const save = useSaveCalendarEvent();
  const del = useDeleteCalendarEvent();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CalendarCategory>("event");
  const [startDate, setStartDate] = useState(todayIso());
  const [hasEnd, setHasEnd] = useState(false);
  const [endDate, setEndDate] = useState(todayIso());
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isHoliday, setIsHoliday] = useState(false);
  const [audience, setAudience] = useState<CalendarAudience>("all");
  const [classSlug, setClassSlug] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Populate the form once when editing.
  useEffect(() => {
    const e = existing.data;
    if (!editing || hydrated || !e) return;
    setTitle(e.title);
    setDescription(e.description ?? "");
    setCategory(e.category);
    setStartDate(e.startDate);
    setHasEnd(!!e.endDate);
    setEndDate(e.endDate ?? e.startDate);
    setAllDay(e.allDay);
    setStartTime(e.startTime ?? "");
    setEndTime(e.endTime ?? "");
    setIsHoliday(e.isHoliday);
    setAudience(e.audience);
    setClassSlug(e.classSlug);
    setHydrated(true);
  }, [existing.data, editing, hydrated]);

  function onSave() {
    if (!title.trim()) {
      Alert.alert("Title required", "Give the event a short title.");
      return;
    }
    if (!allDay) {
      if (startTime && !TIME_RE.test(startTime)) {
        Alert.alert("Invalid time", "Start time must be HH:MM (24-hour), e.g. 10:00.");
        return;
      }
      if (endTime && !TIME_RE.test(endTime)) {
        Alert.alert("Invalid time", "End time must be HH:MM (24-hour), e.g. 13:00.");
        return;
      }
    }
    if (hasEnd && endDate < startDate) {
      Alert.alert("Check dates", "End date can't be before the start date.");
      return;
    }

    const body: CalendarEventUpsert = {
      title: title.trim(),
      description: description.trim() ? description.trim() : null,
      category,
      startDate,
      endDate: hasEnd ? endDate : null,
      allDay,
      startTime: allDay ? null : startTime || null,
      endTime: allDay ? null : endTime || null,
      isHoliday,
      audience,
      classSlug,
      location: null,
    };

    save.mutate(
      { id: eventId, body },
      {
        onSuccess: () => navigation.goBack(),
        onError: (e) => Alert.alert("Couldn't save", getErrorMessage(e)),
      },
    );
  }

  function onDelete() {
    if (eventId == null) return;
    Alert.alert("Delete event?", "This removes the event from everyone's calendar.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          del.mutate(eventId, {
            onSuccess: () => navigation.goBack(),
            onError: (e) => Alert.alert("Couldn't delete", getErrorMessage(e)),
          }),
      },
    ]);
  }

  if (editing && existing.isLoading) {
    return (
      <View style={styles.root}>
        <TopBar showBack onBack={() => navigation.goBack()} />
        <Screen><StateView loading /></Screen>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <TopBar showBack onBack={() => navigation.goBack()} />
      <Screen>
        <PageHead crumb="Calendar" title={editing ? "Edit event" : "New event"} />

        <Card style={{ gap: space[4] }}>
          <TextField label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Annual Sports Day" />
          <TextField
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Optional details"
            multiline
            style={styles.textArea}
          />

          {/* Category */}
          <View style={{ gap: space[2] }}>
            <Text style={styles.label}>CATEGORY</Text>
            <View style={styles.chipWrap}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[styles.chip, category === c && styles.chipActive]}
                >
                  <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Card>

        {/* Schedule */}
        <Card style={{ gap: space[4] }}>
          <View style={{ gap: space[2] }}>
            <View style={styles.dateLabelRow}>
              <Text style={styles.label}>START DATE</Text>
              <Pressable onPress={() => setStartDate(todayIso())} hitSlop={6}>
                <Text style={styles.quick}>Today</Text>
              </Pressable>
            </View>
            <Stepper
              label={formatLong(startDate)}
              onPrev={() => setStartDate((d) => addDays(d, -1))}
              onNext={() => setStartDate((d) => addDays(d, 1))}
            />
            <Pressable onPress={() => setStartDate((d) => addDays(d, 7))} hitSlop={6} style={styles.weekJump}>
              <Text style={styles.quick}>+1 week ›</Text>
            </Pressable>
          </View>

          <ToggleRow label="Multi-day event" value={hasEnd} onValueChange={(v) => { setHasEnd(v); if (v && endDate < startDate) setEndDate(startDate); }} />
          {hasEnd ? (
            <View style={{ gap: space[2] }}>
              <Text style={styles.label}>END DATE</Text>
              <Stepper
                label={formatLong(endDate)}
                onPrev={() => setEndDate((d) => addDays(d, -1))}
                onNext={() => setEndDate((d) => addDays(d, 1))}
              />
            </View>
          ) : null}

          <ToggleRow label="All day" value={allDay} onValueChange={setAllDay} />
          {!allDay ? (
            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <TextField label="Start (HH:MM)" value={startTime} onChangeText={setStartTime} placeholder="10:00" keyboardType="numbers-and-punctuation" />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="End (HH:MM)" value={endTime} onChangeText={setEndTime} placeholder="13:00" keyboardType="numbers-and-punctuation" />
              </View>
            </View>
          ) : null}

          <ToggleRow label="Mark as holiday (non-working day)" value={isHoliday} onValueChange={setIsHoliday} />
        </Card>

        {/* Audience + class */}
        <Card style={{ gap: space[4] }}>
          <View style={{ gap: space[2] }}>
            <Text style={styles.label}>VISIBLE TO</Text>
            <View style={styles.segmented}>
              {AUDIENCES.map((a) => (
                <Pressable
                  key={a.value}
                  onPress={() => setAudience(a.value)}
                  style={[styles.segment, audience === a.value && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, audience === a.value && styles.segmentTextActive]}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ gap: space[2] }}>
            <Text style={styles.label}>CLASS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <Pressable onPress={() => setClassSlug(null)} style={[styles.chip, classSlug == null && styles.chipActive]}>
                <Text style={[styles.chipText, classSlug == null && styles.chipTextActive]}>School-wide</Text>
              </Pressable>
              {(classes.data ?? []).map((c) => (
                <Pressable key={c.id} onPress={() => setClassSlug(c.slug)} style={[styles.chip, classSlug === c.slug && styles.chipActive]}>
                  <Text style={[styles.chipText, classSlug === c.slug && styles.chipTextActive]}>{c.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Card>

        <Button label={save.isPending ? "Saving…" : editing ? "Save changes" : "Create event"} onPress={onSave} loading={save.isPending} />
        {editing ? (
          <Button label={del.isPending ? "Deleting…" : "Delete event"} onPress={onDelete} variant="danger" loading={del.isPending} />
        ) : null}
      </Screen>
    </View>
  );
}

function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.creamDeep, true: colors.orangeSoft }}
        thumbColor={value ? colors.orange : colors.white}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  label: { fontSize: fontSize.label, fontWeight: "800", color: colors.ink40, letterSpacing: 1.2 },
  textArea: { minHeight: 90, paddingTop: space[3], textAlignVertical: "top" },

  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  chipRow: { gap: space[2] },
  chip: {
    paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: radius.pill,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.rule,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: fontSize.bodyS, fontWeight: "700", color: colors.ink60, textTransform: "capitalize" },
  chipTextActive: { color: colors.white },

  dateLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  quick: { fontSize: fontSize.bodyS, fontWeight: "800", color: colors.orangeDeep },
  weekJump: { alignSelf: "flex-end" },

  timeRow: { flexDirection: "row", gap: space[3] },

  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3] },
  toggleLabel: { flex: 1, fontSize: fontSize.body, fontWeight: "700", color: colors.ink },

  segmented: { flexDirection: "row", backgroundColor: colors.cream, borderRadius: radius[3], padding: 3, gap: 3 },
  segment: { flex: 1, minHeight: 38, borderRadius: radius[2], alignItems: "center", justifyContent: "center" },
  segmentActive: { backgroundColor: colors.orange },
  segmentText: { fontSize: fontSize.bodyS, fontWeight: "700", color: colors.ink60 },
  segmentTextActive: { color: colors.white },
});
