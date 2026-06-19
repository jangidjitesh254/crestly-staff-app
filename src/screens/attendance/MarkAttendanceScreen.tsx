import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AttendanceStatus } from "../../types/api";
import { useMarkAttendance, useRoster, useSaveAttendance } from "../../hooks/queries";
import {
  Card,
  SavedToast,
  Screen,
  SectionLabel,
  Segmented,
  StateView,
  TextField,
} from "../../components/ui";
import { TopBar } from "../../components/TopBar";
import { PageHead } from "../../components/PageHead";
import { formatBreadcrumbDate } from "../../lib/dates";
import { getErrorMessage } from "../../lib/api";
import { formatLong } from "../../lib/dates";
import { colors, fontSize, radius, space, statusColor } from "../../theme";
import type { AttendanceStackParams } from "../../navigation/types";

type Props = NativeStackScreenProps<AttendanceStackParams, "MarkAttendance">;

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: "P" },
  { value: "absent", label: "A" },
  { value: "late", label: "L" },
  { value: "excused", label: "E" },
];

type Marks = Record<number, AttendanceStatus | null>;

export function MarkAttendanceScreen({ route, navigation }: Props) {
  const { date, classSlug, className, section } = route.params;
  const roster = useRoster(date, classSlug, section);
  const save = useSaveAttendance();
  const markOne = useMarkAttendance();
  const [marks, setMarks] = useState<Marks>({});
  const [savingSrs, setSavingSrs] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ visible: boolean; text: string }>({
    visible: false,
    text: "",
  });

  // Seed local marks from the server roster whenever it (re)loads.
  useEffect(() => {
    if (!roster.data) return;
    const seed: Marks = {};
    for (const r of roster.data.rows) seed[r.srNumber] = r.status;
    setMarks(seed);
  }, [roster.data]);

  const tally = useMemo(() => {
    const t = { present: 0, absent: 0, late: 0, excused: 0, notMarked: 0 };
    for (const r of roster.data?.rows ?? []) {
      const s = marks[r.srNumber];
      if (!s) t.notMarked++;
      else t[s]++;
    }
    return t;
  }, [marks, roster.data]);

  // Case-insensitive name filter. Acts on a stable view of the roster so the
  // tally above always reflects the full class, not the filtered subset.
  const filteredRows = useMemo(() => {
    const all = roster.data?.rows ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) => {
      const name = r.studentName.toLowerCase();
      const father = (r.fatherName ?? "").toLowerCase();
      return name.includes(q) || father.includes(q);
    });
  }, [roster.data, search]);

  /** Optimistic per-row save: tap → local update + fire POST /attendance/mark.
   *  On failure we revert the local state and tell the user. */
  function setOne(srNumber: number, status: AttendanceStatus) {
    const prev = marks[srNumber] ?? null;
    if (prev === status) return; // no-op: same status already
    setMarks((m) => ({ ...m, [srNumber]: status }));
    setSavingSrs((s) => {
      const n = new Set(s);
      n.add(srNumber);
      return n;
    });
    markOne
      .mutateAsync({ srNumber, date, status })
      .catch((err) => {
        setMarks((m) => ({ ...m, [srNumber]: prev }));
        Alert.alert("Couldn't save", getErrorMessage(err));
      })
      .finally(() => {
        setSavingSrs((s) => {
          const n = new Set(s);
          n.delete(srNumber);
          return n;
        });
      });
  }

  async function markAllPresent() {
    const rows = roster.data?.rows ?? [];
    if (rows.length === 0) return;
    // Locally optimistic + one bulk request.
    const previousMarks = { ...marks };
    setMarks((m) => {
      const next: Marks = { ...m };
      for (const r of rows) next[r.srNumber] = "present";
      return next;
    });
    try {
      const res = await save.mutateAsync({
        date,
        marks: rows.map((r) => ({ srNumber: r.srNumber, status: "present" as const })),
      });
      setToast({
        visible: true,
        text: `Marked ${res.count} present`,
      });
    } catch (err) {
      setMarks(previousMarks);
      Alert.alert("Couldn't mark all present", getErrorMessage(err));
    }
  }

  // Only show the error state when we have NO data to show — otherwise the
  // user sees stale-but-correct data while a background refetch is failing.
  const showError = !roster.data && !!roster.error;

  return (
    <View style={styles.fillParent}>
    <TopBar showBack onBack={() => navigation.goBack()} />
    <Screen
      refreshing={roster.isRefetching}
      onRefresh={() => void roster.refetch()}
    >
      <PageHead
        crumb={`${className} · ${section}`}
        date={formatBreadcrumbDate(date)}
        title="Mark Attendance"
        subtitle={`${formatLong(date)} · pick a status for each student.`}
      />
      <Card>
        <View style={styles.tallyRow}>
          <Tally label="Present" n={tally.present} c={statusColor.present} />
          <Tally label="Absent" n={tally.absent} c={statusColor.absent} />
          <Tally label="Late" n={tally.late} c={statusColor.late} />
          <Tally label="Excused" n={tally.excused} c={statusColor.excused} />
          <Tally
            label="Unmarked"
            n={tally.notMarked}
            c={{ bg: colors.cream, fg: colors.ink60 }}
          />
        </View>
      </Card>

      <StateView
        loading={roster.isLoading && !roster.data}
        error={showError ? new Error(getErrorMessage(roster.error)) : undefined}
        empty={!roster.isLoading && (roster.data?.rows.length ?? 0) === 0}
        emptyText="No active students in this section."
        onRetry={() => void roster.refetch()}
      />

      {roster.data && roster.data.rows.length > 0 ? (
        <>
          <View style={styles.searchRow}>
            <Ionicons
              name="search"
              size={18}
              color={colors.ink40}
              style={styles.searchIcon}
            />
            <TextField
              value={search}
              onChangeText={setSearch}
              placeholder="Search by student name"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={styles.searchInput}
            />
            {search ? (
              <Pressable
                onPress={() => setSearch("")}
                hitSlop={8}
                style={styles.searchClear}
              >
                <Ionicons name="close-circle" size={18} color={colors.ink40} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.toolRow}>
            <SectionLabel>
              {search
                ? `${filteredRows.length} of ${roster.data.rows.length} students`
                : `${roster.data.rows.length} students`}
            </SectionLabel>
            <Pressable onPress={markAllPresent} hitSlop={8}>
              <Text style={styles.allPresent}>Mark all present</Text>
            </Pressable>
          </View>

          {filteredRows.length === 0 ? (
            <Text style={styles.noMatch}>
              No students match "{search}".
            </Text>
          ) : null}

          {filteredRows.map((r) => (
            <Card key={r.srNumber} style={styles.row}>
              <View style={styles.rowHead}>
                <View style={styles.flex}>
                  <Text style={styles.name}>{r.studentName}</Text>
                  {r.fatherName ? (
                    <Text style={styles.father}>F/o {r.fatherName}</Text>
                  ) : null}
                </View>
                <Pressable
                  hitSlop={8}
                  onPress={() =>
                    navigation.navigate("StudentHistory", {
                      srNumber: r.srNumber,
                      studentName: r.studentName,
                    })
                  }
                >
                  <Ionicons name="time-outline" size={22} color={colors.ink40} />
                </Pressable>
              </View>
              <Segmented
                options={STATUS_OPTIONS.map((o) => ({
                  ...o,
                  activeBg: statusColor[o.value].bg,
                  activeFg: statusColor[o.value].fg,
                }))}
                value={marks[r.srNumber] ?? null}
                onChange={(s) => setOne(r.srNumber, s)}
              />
              {savingSrs.has(r.srNumber) ? (
                <View style={styles.savingRow}>
                  <ActivityIndicator size="small" color={colors.ink40} />
                  <Text style={styles.savingText}>saving…</Text>
                </View>
              ) : null}
            </Card>
          ))}

          <Text style={styles.autoSaveNote}>
            Changes save automatically as you tap each status.
          </Text>
        </>
      ) : null}
    </Screen>
    <SavedToast
      visible={toast.visible}
      text={toast.text}
      onHide={() => setToast({ visible: false, text: "" })}
    />
    </View>
  );
}

