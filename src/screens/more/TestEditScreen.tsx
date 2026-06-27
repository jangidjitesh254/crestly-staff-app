/**
 * Create / edit a test — title, target class/section, optional subject &
 * duration, then a list of MCQ and fill-in-the-blank questions with their
 * answer keys. Maps onto TestUpsert.
 *
 * Grading is all-or-nothing per question (matches the server): an MCQ needs
 * the exact correct-option set; a fill-blank matches any accepted answer.
 * Editing is blocked server-side once a test has attempts.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../../store/auth";
import {
  useClasses,
  useExamSubjects,
  useMyClasses,
  useParseQuestions,
  useSaveTest,
  useTest,
  useTestAction,
  useTimetableForTeacher,
} from "../../hooks/queries";
import { Button, Card, Screen, StateView, TextField } from "../../components/ui";
import { TopBar } from "../../components/TopBar";
import { PageHead } from "../../components/PageHead";
import { getErrorMessage } from "../../lib/api";
import { colors, fontSize, radius, space, tints } from "../../theme";
import type { MoreStackParams } from "../../navigation/types";
import type { QuestionType, TestQuestionUpsert, TestUpsert } from "../../types/api";

type Props = NativeStackScreenProps<MoreStackParams, "TestEdit">;

interface QDraft {
  key: string;
  type: QuestionType;
  prompt: string;
  marks: string;
  options: string[];
  correct: number[];
  accepted: string[];
  caseSensitive: boolean;
}

function newQuestion(key: string, type: QuestionType): QDraft {
  return {
    key,
    type,
    prompt: "",
    marks: "1",
    options: type === "mcq" ? ["", ""] : [],
    correct: [],
    accepted: type === "fill_blank" ? [""] : [],
    caseSensitive: false,
  };
}

export function TestEditScreen({ route, navigation }: Props) {
  const testId = route.params?.testId ?? null;
  const editing = testId != null;
  const { user } = useAuth();
  const existing = useTest(testId);
  const classes = useClasses();
  const myClasses = useMyClasses();
  const timetable = useTimetableForTeacher(user?.id ?? 0);
  const subjectsQ = useExamSubjects();
  const save = useSaveTest();
  const action = useTestAction();
  const parse = useParseQuestions();

  const keySeq = useRef(0);
  const nextKey = () => `q${keySeq.current++}`;

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [classSlug, setClassSlug] = useState<string | null>(null);
  const [sectionCode, setSectionCode] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [durationMin, setDurationMin] = useState("");
  const [passMarks, setPassMarks] = useState("");
  const [shuffle, setShuffle] = useState(false);
  const [questions, setQuestions] = useState<QDraft[]>(() => [newQuestion("q-init", "mcq")]);
  const [importText, setImportText] = useState("");
  const [hydrated, setHydrated] = useState(false);

  // Build the class list from REAL slugs the teacher can actually read, so a
  // published test's class_slug matches the students' stored class exactly:
  //  • /attendance/my-classes — the same slugs attendance uses (authoritative)
  //  • the teacher's timetable cells
  //  • exam-subject → class mappings
  //  • /classes when available (admins) — adds names + sections
  // Hardcoding "1".."12" was wrong: those slugs didn't match the real data.
  const classMap = useMemo(() => {
    const m = new Map<string, { name: string; sections: Set<string> }>();
    const ensure = (slug: string, name?: string) => {
      let r = m.get(slug);
      if (!r) {
        r = { name: name && name.trim() ? name : `Class ${slug}`, sections: new Set<string>() };
        m.set(slug, r);
      } else if (name && name.trim() && /^Class /.test(r.name)) {
        r.name = name; // upgrade a placeholder name to the real one
      }
      return r;
    };
    for (const c of classes.data ?? []) {
      const r = ensure(c.slug, c.name);
      for (const s of c.sections) r.sections.add(s.code);
    }
    for (const c of myClasses.data?.classes ?? []) {
      const r = ensure(c.classSlug, c.className);
      if (c.sectionCode) r.sections.add(c.sectionCode);
    }
    for (const cell of timetable.data?.cells ?? []) {
      const r = ensure(cell.classSlug);
      if (cell.sectionCode) r.sections.add(cell.sectionCode);
    }
    for (const s of subjectsQ.data ?? []) for (const slug of s.classes ?? []) ensure(slug);
    return m;
  }, [classes.data, myClasses.data, timetable.data, subjectsQ.data]);

  const classOptions = useMemo(() => {
    const arr = Array.from(classMap.entries()).map(([slug, v]) => ({ slug, name: v.name }));
    arr.sort((a, b) => {
      const na = Number(a.slug);
      const nb = Number(b.slug);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return a.slug.localeCompare(b.slug);
    });
    return arr;
  }, [classMap]);

  // Last-resort fallback so the picker is never empty (slugs may not match —
  // we warn when this is used).
  const usingFallbackClasses = classOptions.length === 0;
  const shownClassOptions = usingFallbackClasses
    ? Array.from({ length: 12 }, (_, i) => ({ slug: String(i + 1), name: `Class ${i + 1}` }))
    : classOptions;

  const sectionOptions = useMemo(() => {
    if (!classSlug) return [] as string[];
    const real = classMap.get(classSlug)?.sections;
    if (real && real.size > 0) return Array.from(real).sort();
    return ["A", "B", "C", "D"];
  }, [classSlug, classMap]);

  // Subjects offered in the chosen class (from the master subject list). Falls
  // back to the full list if none are explicitly mapped to the class.
  const subjectOptions = useMemo(() => {
    if (!classSlug) return [] as { id: number; name: string }[];
    const all = subjectsQ.data ?? [];
    const forClass = all.filter((s) => s.classes?.includes(classSlug));
    const list = forClass.length > 0 ? forClass : all;
    const opts = list
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({ id: s.id, name: s.name }));
    // Keep the existing test's subject selectable even if not in the list.
    if (
      editing &&
      existing.data?.classSlug === classSlug &&
      existing.data.subjectId &&
      existing.data.subjectName &&
      !opts.some((o) => o.id === existing.data!.subjectId)
    ) {
      return [{ id: existing.data.subjectId, name: existing.data.subjectName }, ...opts];
    }
    return opts;
  }, [classSlug, subjectsQ.data, editing, existing.data]);

  function chooseClass(slug: string) {
    setClassSlug(slug);
    setSectionCode(null);
    setSubjectId(null);
  }

  useEffect(() => {
    const t = existing.data;
    if (!editing || hydrated || !t) return;
    setTitle(t.title);
    setInstructions(t.instructions ?? "");
    setClassSlug(t.classSlug);
    setSectionCode(t.sectionCode);
    setSubjectId(t.subjectId);
    setDurationMin(t.durationMin != null ? String(t.durationMin) : "");
    setPassMarks(t.passMarks != null ? String(t.passMarks) : "");
    setShuffle(t.shuffle);
    setQuestions(
      t.questions.map((q) => ({
        key: nextKey(),
        type: q.type,
        prompt: q.prompt,
        marks: String(q.marks),
        options: (q.options ?? []).map((o) => o.text),
        correct: q.correctOptions ?? [],
        accepted: q.acceptedAnswers ?? (q.type === "fill_blank" ? [""] : []),
        caseSensitive: q.caseSensitive,
      })),
    );
    setHydrated(true);
  }, [existing.data, editing, hydrated]);

  /* --------------------------------------------------- question mutators */

  function patchQ(key: string, patch: Partial<QDraft>) {
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  }
  function addQuestion(type: QuestionType) {
    setQuestions((qs) => [...qs, newQuestion(nextKey(), type)]);
  }
  function removeQuestion(key: string) {
    setQuestions((qs) => qs.filter((q) => q.key !== key));
  }
  function setOption(key: string, idx: number, text: string) {
    setQuestions((qs) =>
      qs.map((q) => (q.key === key ? { ...q, options: q.options.map((o, i) => (i === idx ? text : o)) } : q)),
    );
  }
  function addOption(key: string) {
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, options: [...q.options, ""] } : q)));
  }
  function removeOption(key: string, idx: number) {
    setQuestions((qs) =>
      qs.map((q) => {
        if (q.key !== key) return q;
        const options = q.options.filter((_, i) => i !== idx);
        // Reindex the correct set after a removal.
        const correct = q.correct
          .filter((c) => c !== idx)
          .map((c) => (c > idx ? c - 1 : c));
        return { ...q, options, correct };
      }),
    );
  }
  function toggleCorrect(key: string, idx: number) {
    setQuestions((qs) =>
      qs.map((q) => {
        if (q.key !== key) return q;
        const correct = q.correct.includes(idx)
          ? q.correct.filter((c) => c !== idx)
          : [...q.correct, idx];
        return { ...q, correct };
      }),
    );
  }
  function setAccepted(key: string, idx: number, text: string) {
    setQuestions((qs) =>
      qs.map((q) => (q.key === key ? { ...q, accepted: q.accepted.map((a, i) => (i === idx ? text : a)) } : q)),
    );
  }
  function addAccepted(key: string) {
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, accepted: [...q.accepted, ""] } : q)));
  }
  function removeAccepted(key: string, idx: number) {
    setQuestions((qs) =>
      qs.map((q) => (q.key === key ? { ...q, accepted: q.accepted.filter((_, i) => i !== idx) } : q)),
    );
  }

  /* --------------------------------------------------- import questions */

  function importQuestions() {
    const text = importText.trim();
    if (!text) return;
    parse.mutate(
      { text, format: "auto" },
      {
        onSuccess: (res) => {
          const drafts: QDraft[] = res.questions.map((q) => ({
            key: nextKey(),
            type: q.type,
            prompt: q.prompt,
            marks: String(q.marks ?? 1),
            options: (q.options ?? []).map((o) => o.text),
            correct: q.correctOptions ?? [],
            accepted: q.acceptedAnswers ?? (q.type === "fill_blank" ? [""] : []),
            caseSensitive: q.caseSensitive ?? false,
          }));
          if (drafts.length > 0) {
            // Drop a single empty starter question so imports don't leave a blank.
            setQuestions((qs) => {
              const onlyEmptyStarter =
                qs.length === 1 && !qs[0]!.prompt.trim();
              return onlyEmptyStarter ? drafts : [...qs, ...drafts];
            });
          }
          setImportText("");
          const head =
            drafts.length > 0 ? `Added ${drafts.length} question${drafts.length === 1 ? "" : "s"}.` : "No questions found.";
          const tail = res.errors.length > 0 ? `\n\nSkipped:\n• ${res.errors.join("\n• ")}` : "";
          Alert.alert("Import", head + tail);
        },
        onError: (e) => Alert.alert("Couldn't import", getErrorMessage(e)),
      },
    );
  }

  /* ------------------------------------------------------------- save */

  function validate(): string | null {
    if (!title.trim()) return "Give the test a title.";
    if (!classSlug) return "Choose the class this test is for.";
    if (subjectOptions.length > 0 && subjectId == null) return "Choose the subject this test is for.";
    if (questions.length === 0) return "Add at least one question.";
    let total = 0;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]!;
      const n = i + 1;
      if (!q.prompt.trim()) return `Question ${n}: enter the prompt.`;
      const marks = Number(q.marks);
      if (!Number.isFinite(marks) || marks <= 0) return `Question ${n}: marks must be a positive number.`;
      total += marks;
      if (q.type === "mcq") {
        const filled = q.options.filter((o) => o.trim());
        if (filled.length < 2) return `Question ${n}: add at least two options.`;
        if (q.correct.length === 0) return `Question ${n}: mark at least one correct option.`;
      } else {
        const acc = q.accepted.filter((a) => a.trim());
        if (acc.length === 0) return `Question ${n}: add at least one accepted answer.`;
      }
    }
    if (passMarks.trim()) {
      const pm = Number(passMarks);
      if (!Number.isInteger(pm) || pm < 0) return "Pass marks must be a whole number.";
      if (pm > total) return `Pass marks (${pm}) can't exceed total marks (${total}).`;
    }
    return null;
  }

  function onSave() {
    const err = validate();
    if (err) {
      Alert.alert("Almost there", err);
      return;
    }
    const qs: TestQuestionUpsert[] = questions.map((q) =>
      q.type === "mcq"
        ? {
            type: "mcq",
            prompt: q.prompt.trim(),
            marks: Number(q.marks),
            // Drop empty options and remap correct indices onto the trimmed list.
            options: q.options.map((t) => t.trim()).filter(Boolean).map((text) => ({ text })),
            correctOptions: remapCorrect(q.options, q.correct),
          }
        : {
            type: "fill_blank",
            prompt: q.prompt.trim(),
            marks: Number(q.marks),
            acceptedAnswers: q.accepted.map((a) => a.trim()).filter(Boolean),
            caseSensitive: q.caseSensitive,
          },
    );

    const body: TestUpsert = {
      title: title.trim(),
      instructions: instructions.trim() ? instructions.trim() : null,
      classSlug: classSlug!,
      sectionCode: sectionCode,
      subjectId: subjectId,
      durationMin: durationMin.trim() ? Number(durationMin) : null,
      passMarks: passMarks.trim() ? Number(passMarks) : null,
      shuffle,
      questions: qs,
    };

    save.mutate(
      { id: testId, body },
      {
        onSuccess: (created) => {
          // Editing an existing test → just go back.
          if (editing) {
            navigation.goBack();
            return;
          }
          // New tests are created as drafts and stay invisible to students until
          // published — offer to publish right away so they actually show up.
          Alert.alert(
            "Test created",
            "It's saved as a draft. Publish it now so students can see and attempt it?",
            [
              { text: "Keep as draft", onPress: () => navigation.goBack() },
              {
                text: "Publish now",
                onPress: () =>
                  action.mutate(
                    { id: created.id, action: "publish" },
                    {
                      onSuccess: () => navigation.goBack(),
                      onError: (e) => {
                        Alert.alert("Created, but couldn't publish", getErrorMessage(e));
                        navigation.goBack();
                      },
                    },
                  ),
              },
            ],
          );
        },
        onError: (e) => Alert.alert("Couldn't save", getErrorMessage(e)),
      },
    );
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
        <PageHead crumb="Tests" title={editing ? "Edit test" : "New test"} />

        {/* Basics */}
        <Card style={{ gap: space[4] }}>
          <TextField label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Unit Test 1 — Fractions" />
          <TextField
            label="Instructions"
            value={instructions}
            onChangeText={setInstructions}
            placeholder="Optional — shown before the test starts"
            multiline
            style={styles.textArea}
          />

          <View style={{ gap: space[2] }}>
            <Text style={styles.label}>CLASS</Text>
            <View style={styles.radioWrap}>
              {shownClassOptions.map((c) => (
                <RadioChip key={c.slug} label={c.name} active={classSlug === c.slug} onPress={() => chooseClass(c.slug)} />
              ))}
            </View>
            {usingFallbackClasses ? (
              <Text style={styles.hintNote}>
                Couldn't load your classes — these are generic 1–12 and may not match. If a created
                test doesn't show for students, your class isn't linked to this account.
              </Text>
            ) : null}
          </View>

          {classSlug ? (
            <View style={{ gap: space[2] }}>
              <Text style={styles.label}>SECTION</Text>
              <View style={styles.radioWrap}>
                <RadioChip label="All sections" active={sectionCode == null} onPress={() => setSectionCode(null)} />
                {sectionOptions.map((code) => (
                  <RadioChip key={code} label={code} active={sectionCode === code} onPress={() => setSectionCode(code)} />
                ))}
              </View>
            </View>
          ) : null}

          {classSlug ? (
            <View style={{ gap: space[2] }}>
              <Text style={styles.label}>SUBJECT</Text>
              {subjectOptions.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {subjectOptions.map((s) => (
                    <Chip key={s.id} label={s.name} active={subjectId === s.id} onPress={() => setSubjectId(s.id)} />
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.hintNote}>No subjects found for this class in your timetable.</Text>
              )}
            </View>
          ) : null}

          <View style={styles.inlineRow}>
            <View style={{ flex: 1 }}>
              <TextField label="Duration (min)" value={durationMin} onChangeText={setDurationMin} placeholder="20" keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Pass marks" value={passMarks} onChangeText={setPassMarks} placeholder="Optional" keyboardType="number-pad" />
            </View>
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Shuffle questions</Text>
            <Switch
              value={shuffle}
              onValueChange={setShuffle}
              trackColor={{ false: colors.creamDeep, true: colors.orangeSoft }}
              thumbColor={shuffle ? colors.orange : colors.white}
            />
          </View>
        </Card>

        {/* Paste to import */}
        <Card style={{ gap: space[3] }}>
          <View style={styles.importHead}>
            <Ionicons name="clipboard-outline" size={16} color={colors.ink60} />
            <Text style={styles.importTitle}>Import from text</Text>
          </View>
          <Text style={styles.importHint}>
            Paste questions and we'll parse them into the form. MCQ: mark the correct option with “*”.
          </Text>
          <TextField
            value={importText}
            onChangeText={setImportText}
            placeholder={"What is 2+2? [1]\n- 3\n* 4\n- 5"}
            multiline
            style={styles.importArea}
          />
          <Button
            label={parse.isPending ? "Parsing…" : "Parse & add"}
            onPress={importQuestions}
            variant="secondary"
            loading={parse.isPending}
            disabled={!importText.trim()}
          />
        </Card>

        {/* Questions */}
        {questions.map((q, i) => (
          <QuestionEditor
            key={q.key}
            index={i + 1}
            q={q}
            onPatch={(p) => patchQ(q.key, p)}
            onRemove={() => removeQuestion(q.key)}
            onSetOption={(idx, t) => setOption(q.key, idx, t)}
            onAddOption={() => addOption(q.key)}
            onRemoveOption={(idx) => removeOption(q.key, idx)}
            onToggleCorrect={(idx) => toggleCorrect(q.key, idx)}
            onSetAccepted={(idx, t) => setAccepted(q.key, idx, t)}
            onAddAccepted={() => addAccepted(q.key)}
            onRemoveAccepted={(idx) => removeAccepted(q.key, idx)}
          />
        ))}

        <View style={styles.addRow}>
          <Pressable onPress={() => addQuestion("mcq")} android_ripple={{ color: "rgba(16,13,10,0.06)" }} style={styles.addBtn}>
            <Ionicons name="add" size={16} color={colors.ink} />
            <Text style={styles.addText}>MCQ</Text>
          </Pressable>
          <Pressable onPress={() => addQuestion("fill_blank")} android_ripple={{ color: "rgba(16,13,10,0.06)" }} style={styles.addBtn}>
            <Ionicons name="add" size={16} color={colors.ink} />
            <Text style={styles.addText}>Fill blank</Text>
          </Pressable>
        </View>

        <Button label={save.isPending ? "Saving…" : editing ? "Save changes" : "Create test"} onPress={onSave} loading={save.isPending} />
        <Text style={styles.footNote}>
          Students only see a test once it's published — you'll be asked to publish on save
          (or do it later from the Tests list).
        </Text>
      </Screen>
    </View>
  );
}

