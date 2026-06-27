/**
 * Test results — the roster of attempts for a published/closed test, with each
 * student's score and an overall average.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTestResults } from "../../hooks/queries";
import { Card, FadeInView, Screen, StateView } from "../../components/ui";
import { TopBar } from "../../components/TopBar";
import { PageHead } from "../../components/PageHead";
import { colors, fontSize, radius, space, tints } from "../../theme";
import type { MoreStackParams } from "../../navigation/types";
import type { TestResultRow } from "../../types/api";

type Props = NativeStackScreenProps<MoreStackParams, "TestResults">;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}
function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) +
    " · " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function TestResultsScreen({ route, navigation }: Props) {
  const { testId, title } = route.params;
  const results = useTestResults(testId);
  const d = results.data;
  const attempts = d?.attempts ?? [];
  const submitted = attempts.filter((a) => a.status === "submitted");

  return (
    <View style={styles.root}>
      <TopBar showBack onBack={() => navigation.goBack()} />
      <Screen refreshing={results.isFetching} onRefresh={() => void results.refetch()}>
        <PageHead crumb="Results" title={title} />

        {d ? (
          <FadeInView delay={0}>
            <View style={styles.hero}>
              <View style={styles.heroCol}>
                <Text style={styles.heroValue}>{submitted.length}</Text>
                <Text style={styles.heroLabel}>SUBMITTED</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroCol}>
                <Text style={styles.heroValue}>
                  {d.averagePct != null ? `${Math.round(d.averagePct)}%` : "—"}
                </Text>
                <Text style={styles.heroLabel}>AVERAGE</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroCol}>
                <Text style={styles.heroValue}>{d.totalMarks}</Text>
                <Text style={styles.heroLabel}>MAX MARKS</Text>
              </View>
            </View>
          </FadeInView>
        ) : null}

        {d?.passMarks != null ? (
          <Text style={styles.passNote}>Pass mark · {d.passMarks} / {d.totalMarks}</Text>
        ) : null}

        <StateView
          loading={results.isLoading}
          error={results.error}
          empty={!results.isLoading && !results.error && attempts.length === 0}
          emptyText="No attempts yet."
          onRetry={() => void results.refetch()}
        />

        {attempts.map((a, i) => (
          <FadeInView key={a.attemptId} delay={Math.min(40 + i * 30, 280)}>
            <AttemptRow row={a} />
          </FadeInView>
        ))}
      </Screen>
    </View>
  );
}

function AttemptRow({ row }: { row: TestResultRow }) {
  const done = row.status === "submitted";
  const pct = done && row.score != null && row.maxScore > 0
    ? Math.round((row.score / row.maxScore) * 100)
    : null;
  // Prefer the server's pass/fail verdict; fall back to a neutral score tone.
  const tone =
    row.passed === true ? tints.mint
    : row.passed === false ? tints.rose
    : pct == null ? tints.sky
    : tints.mint;

  return (
    <Card style={styles.row}>
      <View style={[styles.avi, { backgroundColor: tone.base }]}>
        <Text style={[styles.aviText, { color: tone.deep }]}>{initials(row.studentName)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.name} numberOfLines={1}>{row.studentName}</Text>
        <Text style={styles.meta}>
          {row.classLabel} · SR {row.srNumber} · {done ? fmtWhen(row.submittedAt) : "In progress"}
        </Text>
        {done && row.passed != null ? (
          <View style={[styles.passPill, { backgroundColor: tone.base }]}>
            <Text style={[styles.passText, { color: tone.deep }]}>
              {row.passed ? "PASS" : "FAIL"}
            </Text>
          </View>
        ) : null}
      </View>
      {done ? (
        <View style={styles.scoreBox}>
          <Text style={styles.score}>
            {row.score ?? 0}<Text style={styles.scoreMax}>/{row.maxScore}</Text>
          </Text>
          {pct != null ? <Text style={[styles.pct, { color: tone.deep }]}>{pct}%</Text> : null}
        </View>
      ) : (
        <View style={styles.inProgress}>
          <Ionicons name="hourglass-outline" size={14} color={tints.sky.deep} />
          <Text style={styles.inProgressText}>Live</Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },

  hero: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.ink, borderRadius: 22, paddingVertical: space[4],
  },
  heroCol: { flex: 1, alignItems: "center", gap: 4 },
  heroValue: { fontSize: fontSize.displayS, fontWeight: "900", color: colors.white, letterSpacing: -0.5 },
  heroLabel: { fontSize: 9.5, fontWeight: "800", color: "rgba(255,255,255,0.55)", letterSpacing: 1.2 },
  heroDivider: { width: 1, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.12)", marginVertical: space[2] },

  row: { flexDirection: "row", alignItems: "center", gap: space[3] },
  avi: { width: 42, height: 42, borderRadius: radius[3], alignItems: "center", justifyContent: "center" },
  aviText: { fontSize: fontSize.body, fontWeight: "800" },
  name: { fontSize: fontSize.bodyL, fontWeight: "800", color: colors.ink },
  meta: { fontSize: fontSize.bodyS, color: colors.ink60, marginTop: 2, fontWeight: "600" },
  passPill: { alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: 2, marginTop: 4 },
  passText: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.8 },
  passNote: { fontSize: fontSize.bodyS, color: colors.ink60, fontWeight: "700", textAlign: "center" },

  scoreBox: { alignItems: "flex-end" },
  score: { fontSize: fontSize.h1, fontWeight: "900", color: colors.ink, letterSpacing: -0.4 },
  scoreMax: { fontSize: fontSize.bodyS, fontWeight: "800", color: colors.ink40 },
  pct: { fontSize: fontSize.bodyS, fontWeight: "800" },

  inProgress: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: tints.sky.base, borderRadius: radius.pill,
    paddingHorizontal: space[2], paddingVertical: 4,
  },
  inProgressText: { fontSize: fontSize.bodyS, fontWeight: "800", color: tints.sky.deep },
});