function Tally({
  label,
  n,
  c,
}: {
  label: string;
  n: number;
  c: { bg: string; fg: string };
}) {
  return (
    <View style={[styles.tally, { backgroundColor: c.bg }]}>
      <Text style={[styles.tallyN, { color: c.fg }]}>{n}</Text>
      <Text style={[styles.tallyL, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fillParent: { flex: 1 },
  flex: { flex: 1 },
  title: { fontSize: fontSize.h1, fontWeight: "800", color: colors.ink },
  date: { fontSize: fontSize.bodyS, color: colors.ink60 },
  tallyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space[2],
    marginTop: space[1],
  },
  tally: {
    borderRadius: radius[3],
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    minWidth: 58,
    alignItems: "center",
  },
  tallyN: { fontSize: fontSize.h2, fontWeight: "800" },
  tallyL: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },

  searchRow: { position: "relative", justifyContent: "center" },
  searchIcon: {
    position: "absolute",
    left: space[3],
    top: 15,
    zIndex: 1,
  },
  searchInput: { paddingLeft: 38, paddingRight: 36 },
  searchClear: { position: "absolute", right: space[3], top: 15, zIndex: 1 },
  noMatch: {
    fontSize: fontSize.bodyS,
    color: colors.ink60,
    textAlign: "center",
    padding: space[4],
  },

  toolRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  allPresent: {
    fontSize: fontSize.bodyS,
    fontWeight: "700",
    color: colors.orangeDeep,
  },

  row: { gap: space[3] },
  rowHead: { flexDirection: "row", alignItems: "center", gap: space[2] },
  name: { fontSize: fontSize.bodyL, fontWeight: "700", color: colors.ink },
  father: { fontSize: fontSize.bodyS, color: colors.ink60 },

  savingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[1],
    marginTop: space[1],
  },
  savingText: { fontSize: fontSize.cap, color: colors.ink40, fontStyle: "italic" },

  autoSaveNote: {
    fontSize: fontSize.bodyS,
    color: colors.ink40,
    textAlign: "center",
    fontStyle: "italic",
    marginTop: space[2],
  },
});
