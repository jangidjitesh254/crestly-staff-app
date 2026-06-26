import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ExamDatesheetRow, ExamTerm } from "../../types/api";
import { useExamDatesheet, useExamTerms } from "../../hooks/queries";
import { useAuth } from "../../store/auth";
import { Card, FadeInView, Screen, StateView } from "../../components/ui";
import { TopBar } from "../../components/TopBar";
import { PageHead } from "../../components/PageHead";
import { InfoCard } from "../../components/InfoCard";
import { getErrorMessage } from "../../lib/api";
import { dayPad, monthShort, weekdayLong } from "../../lib/dates";
import { colors, fontSize, radius, space, tints } from "../../theme";
import type { MoreStackParams } from "../../navigation/types";

type Props = NativeStackScreenProps<MoreStackParams, "Exams">;

export function ExamsScreen({ navigation }: Props) {
  const { hasPerm } = useAuth();
  const terms = useExamTerms();
  const [termId, setTermId] = useState<number | null>(null);
  const datesheet = useExamDatesheet(termId);

  // Auto-select the first term when terms load.
  React.useEffect(() => {
    if (termId == null && terms.data && terms.data.length > 0) {
      setTermId(terms.data[0]!.id);
    }
  }, [terms.data, termId]);

  // Group date sheet rows by class slug.
  const byClass = useMemo(() => {
    const map = new Map<string, ExamDatesheetRow[]>();
    for (const r of datesheet.data ?? []) {
      const bucket = map.get(r.classSlug);
      if (bucket) bucket.push(r);
      else map.set(r.classSlug, [r]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [datesheet.data]);

  if (!hasPerm("exams.view")) {
    return (
      <View style={styles.root}>
        <TopBar showBack onBack={() => navigation.goBack()} />
        <Screen>
          <PageHead crumb="School" title="Exams" />
          <InfoCard
            lead="Not enabled."
            body="Exam viewing is not enabled for your role. Ask an admin to grant you exams.view."
          />
        </Screen>
      </View>
    );
  }

  const activeTerm = terms.data?.find((t) => t.id === termId) ?? null;

  return (
    <View style={styles.root}>
      <TopBar showBack onBack={() => navigation.goBack()} />
      <Screen
        refreshing={terms.isRefetching || datesheet.isRefetching}
        onRefresh={() => {
          void terms.refetch();
          void datesheet.refetch();
        }}
      >
        <PageHead
          crumb="School"
          title="Exams"
          subtitle="Date sheets and term overview."
        />

        {/* Term chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.termsRow}
        >
          {terms.data?.map((t) => (
            <TermChip
              key={t.id}
              term={t}
              active={t.id === termId}
              onPress={() => setTermId(t.id)}
            />
          ))}
        </ScrollView>

        <StateView
          loading={terms.isLoading && !terms.data}
          error={!terms.data && terms.error
            ? new Error(getErrorMessage(terms.error))
            : undefined}
          empty={!terms.isLoading && (terms.data?.length ?? 0) === 0}
          emptyText="No exam terms configured yet."
          onRetry={() => void terms.refetch()}
        />

        {activeTerm ? (
          <FadeInView delay={0}>
            <Card>
              <View style={styles.termHead}>
                <Text style={styles.termName}>{activeTerm.name}</Text>
                {activeTerm.isFinalized ? (
                  <View style={styles.finalizedBadge}>
                    <Text style={styles.finalizedText}>FINALIZED</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.termMeta}>
                <Meta label="WEIGHT" value={`${activeTerm.weightPercent}%`} />
                <Meta label="DEFAULT MAX" value={String(activeTerm.defaultMaxMarks)} />
                <Meta label="PAPERS" value={String(activeTerm.papersCount ?? 0)} />
              </View>
            </Card>
          </FadeInView>
        ) : null}

        <StateView
          loading={termId != null && datesheet.isLoading && !datesheet.data}
          error={termId != null && !datesheet.data && datesheet.error
            ? new Error(getErrorMessage(datesheet.error))
            : undefined}
          empty={termId != null && !datesheet.isLoading && (datesheet.data?.length ?? 0) === 0}
          emptyText="No date sheet entries for this term yet."
          onRetry={() => void datesheet.refetch()}
        />

        {byClass.map(([classSlug, rows], gi) => (
          <FadeInView key={classSlug} delay={50 + gi * 40}>
            <View style={styles.classBlock}>
              <Text style={styles.classTitle}>
                {classSlug.toUpperCase()} · {rows.length}{" "}
                {rows.length === 1 ? "paper" : "papers"}
              </Text>
              <View style={{ gap: space[2] }}>
                {rows
                  .sort((a, b) => a.examDate.localeCompare(b.examDate))
                  .map((r) => (
                    <DatesheetRow key={r.id} row={r} />
                  ))}
              </View>
            </View>
          </FadeInView>
        ))}
      </Screen>
    </View>
  );
}

function TermChip({
  term,
  active,
  onPress,
}: {
  term: ExamTerm;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(245,239,227,0.2)" }}
      style={[styles.termChip, active && styles.termChipActive]}
    >
      <Text style={[styles.termChipText, active && styles.termChipTextActive]}>
        {term.shortCode || term.name}
      </Text>
    </Pressable>
  );
}

function DatesheetRow({ row }: { row: ExamDatesheetRow }) {
  return (
    <Card style={styles.dsRow}>
      <View style={styles.datePill}>
        <Text style={styles.datePillDay}>{dayPad(row.examDate)}</Text>
        <Text style={styles.datePillMon}>{monthShort(row.examDate)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.subject}>{row.subjectName}</Text>
        <Text style={styles.meta}>
          {weekdayLong(row.examDate)}
          {row.startTime ? ` · ${row.startTime.slice(0, 5)}` : ""}
          {row.endTime ? `–${row.endTime.slice(0, 5)}` : ""}
        </Text>
        <Text style={styles.meta}>
          Max {row.maxMarks} · Pass {row.passMarks}
        </Text>
        {row.syllabusText ? (
          <Text style={styles.syllabus} numberOfLines={3}>
            <Ionicons name="bookmarks-outline" size={12} color={colors.ink40} />
            {"  "}
            {row.syllabusText}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaBox}>
      <Text style={styles.metaL}>{label}</Text>
      <Text style={styles.metaV}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },

  termsRow: { gap: space[2] },
  termChip: {
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  termChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  termChipText: { fontSize: fontSize.bodyS, fontWeight: "700", color: colors.ink60 },
  termChipTextActive: { color: colors.white },

  termHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  termName: { fontSize: fontSize.h1, fontWeight: "800", color: colors.ink },
  termMeta: { flexDirection: "row", gap: space[3], marginTop: space[1] },
  metaBox: { flex: 1 },
  metaL: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.ink40,
    letterSpacing: 1.2,
  },
  metaV: { fontSize: fontSize.bodyL, fontWeight: "800", color: colors.ink },
  finalizedBadge: {
    backgroundColor: tints.mint.base,
    borderRadius: radius.pill,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
  finalizedText: {
    fontSize: 9,
    fontWeight: "800",
    color: tints.mint.deep,
    letterSpacing: 1.2,
  },

  classBlock: { gap: space[2] },
  classTitle: {
    fontSize: fontSize.label,
    fontWeight: "800",
    color: colors.ink40,
    letterSpacing: 1.4,
    marginTop: space[2],
  },

  dsRow: { flexDirection: "row", gap: space[3], alignItems: "center" },
  datePill: {
    width: 52,
    paddingVertical: space[2],
    borderRadius: radius[3],
    alignItems: "center",
    backgroundColor: tints.rose.base,
  },
  datePillDay: { fontSize: 16, fontWeight: "800", color: tints.rose.deep, letterSpacing: -0.3 },
  datePillMon: { fontSize: 11, fontWeight: "700", color: tints.rose.deep, letterSpacing: 0.6 },

  subject: { fontSize: fontSize.bodyL, fontWeight: "800", color: colors.ink },
  meta: { fontSize: fontSize.bodyS, color: colors.ink60, marginTop: 2 },
  syllabus: { fontSize: fontSize.bodyS, color: colors.ink60, marginTop: 4 },
});
