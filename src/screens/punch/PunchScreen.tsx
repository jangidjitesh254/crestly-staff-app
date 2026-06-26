import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import type { PunchType, PunchCreateInput } from "../../types/api";
import { usePunch, usePunchToday } from "../../hooks/queries";
import { useAuth } from "../../store/auth";
import { Screen, StateView } from "../../components/ui";
import { InfoCard } from "../../components/InfoCard";
import { SelfieCamera } from "../../components/SelfieCamera";
import { getErrorMessage } from "../../lib/api";
import { getCurrentPosition, type Position } from "../../lib/location";
import { formatBreadcrumbDate, todayIso } from "../../lib/dates";
import { colors, fontSize, radius, shadow, space, tints } from "../../theme";

function clockTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

interface Selfie {
  uri: string;
  base64: string;
}

export function PunchScreen() {
  const { user, hasPerm } = useAuth();
  const punch = usePunch();
  const today = todayIso();
  const todayQ = usePunchToday();

  const [position, setPosition] = useState<Position | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<Selfie | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [success, setSuccess] = useState<{ visible: boolean; label: string }>({
    visible: false,
    label: "",
  });

  const locate = useCallback(async () => {
    setLocating(true);
    setLocError(null);
    try {
      setPosition(await getCurrentPosition());
    } catch (err) {
      setLocError(getErrorMessage(err));
      setPosition(null);
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    void locate();
  }, [locate]);

  // Authoritative status + cooldown come from the backend's /punch/today
  // (open to all staff, unlike the perm-gated history list).
  const data = todayQ.data;
  const punches = data?.punches ?? [];
  const lastPunch = punches.length > 0 ? punches[punches.length - 1] : null;
  const isCurrentlyIn = data?.isIn ?? false;
  const nextType: PunchType = data?.nextType ?? (isCurrentlyIn ? "out" : "in");
  const nextLabel = nextType === "in" ? "Check In" : "Check Out";

  const summary = useMemo(
    () => ({
      status: isCurrentlyIn ? "in" : lastPunch?.punchType === "out" ? "out" : null,
      statusAt: lastPunch?.punchedAt ?? null,
      firstInAt: data?.firstIn?.punchedAt ?? null,
      firstInDistance: data?.firstIn?.distanceM ?? null,
      lastOutAt: data?.lastOut?.punchedAt ?? null,
    }),
    [data, isCurrentlyIn, lastPunch],
  );

  // Punch-out lock: driven by the backend cooldown (cooldownReadyAt), so it
  // respects the school's configured duration and the server clock — and a
  // live countdown ticks every second while locked.
  const [nowMs, setNowMs] = useState(() => Date.now());
  const unlockAtMs = data?.cooldownReadyAt ? new Date(data.cooldownReadyAt).getTime() : null;
  const punchOutLocked = isCurrentlyIn && unlockAtMs != null && nowMs < unlockAtMs;
  useEffect(() => {
    if (!punchOutLocked) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [punchOutLocked]);

  /** Called by the in-app CameraView modal after a photo is captured. */
  async function handleCapturedSelfie(uri: string) {
    setCameraOpen(false);
    setCapturing(true);
    try {
      const small = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 720 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      if (!small.base64) {
        Alert.alert("Selfie failed", "Couldn't process the captured image. Try again.");
        return;
      }
      setSelfie({ uri: small.uri, base64: small.base64 });
    } catch (err) {
      Alert.alert("Camera error", getErrorMessage(err));
    } finally {
      setCapturing(false);
    }
  }

  async function submit() {
    if (!position) {
      Alert.alert("Location needed", "Refresh your location before submitting.");
      return;
    }
    if (!selfie) {
      Alert.alert("Selfie needed", "Capture a selfie to verify your identity.");
      return;
    }
    const body: PunchCreateInput = {
      punchType: nextType ?? "in",
      latitude: position.latitude,
      longitude: position.longitude,
      accuracyM: position.accuracyM ?? null,
      notes: null,
      selfieBase64: selfie.base64,
    };
    if (
      !body.punchType ||
      typeof body.latitude !== "number" ||
      typeof body.longitude !== "number" ||
      !Number.isFinite(body.latitude) ||
      !Number.isFinite(body.longitude)
    ) {
      Alert.alert(
        "Punch — missing fields",
        `punchType=${body.punchType ?? "?"}\nlat=${body.latitude ?? "?"}\nlng=${body.longitude ?? "?"}`,
      );
      return;
    }
    try {
      await punch.mutateAsync(body);
      setSelfie(null);
      setSuccess({
        visible: true,
        label: nextType === "in" ? "Punched in" : "Punched out",
      });
      // Refresh immediately so the status cards + 15-min punch-out lock
      // appear right after a successful punch (no manual pull-to-refresh).
      setNowMs(Date.now());
      void todayQ.refetch();
    } catch (err) {
      Alert.alert("Punch failed", getErrorMessage(err));
    }
  }

  if (!hasPerm("staff.punch")) {
    return (
      <SafeAreaView edges={["top"]} style={styles.root}>
        <Screen>
          <Text style={styles.portalTag}>STAFF PUNCH</Text>
          <Text style={styles.greetHi}>Punch</Text>
          <View style={{ height: space[3] }} />
          <InfoCard
            lead="Not enabled."
            body="Check-in is not enabled for your role. Ask an admin to grant you the staff.punch permission."
          />
        </Screen>
      </SafeAreaView>
    );
  }

  const locReady = !!position && !locating && !locError;
  const canSubmit = locReady && !!selfie && !punch.isPending;

  const heroTint = isCurrentlyIn ? tints.mint : summary.status === "out" ? tints.peach : tints.wheat;
  const statusIcon: keyof typeof Ionicons.glyphMap = isCurrentlyIn
    ? "checkmark-circle"
    : summary.status === "out" ? "log-out-outline" : "time-outline";
  const statusKicker = isCurrentlyIn ? "CHECKED IN" : summary.status === "out" ? "PUNCHED OUT" : "NOT PUNCHED IN";
  const statusValue = isCurrentlyIn
    ? (summary.statusAt ? `Since ${clockTime(summary.statusAt)}` : "On campus")
    : summary.status === "out"
      ? (summary.lastOutAt ? `Out at ${clockTime(summary.lastOutAt)}` : "Day ended")
      : "Ready to start";
  const statusSub = isCurrentlyIn
    ? (lastPunch?.isOutside ? "Outside the campus geofence." : "You're on campus.")
    : summary.status === "out" ? "Have a good day!" : "Capture your location + selfie to begin.";

  // Guided single-button flow: the big button advances Location → Selfie → Punch.
  const needLoc = !locReady;
  const needSelfie = locReady && !selfie;
  const actionColor = needLoc || needSelfie ? colors.orange : nextType === "in" ? colors.success : colors.ink;
  const actionIcon: keyof typeof Ionicons.glyphMap = needLoc
    ? "location"
    : needSelfie ? "camera" : nextType === "in" ? "log-in" : "log-out";
  const actionLabel = locating
    ? "Locating…"
    : needLoc ? "Get location"
    : capturing ? "Processing…"
    : needSelfie ? "Take selfie"
    : punch.isPending ? "Submitting…" : nextLabel;
  const actionHint = needLoc
    ? "Step 1 of 2 — share your GPS location"
    : needSelfie ? "Step 2 of 2 — front-camera selfie"
    : `All set — tap to ${nextType === "in" ? "check in" : "check out"}`;
  const primaryDisabled = locating || capturing || punch.isPending;
  function primaryAction() {
    if (needLoc) void locate();
    else if (needSelfie) setCameraOpen(true);
    else void submit();
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.root}>
      <Screen
        refreshing={todayQ.isRefetching}
        onRefresh={() => {
          void locate();
          void todayQ.refetch();
        }}
      >
        {/* Header */}
        <Text style={styles.portalTag}>STAFF PUNCH</Text>
        <Text style={styles.greetHi}>{nextLabel}</Text>
        <Text style={styles.greetDate}>
          {formatBreadcrumbDate(today)}
          {user?.schoolName ? `  ·  within 100 m of ${user.schoolName}` : "  ·  geo + selfie"}
        </Text>

        {/* Status hero */}
        <View style={[styles.statusHero, { backgroundColor: heroTint.base }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.statusHeroKicker, { color: heroTint.deep }]}>{statusKicker}</Text>
            <Text style={[styles.statusHeroValue, { color: heroTint.deep }]} numberOfLines={1}>{statusValue}</Text>
            <Text style={styles.statusHeroSub} numberOfLines={2}>{statusSub}</Text>
          </View>
          <View style={[styles.statusHeroIcon, { backgroundColor: "rgba(255,255,255,0.5)" }]}>
            <Ionicons name={statusIcon} size={26} color={heroTint.deep} />
          </View>
        </View>

        {lastPunch?.isOutside ? (
          <View style={styles.warnBanner}>
            <Ionicons name="warning-outline" size={18} color={colors.warn} />
            <Text style={styles.warnText}>
              Last punch was{" "}
              {((lastPunch.distanceM ?? 0) / 1000).toFixed(2)} km from{" "}
              {user?.schoolName ?? "school"} (allowed 100 m). HR is notified.
            </Text>
          </View>
        ) : null}

        {/* Today's first-in / last-out overview */}
        <View style={styles.summaryRow}>
            <SummaryCard
              label="FIRST IN"
              value={summary.firstInAt ? clockTime(summary.firstInAt) : "—"}
              sub={
                summary.firstInDistance != null
                  ? `${(summary.firstInDistance / 1000).toFixed(2)} km`
                  : summary.firstInAt
                  ? "today"
                  : "no check-in yet"
              }
              icon="checkmark-outline"
              tint={tints.mint}
            />
            <SummaryCard
              label="LAST OUT"
              value={summary.lastOutAt ? clockTime(summary.lastOutAt) : "—"}
              sub={
                summary.lastOutAt
                  ? "today"
                  : summary.status === "in"
                  ? "still in"
                  : "—"
              }
              icon="arrow-forward-outline"
              tint={summary.lastOutAt ? tints.peach : tints.peach}
            />
        </View>

        {punchOutLocked && unlockAtMs != null ? (
          /* Punch-out locked — show the countdown instead of the steps. */
          <View style={styles.lockCard}>
            <View style={styles.lockIcon}>
              <Ionicons name="time" size={22} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.lockLabel}>PUNCH OUT LOCKED</Text>
              <Text style={styles.lockTitle}>
                Available in {fmtCountdown(unlockAtMs - nowMs)}
              </Text>
              <Text style={styles.lockSub}>
                You punched in at {summary.statusAt ? clockTime(summary.statusAt) : "—"}. To
                prevent accidental double-punches, Punch Out unlocks at{" "}
                {clockTime(new Date(unlockAtMs).toISOString())}.
              </Text>
            </View>
          </View>
        ) : (
        <>
        {/* Prerequisites */}
        <View style={styles.prereqRow}>
          <PrereqChip
            label="Location"
            state={locating ? "Locating…" : locReady ? "Ready" : locError ? "Failed — retry" : "Tap to add"}
            done={locReady}
            icon="location-outline"
            onPress={() => void locate()}
          />
          <PrereqChip
            label="Selfie"
            state={selfie ? "Captured" : capturing ? "Processing…" : "Tap to add"}
            done={!!selfie}
            icon="camera-outline"
            thumb={selfie?.uri}
            onPress={() => setCameraOpen(true)}
          />
        </View>

        {/* Big guided punch button — advances Location → Selfie → Punch */}
        <Pressable
          onPress={primaryAction}
          disabled={primaryDisabled}
          style={({ pressed }) => [styles.bigWrap, pressed && !primaryDisabled && { opacity: 0.92 }]}
        >
          <View style={[styles.bigCircle, { backgroundColor: actionColor }, primaryDisabled && { opacity: 0.7 }]}>
            <Ionicons name={actionIcon} size={46} color={colors.white} />
          </View>
          <Text style={styles.bigLabel}>{actionLabel}</Text>
          <Text style={styles.bigHint}>{actionHint}</Text>
        </Pressable>
        </>
        )}

        <StateView loading={todayQ.isLoading && !todayQ.data} />
      </Screen>
      <PunchSuccess
        visible={success.visible}
        label={success.label}
        onDone={() => setSuccess({ visible: false, label: "" })}
      />
      <SelfieCamera
        visible={cameraOpen}
        onCancel={() => setCameraOpen(false)}
        onCapture={(uri) => void handleCapturedSelfie(uri)}
      />
    </SafeAreaView>
  );
}

