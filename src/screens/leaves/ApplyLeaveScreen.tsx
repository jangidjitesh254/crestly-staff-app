import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { HalfDay } from "../../types/api";
import { useApplyLeave, useLeaveTypes } from "../../hooks/queries";
import {
  Button,
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
import { addDays, formatLong, todayIso } from "../../lib/dates";
import { colors, fontSize, radius, space } from "../../theme";
import type { MoreStackParams } from "../../navigation/types";

type Props = NativeStackScreenProps<MoreStackParams, "ApplyLeave">;

const HALF_DAY_OPTIONS: { value: HalfDay; label: string }[] = [
  { value: "none", label: "Full day" },
  { value: "first_half", label: "1st half" },
  { value: "second_half", label: "2nd half" },
];

export function ApplyLeaveScreen({ navigation }: Props) {
  const types = useLeaveTypes();
  const apply = useApplyLeave();

  const [leaveTypeId, setLeaveTypeId] = useState<number | null>(null);
  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());
  const [halfDay, setHalfDay] = useState<HalfDay>("none");
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState<{ visible: boolean; text: string }>({
    visible: false,
    text: "",
  });

  const singleDay = fromDate === toDate;

  function changeFrom(delta: number) {
    const next = addDays(fromDate, delta);
    setFromDate(next);
    if (next > toDate) setToDate(next);
  }

  function changeTo(delta: number) {
    const next = addDays(toDate, delta);
    if (next < fromDate) return;
    setToDate(next);
  }

  async function submit() {
    if (leaveTypeId == null) {
      Alert.alert("Pick a leave type", "Select which type of leave to apply for.");
      return;
    }
    try {
      await apply.mutateAsync({
        leaveTypeId,
        fromDate,
        toDate,
        halfDay: singleDay ? halfDay : "none",
        reason: reason.trim() || null,
      });
      setToast({ visible: true, text: "Leave request sent for approval" });
      // Give the toast a beat to play before popping back.
      setTimeout(() => navigation.goBack(), 1200);
    } catch (err) {
      Alert.alert("Could not apply", getErrorMessage(err));
    }
  }

  return (
    <View style={styles.fillParent}>
    <TopBar showBack onBack={() => navigation.goBack()} />
    <Screen>
      <PageHead
        crumb="My Day"
        date={formatBreadcrumbDate(todayIso())}
        title="Apply for Leave"
        subtitle="Pick a type, dates, and submit for approval."
      />

      <SectionLabel>Leave type</SectionLabel>
      <StateView
        loading={types.isLoading}
        error={types.error ? new Error(getErrorMessage(types.error)) : undefined}
        onRetry={() => void types.refetch()}
      />
      {types.data?.map((t) => {
        const selected = t.id === leaveTypeId;
        return (
          <Pressable
            key={t.id}
            onPress={() => setLeaveTypeId(t.id)}
            style={({ pressed }) => [
              styles.typeRow,
              selected && styles.typeRowOn,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.flex}>
              <Text style={[styles.typeName, selected && styles.typeNameOn]}>
                {t.name}
              </Text>
              <Text style={styles.typeMeta}>
                {t.shortCode} · {t.isPaid ? "Paid" : "Unpaid"}
                {t.annualQuota > 0 ? ` · ${t.annualQuota}/yr` : ""}
              </Text>
            </View>
            <View style={[styles.radio, selected && styles.radioOn]} />
          </Pressable>
        );
      })}

      <SectionLabel>Dates</SectionLabel>
      <Card>
        <DateField label="From" value={fromDate} onStep={changeFrom} />
        <View style={styles.divider} />
        <DateField label="To" value={toDate} onStep={changeTo} />
      </Card>

      {singleDay ? (
        <>
          <SectionLabel>Duration</SectionLabel>
          <Segmented
            options={HALF_DAY_OPTIONS}
            value={halfDay}
            onChange={setHalfDay}
          />
        </>
      ) : null}

      <TextField
        label="Reason (optional)"
        value={reason}
        onChangeText={setReason}
        placeholder="Briefly describe the reason"
        multiline
        numberOfLines={3}
        maxLength={500}
        style={styles.reason}
      />

      <Button
        label="Submit request"
        onPress={submit}
        loading={apply.isPending}
        disabled={leaveTypeId == null}
      />
    </Screen>
    <SavedToast
      visible={toast.visible}
      text={toast.text}
      onHide={() => setToast({ visible: false, text: "" })}
    />
    </View>
  );
}

function DateField({
  label,
  value,
  onStep,
}: {
  label: string;
  value: string;
  onStep: (delta: number) => void;
}) {
  return (
    <View style={styles.dateField}>
      <View>
        <Text style={styles.dateLabel}>{label}</Text>
        <Text style={styles.dateValue}>{formatLong(value)}</Text>
      </View>
      <View style={styles.dateBtns}>
        <Pressable onPress={() => onStep(-1)} hitSlop={8} style={styles.dateBtn}>
          <Text style={styles.dateArrow}>‹</Text>
        </Pressable>
        <Pressable onPress={() => onStep(1)} hitSlop={8} style={styles.dateBtn}>
          <Text style={styles.dateArrow}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fillParent: { flex: 1 },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },

  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius[3],
    padding: space[3],
  },
  typeRowOn: { borderColor: colors.orange, backgroundColor: colors.orangeTint },
  typeName: { fontSize: fontSize.bodyL, fontWeight: "700", color: colors.ink },
  typeNameOn: { color: colors.orangeDeep },
  typeMeta: { fontSize: fontSize.bodyS, color: colors.ink60 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.ruleStrong,
  },
  radioOn: {
    borderColor: colors.orange,
    backgroundColor: colors.orange,
  },

  dateField: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateLabel: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.ink40,
    letterSpacing: 1.2,
  },
  dateValue: { fontSize: fontSize.bodyL, fontWeight: "700", color: colors.ink },
  dateBtns: { flexDirection: "row", gap: space[2] },
  dateBtn: {
    width: 40,
    height: 40,
    borderRadius: radius[2],
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  dateArrow: { fontSize: 24, fontWeight: "800", color: colors.orange },
  divider: { height: 1, backgroundColor: colors.rule },

  reason: { minHeight: 80, paddingTop: space[2], textAlignVertical: "top" },
});
