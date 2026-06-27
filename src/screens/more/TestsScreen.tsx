/**
 * Tests (staff) — author MCQ / fill-in-the-blank tests, publish them to a
 * class, then track attempts. Drafts can be edited & published; published
 * tests can be closed; results are available once published.
 */
import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useDeleteTest, useTestAction, useTestsList } from "../../hooks/queries";
import { Card, FadeInView, Screen, StateView } from "../../components/ui";
import { TopBar } from "../../components/TopBar";
import { PageHead } from "../../components/PageHead";
import { getErrorMessage } from "../../lib/api";
import { colors, fontSize, radius, space, tints } from "../../theme";
import type { MoreStackParams } from "../../navigation/types";
import type { TestListItem, TestStatus } from "../../types/api";

type Props = NativeStackScreenProps<MoreStackParams, "Tests">;
type Tint = { base: string; deep: string };

const STATUS_TINT: Record<TestStatus, Tint> = {
  draft: { base: colors.cream, deep: colors.ink60 },
  published: tints.mint,
  closed: tints.peach,
};
const FILTERS: { value: TestStatus | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "published", label: "Published" },
  { value: "closed", label: "Closed" },
];

export function TestsScreen({ navigation }: Props) {
  const [filter, setFilter] = useState<TestStatus | null>(null);
  const tests = useTestsList(filter ?? undefined);
  const action = useTestAction();
  const del = useDeleteTest();
  const list = tests.data ?? [];

  function publish(t: TestListItem) {
    Alert.alert("Publish test?", `“${t.title}” will become visible to ${t.classSlug.toUpperCase()} and students can attempt it.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Publish",
        onPress: () =>
          action.mutate({ id: t.id, action: "publish" }, { onError: (e) => Alert.alert("Couldn't publish", getErrorMessage(e)) }),
      },
    ]);
  }
  function close(t: TestListItem) {
    Alert.alert("Close test?", "Students won't be able to attempt it anymore.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Close",
        style: "destructive",
        onPress: () =>
          action.mutate({ id: t.id, action: "close" }, { onError: (e) => Alert.alert("Couldn't close", getErrorMessage(e)) }),
      },
    ]);
  }
  function remove(t: TestListItem) {
    Alert.alert("Delete test?", `“${t.title}” will be permanently removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          del.mutate(t.id, { onError: (e) => Alert.alert("Couldn't delete", getErrorMessage(e)) }),
      },
    ]);
  }

  return (
    <View style={styles.root}>
      <TopBar showBack onBack={() => navigation.goBack()} />
      <Screen refreshing={tests.isFetching} onRefresh={() => void tests.refetch()}>
        <PageHead crumb="School" title="Tests" subtitle="Create & publish MCQ / fill-blank tests." />

        <Pressable
          onPress={() => navigation.navigate("TestEdit", {})}
          android_ripple={{ color: "rgba(255,255,255,0.18)" }}
          style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.9 }]}
        >
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={styles.newText}>New test</Text>
        </Pressable>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.label}
              onPress={() => setFilter(f.value)}
              style={[styles.filterChip, filter === f.value && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, filter === f.value && styles.filterChipTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <StateView
          loading={tests.isLoading}
          error={tests.error}
          empty={!tests.isLoading && !tests.error && list.length === 0}
          emptyText="No tests yet. Tap New test to create one."
          onRetry={() => void tests.refetch()}
        />

        {list.map((t, i) => (
          <FadeInView key={t.id} delay={Math.min(i * 50, 240)}>
            <TestRow
              test={t}
              busy={action.isPending || del.isPending}
              onEdit={() => navigation.navigate("TestEdit", { testId: t.id })}
              onResults={() => navigation.navigate("TestResults", { testId: t.id, title: t.title })}
              onPublish={() => publish(t)}
              onClose={() => close(t)}
              onDelete={() => remove(t)}
            />
          </FadeInView>
        ))}
      </Screen>
    </View>
  );
}

function TestRow({
  test,
  busy,
  onEdit,
  onResults,
  onPublish,
  onClose,
  onDelete,
}: {
  test: TestListItem;
  busy: boolean;
  onEdit: () => void;
  onResults: () => void;
  onPublish: () => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const tint = STATUS_TINT[test.status];
  const draft = test.status === "draft";
  const published = test.status === "published";

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.classLine}>
            {test.classSlug.toUpperCase()}
            {test.sectionCode ? `-${test.sectionCode}` : ""}
            {test.subjectName ? ` · ${test.subjectName}` : ""}
          </Text>
          <Text style={styles.title} numberOfLines={2}>{test.title}</Text>
        </View>
        <View style={[styles.statusChip, { backgroundColor: tint.base }]}>
          <Text style={[styles.statusText, { color: tint.deep }]}>{test.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Meta icon="help-circle-outline" text={`${test.questionCount} Qs`} />
        <Meta icon="ribbon-outline" text={`${test.totalMarks} marks`} />
        {test.passMarks != null ? <Meta icon="flag-outline" text={`Pass ${test.passMarks}`} /> : null}
        <Meta icon="people-outline" text={`${test.attemptCount} attempts`} />
      </View>

      <View style={styles.actions}>
        {draft ? <ActionBtn icon="create-outline" label="Edit" onPress={onEdit} disabled={busy} /> : null}
        {draft ? <ActionBtn icon="rocket-outline" label="Publish" tone="primary" onPress={onPublish} disabled={busy} /> : null}
        {!draft ? <ActionBtn icon="bar-chart-outline" label="Results" onPress={onResults} disabled={busy} /> : null}
        {published ? <ActionBtn icon="lock-closed-outline" label="Close" onPress={onClose} disabled={busy} /> : null}
        {draft ? <ActionBtn icon="trash-outline" label="Delete" tone="danger" onPress={onDelete} disabled={busy} /> : null}
      </View>
    </Card>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={13} color={colors.ink40} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

function ActionBtn({
  icon,
  label,
  onPress,
  tone = "neutral",
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: "neutral" | "primary" | "danger";
  disabled?: boolean;
}) {
  const fg = tone === "primary" ? colors.white : tone === "danger" ? colors.error : colors.ink;
  const bg = tone === "primary" ? colors.orange : tone === "danger" ? colors.errorSoft : colors.cream;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: "rgba(16,13,10,0.06)" }}
      style={({ pressed }) => [styles.actionBtn, { backgroundColor: bg }, (pressed || disabled) && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={14} color={fg} />
      <Text style={[styles.actionLabel, { color: fg }]}>{label}</Text>
    </Pressable>
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

  card: { gap: space[3] },
  head: { flexDirection: "row", alignItems: "flex-start", gap: space[3] },
  classLine: { fontSize: fontSize.label, fontWeight: "800", color: colors.orangeDeep, letterSpacing: 0.6 },
  title: { fontSize: fontSize.bodyL, fontWeight: "800", color: colors.ink, marginTop: 2, letterSpacing: -0.2 },
  statusChip: { borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: 3 },
  statusText: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.6 },

  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: space[4] },
  meta: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: fontSize.bodyS, color: colors.ink60, fontWeight: "700" },

  actions: { flexDirection: "row", flexWrap: "wrap", gap: space[2], borderTopWidth: 1, borderTopColor: colors.ruleSoft, paddingTop: space[3] },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: radius[2],
  },
  actionLabel: { fontSize: fontSize.bodyS, fontWeight: "800" },
});
