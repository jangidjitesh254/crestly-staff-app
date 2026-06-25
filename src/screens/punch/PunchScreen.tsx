import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import type { PunchType, PunchCreateInput } from "../../types/api";
import { usePunch, usePunchToday } from "../../hooks/queries";
import { useAuth } from "../../store/auth";
import { Screen, StateView } from "../../components/ui";
import { TopBar } from "../../components/TopBar";
import { PageHead } from "../../components/PageHead";
import { InfoCard } from "../../components/InfoCard";
import { SelfieCamera } from "../../components/SelfieCamera";
import { getErrorMessage } from "../../lib/api";
import { getCurrentPosition, type Position } from "../../lib/location";
import { formatBreadcrumbDate, todayIso } from "../../lib/dates";
import { colors, fontSize, radius, space, tints } from "../../theme";

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
      <View style={styles.root}>
        <TopBar />
        <Screen>
          <PageHead crumb="Self" title="Punch" />
          <InfoCard
            lead="Not enabled."
            body="Check-in is not enabled for your role. Ask an admin to grant you the staff.punch permission."
          />
        </Screen>
      </View>
    );
  }

  const locReady = !!position && !locating && !locError;
  const canSubmit = locReady && !!selfie && !punch.isPending;

  return (
    <View style={styles.root}>
      <TopBar />
      <Screen
        refreshing={todayQ.isRefetching}
        onRefresh={() => {
          void locate();
          void todayQ.refetch();
        }}
      >
        <PageHead
          crumb="Self"
          date={formatBreadcrumbDate(today)}
          title={nextLabel}
          subtitle={
            user?.schoolName
              ? `Geo-tagged + selfie · within 100 m of ${user.schoolName}.`
              : "Geo-tagged + selfie required."
          }
        />

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

        {/* Two-option toggle. The action that doesn't make sense in your
            current state is shown dull and is not tappable. */}
        <View style={styles.toggle}>
          <View
            style={[
              styles.toggleBtn,
              !isCurrentlyIn ? styles.toggleBtnActiveIn : styles.toggleBtnOff,
            ]}
          >
            <Ionicons
              name="log-in-outline"
              size={18}
              color={!isCurrentlyIn ? colors.white : colors.ink40}
            />
            <Text
              style={[
                styles.toggleText,
                !isCurrentlyIn ? styles.toggleTextActive : styles.toggleTextOff,
              ]}
            >
              Check In
            </Text>
          </View>
          <View
            style={[
              styles.toggleBtn,
              isCurrentlyIn ? styles.toggleBtnActiveOut : styles.toggleBtnOff,
            ]}
          >
            <Ionicons
              name="log-out-outline"
              size={18}
              color={isCurrentlyIn ? colors.white : colors.ink40}
            />
            <Text
              style={[
                styles.toggleText,
                isCurrentlyIn ? styles.toggleTextActive : styles.toggleTextOff,
              ]}
            >
              Check Out
            </Text>
          </View>
        </View>

        {/* 3-card status overview, mirrors the web Punch summary */}
        <View style={{ gap: space[2] }}>
            <SummaryCard
              label="STATUS"
              value={summary.status === "in" ? "In" : summary.status === "out" ? "Out" : "—"}
              sub={
                summary.statusAt
                  ? `since ${clockTime(summary.statusAt)}`
                  : "not punched in yet"
              }
              icon="time-outline"
              tint={
                summary.status === "in"
                  ? tints.mint
                  : summary.status === "out"
                  ? tints.peach
                  : tints.wheat
              }
            />
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
        {/* Numbered step cards */}
        <NumberedStep
          n={1}
          title="Get your location"
          done={locReady}
          right={
            <Ionicons
              name="location-outline"
              size={22}
              color={locReady ? colors.success : colors.ink40}
            />
          }
        >
          {locating ? (
            <Text style={styles.mono}>requesting…</Text>
          ) : locError ? (
            <Text style={[styles.mono, { color: colors.error }]}>{locError}</Text>
          ) : position ? (
            <Text style={styles.coords}>
              {position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}
              {position.accuracyM != null ? ` · ±${position.accuracyM} m` : ""}
            </Text>
          ) : (
            <Text style={styles.mono}>not available</Text>
          )}
          <Pressable
            onPress={() => void locate()}
            android_ripple={{ color: "rgba(16,13,10,0.08)" }}
            style={({ pressed }) => [styles.subBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.subBtnText}>
              {locating ? "Locating…" : locReady ? "Refresh" : "Get location"}
            </Text>
          </Pressable>
        </NumberedStep>

        <NumberedStep
          n={2}
          title="Take a selfie"
          done={!!selfie}
          subtitle="front camera only · mandatory"
          right={
            selfie ? (
              <Image source={{ uri: selfie.uri }} style={styles.selfieThumb} />
            ) : (
              <Ionicons name="camera-outline" size={22} color={colors.ink40} />
            )
          }
        >
          <Pressable
            onPress={() => setCameraOpen(true)}
            disabled={capturing}
            android_ripple={{ color: "rgba(245,239,227,0.2)" }}
            style={({ pressed }) => [
              styles.openCam,
              (pressed || capturing) && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="camera" size={16} color={colors.cream} />
            <Text style={styles.openCamText}>
              {selfie ? "Retake" : capturing ? "Processing…" : "Open camera"}
            </Text>
          </Pressable>
        </NumberedStep>

        {/* Submit */}
        <Pressable
          onPress={() => void submit()}
          disabled={!canSubmit}
          android_ripple={
            canSubmit ? { color: "rgba(245,239,227,0.2)" } : undefined
          }
          style={({ pressed }) => [
            styles.submit,
            !canSubmit && styles.submitOff,
            pressed && canSubmit && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.submitText}>
            {punch.isPending ? "Submitting…" : `Submit ${nextLabel}`}
          </Text>
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
    </View>
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
        <Ionicons name={icon} size={20} color={tint.deep} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={styles.summaryValue}>{value}</Text>
        <Text style={styles.mono}>{sub}</Text>
      </View>
    </View>
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
    backgroundColor: colors.cream,
    borderColor: colors.rule,
    // Fade the unavailable direction (e.g. "Check In" while you're punched in).
    opacity: 0.45,
  },
  toggleText: { fontSize: fontSize.bodyL, fontWeight: "800", letterSpacing: -0.2 },
  toggleTextActive: { color: colors.white },
  toggleTextOff: { color: colors.ink40 },

  /* Summary cards */
  summary: {
    flexDirection: "row",
    gap: space[3],
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius[4],
    padding: space[4],
    alignItems: "center",
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: radius[3],
    alignItems: "center",
    justifyContent: "center",
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.ink40,
    letterSpacing: 1.4,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.4,
    lineHeight: 26,
    marginTop: 2,
  },
  mono: { fontSize: 12, color: colors.ink60 },

  /* Numbered step cards */
  step: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius[4],
    padding: space[4],
    gap: space[3],
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
    backgroundColor: colors.cream,
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
    backgroundColor: colors.orange,
    borderRadius: radius[3],
    paddingVertical: space[4],
    alignItems: "center",
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