/** Remap the correct indices from the raw option list onto the trimmed list. */
function remapCorrect(options: string[], correct: number[]): number[] {
  const result: number[] = [];
  let trimmedIdx = -1;
  options.forEach((opt, rawIdx) => {
    if (opt.trim()) {
      trimmedIdx++;
      if (correct.includes(rawIdx)) result.push(trimmedIdx);
    }
  });
  return result;
}

/* --------------------------------------------------------- question card */

function QuestionEditor({
  index,
  q,
  onPatch,
  onRemove,
  onSetOption,
  onAddOption,
  onRemoveOption,
  onToggleCorrect,
  onSetAccepted,
  onAddAccepted,
  onRemoveAccepted,
}: {
  index: number;
  q: QDraft;
  onPatch: (p: Partial<QDraft>) => void;
  onRemove: () => void;
  onSetOption: (idx: number, t: string) => void;
  onAddOption: () => void;
  onRemoveOption: (idx: number) => void;
  onToggleCorrect: (idx: number) => void;
  onSetAccepted: (idx: number, t: string) => void;
  onAddAccepted: () => void;
  onRemoveAccepted: (idx: number) => void;
}) {
  const mcq = q.type === "mcq";
  return (
    <Card style={{ gap: space[3] }}>
      <View style={styles.qHead}>
        <View style={styles.qNum}><Text style={styles.qNumText}>{index}</Text></View>
        <View style={[styles.typeChip, { backgroundColor: mcq ? tints.sky.base : tints.wheat.base }]}>
          <Text style={[styles.typeChipText, { color: mcq ? tints.sky.deep : tints.wheat.deep }]}>
            {mcq ? "MCQ" : "FILL BLANK"}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <Pressable onPress={onRemove} hitSlop={8} style={styles.removeQ}>
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </Pressable>
      </View>

      <TextField label="Prompt" value={q.prompt} onChangeText={(t) => onPatch({ prompt: t })} placeholder="Question text" multiline style={styles.qPrompt} />
      <View style={{ width: 120 }}>
        <TextField label="Marks" value={q.marks} onChangeText={(t) => onPatch({ marks: t })} placeholder="1" keyboardType="number-pad" />
      </View>

      {mcq ? (
        <View style={{ gap: space[2] }}>
          <Text style={styles.label}>OPTIONS · TAP THE CIRCLE TO MARK CORRECT</Text>
          {q.options.map((opt, idx) => {
            const on = q.correct.includes(idx);
            return (
              <View key={idx} style={styles.optRow}>
                <Pressable onPress={() => onToggleCorrect(idx)} hitSlop={6} style={[styles.correctDot, on && styles.correctDotOn]}>
                  {on ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
                </Pressable>
                <View style={{ flex: 1 }}>
                  <TextField value={opt} onChangeText={(t) => onSetOption(idx, t)} placeholder={`Option ${idx + 1}`} />
                </View>
                {q.options.length > 2 ? (
                  <Pressable onPress={() => onRemoveOption(idx)} hitSlop={6} style={styles.optRemove}>
                    <Ionicons name="close" size={16} color={colors.ink40} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
          <Pressable onPress={onAddOption} style={styles.subAdd}>
            <Ionicons name="add" size={15} color={colors.orangeDeep} />
            <Text style={styles.subAddText}>Add option</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: space[2] }}>
          <Text style={styles.label}>ACCEPTED ANSWERS</Text>
          {q.accepted.map((a, idx) => (
            <View key={idx} style={styles.optRow}>
              <View style={{ flex: 1 }}>
                <TextField value={a} onChangeText={(t) => onSetAccepted(idx, t)} placeholder={`Answer ${idx + 1}`} autoCapitalize="none" />
              </View>
              {q.accepted.length > 1 ? (
                <Pressable onPress={() => onRemoveAccepted(idx)} hitSlop={6} style={styles.optRemove}>
                  <Ionicons name="close" size={16} color={colors.ink40} />
                </Pressable>
              ) : null}
            </View>
          ))}
          <Pressable onPress={onAddAccepted} style={styles.subAdd}>
            <Ionicons name="add" size={15} color={colors.orangeDeep} />
            <Text style={styles.subAddText}>Add accepted answer</Text>
          </Pressable>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Case-sensitive</Text>
            <Switch
              value={q.caseSensitive}
              onValueChange={(v) => onPatch({ caseSensitive: v })}
              trackColor={{ false: colors.creamDeep, true: colors.orangeSoft }}
              thumbColor={q.caseSensitive ? colors.orange : colors.white}
            />
          </View>
        </View>
      )}
    </Card>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

/** A radio-style selectable pill (single-select within its group). */
function RadioChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(16,13,10,0.06)" }}
      style={[styles.radio, active && styles.radioActive]}
    >
      <View style={[styles.radioDot, active && styles.radioDotActive]}>
        {active ? <View style={styles.radioInner} /> : null}
      </View>
      <Text style={[styles.radioLabel, active && styles.radioLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  label: { fontSize: fontSize.label, fontWeight: "800", color: colors.ink40, letterSpacing: 1 },
  textArea: { minHeight: 70, paddingTop: space[3], textAlignVertical: "top" },
  qPrompt: { minHeight: 56, paddingTop: space[3], textAlignVertical: "top" },

  chipRow: { gap: space[2] },
  chip: {
    paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: radius.pill,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.rule,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: fontSize.bodyS, fontWeight: "700", color: colors.ink60 },
  chipTextActive: { color: colors.white },
  hintNote: { fontSize: fontSize.bodyS, color: colors.ink40, fontStyle: "italic" },

  /* Radio-style selectors (class + section) */
  radioWrap: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  radio: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius[3],
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.white,
  },
  radioActive: { borderColor: colors.orange, backgroundColor: colors.orangeTint },
  radioDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.ruleStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDotActive: { borderColor: colors.orange },
  radioInner: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.orange },
  radioLabel: { fontSize: fontSize.body, fontWeight: "700", color: colors.ink80 },
  radioLabelActive: { color: colors.orangeDeep, fontWeight: "800" },

  inlineRow: { flexDirection: "row", gap: space[4], alignItems: "flex-end" },
  toggleCol: { gap: space[2], alignItems: "center" },

  importHead: { flexDirection: "row", alignItems: "center", gap: space[2] },
  importTitle: { fontSize: fontSize.body, fontWeight: "800", color: colors.ink },
  importHint: { fontSize: fontSize.bodyS, color: colors.ink60, lineHeight: 18 },
  importArea: { minHeight: 90, paddingTop: space[3], textAlignVertical: "top" },

  qHead: { flexDirection: "row", alignItems: "center", gap: space[2] },
  qNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  qNumText: { color: colors.white, fontSize: fontSize.bodyS, fontWeight: "800" },
  typeChip: { borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: 3 },
  typeChipText: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.6 },
  removeQ: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.errorSoft, alignItems: "center", justifyContent: "center" },

  optRow: { flexDirection: "row", alignItems: "center", gap: space[2] },
  correctDot: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.ruleStrong,
    alignItems: "center", justifyContent: "center",
  },
  correctDotOn: { backgroundColor: tints.mint.deep, borderColor: tints.mint.deep },
  optRemove: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  subAdd: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingVertical: 4 },
  subAddText: { fontSize: fontSize.bodyS, fontWeight: "800", color: colors.orangeDeep },

  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space[1] },
  toggleLabel: { fontSize: fontSize.body, fontWeight: "700", color: colors.ink },

  addRow: { flexDirection: "row", gap: space[3] },
  addBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: colors.cream, borderRadius: radius[3], paddingVertical: space[3],
    borderWidth: 1, borderColor: colors.rule,
  },
  addText: { fontSize: fontSize.body, fontWeight: "800", color: colors.ink },
  footNote: { fontSize: fontSize.bodyS, color: colors.ink40, textAlign: "center", fontStyle: "italic" },
});