/* ---------------------------------------------------------------- pieces */

function SummaryCard({
  label,
  value,
  sub,
  icon,
  tint,
}: {
  label: string;
  value: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: { base: string; deep: string };
}) {
  return (
    <View style={styles.summary}>
      <View style={[styles.summaryIcon, { backgroundColor: tint.base }]}>
        <Ionicons name={icon} size={18} color={tint.deep} />
      </View>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.mono} numberOfLines={1}>{sub}</Text>
    </View>
  );
}

function PrereqChip({
  label,
  state,
  done,
  icon,
  thumb,
  onPress,
}: {
  label: string;
  state: string;
  done: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  thumb?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(16,13,10,0.06)" }}
      style={[styles.prereq, done && styles.prereqDone]}
    >
      {thumb ? (
        <Image source={{ uri: thumb }} style={styles.prereqThumb} />
      ) : (
        <View style={[styles.prereqIcon, done && { backgroundColor: colors.success }]}>
          <Ionicons name={done ? "checkmark" : icon} size={16} color={done ? colors.white : colors.ink60} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.prereqLabel}>{label}</Text>
        <Text style={styles.prereqState} numberOfLines={1}>{state}</Text>
      </View>
    </Pressable>
  );
}

function NumberedStep({
  n,
  title,
  subtitle,
  done,
  right,
  children,
}: {
  n: number;
  title: string;
  subtitle?: string;
  done?: boolean;
  right: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.step}>
      <View style={styles.stepHead}>
        <View style={[styles.stepNum, done && styles.stepNumDone]}>
          {done ? (
            <Ionicons name="checkmark" size={16} color={colors.white} />
          ) : (
            <Text style={styles.stepNumText}>{n}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.stepTitle}>{title}</Text>
          {subtitle ? <Text style={styles.mono}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      <View style={{ gap: space[2], paddingLeft: 36 }}>{children}</View>
    </View>
  );
}

/** Full-screen green-tick success burst shown after a punch is recorded. */
function PunchSuccess({
  visible,
  label,
  onDone,
}: {
  visible: boolean;
  label: string;
  onDone: () => void;
}) {
  const scrim = useRef(new Animated.Value(0)).current;
  const circle = useRef(new Animated.Value(0)).current;
  const check = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scrim.setValue(0);
    circle.setValue(0);
    check.setValue(0);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(scrim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(circle, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 12 }),
      ]),
      Animated.spring(check, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 18 }),
    ]).start();
    const t = setTimeout(() => {
      Animated.timing(scrim, { toValue: 0, duration: 240, useNativeDriver: true }).start(() => onDone());
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.successScrim, { opacity: scrim }]}>
      <Animated.View style={[styles.successCircle, { transform: [{ scale: circle }] }]}>
        <Animated.View style={{ transform: [{ scale: check }] }}>
          <Ionicons name="checkmark-sharp" size={62} color={colors.white} />
        </Animated.View>
      </Animated.View>
      <Text style={styles.successText}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  successScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(16,13,10,0.5)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  successCircle: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space[4],
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  successText: {
    color: colors.white,
    fontSize: fontSize.h1,
    fontWeight: "800",
    letterSpacing: -0.2,
  },

  root: { flex: 1, backgroundColor: colors.white },

  /* Top zone */
  topRow: { flexDirection: "row", alignItems: "center", gap: space[3], marginBottom: space[5] },
  brandCoin: { width: 40, height: 40, borderRadius: 20 },
  brandName: { fontSize: 15, fontWeight: "800", color: colors.ink, letterSpacing: -0.2 },
  portalTag: { fontSize: 11, fontWeight: "700", color: colors.orangeDeep, letterSpacing: 0.2, marginTop: 1 },
  greetHi: { fontSize: 25, fontWeight: "900", color: colors.ink, letterSpacing: -0.7 },
  greetDate: { fontSize: fontSize.bodyS, color: colors.ink60, marginTop: 4, fontWeight: "600" },

  /* Status hero */
  statusHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    borderRadius: 22,
    padding: space[4],
    marginTop: space[4],
  },
  statusHeroKicker: { fontSize: fontSize.label, fontWeight: "800", letterSpacing: 1.4 },
  statusHeroValue: { fontSize: fontSize.displayS, fontWeight: "900", letterSpacing: -0.4, marginTop: 2 },
  statusHeroSub: { fontSize: fontSize.bodyS, color: colors.ink60, marginTop: 4, fontWeight: "600" },
  statusHeroIcon: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },

  summaryRow: { flexDirection: "row", gap: space[3] },

  /* Prerequisites */
  prereqRow: { flexDirection: "row", gap: space[3], marginTop: space[2] },
  prereq: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 16,
    padding: space[3],
    ...shadow.card,
  },
  prereqDone: { borderColor: "rgba(31,111,74,0.35)" },
  prereqIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: "#F4F3F0",
    alignItems: "center", justifyContent: "center",
  },
  prereqThumb: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#F4F3F0" },
  prereqLabel: { fontSize: fontSize.bodyS, fontWeight: "800", color: colors.ink },
  prereqState: { fontSize: 11, color: colors.ink60, fontWeight: "600", marginTop: 1 },

  /* Big guided punch button */
  bigWrap: { alignItems: "center", paddingVertical: space[5], gap: space[3] },
  bigCircle: {
    width: 156, height: 156, borderRadius: 78,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#2A2520",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 8,
  },
  bigLabel: { fontSize: fontSize.displayS, fontWeight: "900", color: colors.ink, letterSpacing: -0.4 },
  bigHint: { fontSize: fontSize.bodyS, color: colors.ink60, fontWeight: "600", textAlign: "center", marginTop: -6 },

  /* Geofence warning banner */
  warnBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space[2],
    backgroundColor: colors.warnSoft,
    borderWidth: 1,
    borderColor: colors.warn,
    borderRadius: radius[3],
    padding: space[3],
  },
  warnText: { flex: 1, fontSize: fontSize.bodyS, color: colors.ink80, lineHeight: 19 },

  /* Punch-out lock card */
  lockCard: {
    flexDirection: "row",
    gap: space[3],
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.rule,
    borderStyle: "dashed",
    borderRadius: radius[4],
    padding: space[4],
    alignItems: "center",
  },
  lockIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  lockLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.ink40,
    letterSpacing: 1.4,
  },
  lockTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  lockSub: { fontSize: fontSize.bodyS, color: colors.ink60, lineHeight: 19, marginTop: 4 },

  /* Direction toggle */
  toggle: {
    flexDirection: "row",
    gap: space[2],
  },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
    paddingVertical: space[4],
    borderRadius: radius[3],
    borderWidth: 1,
  },
  toggleBtnActiveIn: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  toggleBtnActiveOut: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  toggleBtnOff: {
    backgroundColor: "#F4F3F0",
    borderColor: colors.rule,
    // Fade the unavailable direction (e.g. "Check In" while you're punched in).
    opacity: 0.55,
  },
  toggleText: { fontSize: fontSize.bodyL, fontWeight: "800", letterSpacing: -0.2 },
  toggleTextActive: { color: colors.white },
  toggleTextOff: { color: colors.ink40 },

  /* Summary tiles (2-up) */
  summary: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 18,
    padding: space[4],
    gap: 6,
    ...shadow.card,
  },
  summaryIcon: {
    width: 34,
    height: 34,
    borderRadius: radius[3],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.ink40,
    letterSpacing: 1.4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.4,
    lineHeight: 24,
  },
  mono: { fontSize: 12, color: colors.ink60 },

  /* Numbered step cards */
  step: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 18,
    padding: space[4],
    gap: space[3],
    ...shadow.card,
  },
  stepHead: { flexDirection: "row", alignItems: "center", gap: space[3] },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumDone: { backgroundColor: colors.success },
  stepNumText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "800",
  },
  stepTitle: {
    fontSize: fontSize.bodyL,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.2,
  },

  coords: {
    fontSize: fontSize.body,
    color: colors.ink,
    fontWeight: "600",
  },

  subBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#F4F3F0",
    borderRadius: radius[3],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  subBtnText: {
    fontSize: fontSize.bodyS,
    fontWeight: "700",
    color: colors.ink,
  },

  openCam: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    alignSelf: "flex-start",
    backgroundColor: colors.ink,
    borderRadius: radius[3],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  openCamText: {
    color: colors.cream,
    fontWeight: "700",
    fontSize: fontSize.bodyS,
  },

  selfieThumb: {
    width: 44,
    height: 44,
    borderRadius: radius[3],
    backgroundColor: colors.cream,
  },

  submit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.orange,
    borderRadius: 16,
    paddingVertical: space[4],
    marginTop: space[2],
  },
  submitOff: { opacity: 0.45 },
  submitText: {
    color: colors.white,
    fontWeight: "800",
    fontSize: fontSize.bodyL,
    letterSpacing: -0.2,
  },
});
