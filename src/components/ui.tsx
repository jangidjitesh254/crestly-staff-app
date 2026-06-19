/**
 * Crestly Staff — shared UI primitives.
 * Styled strictly from src/theme.ts (the @crestly/design token mirror).
 */
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  type PressableProps,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from "react-native";
// JS-only ScrollView wrapper that scrolls focused inputs above the keyboard
// on iOS and Android. No native module needed, works in Expo Go.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — package ships without bundled types
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fontSize, radius, space } from "../theme";

/* -------------------------------------------------------- FadeInView */

/** Fades + slides up on mount. Use to stagger lists of cards. */
export function FadeInView({
  children,
  delay = 0,
  duration = 320,
  offset = 10,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  offset?: number;
  style?: ViewStyle;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(offset)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, duration, delay]);
  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

/* ------------------------------------------------------ AnimatedPressable */

/** Pressable that springs down to scale 0.97 on press and back on release. */
function PressableScale({
  onPress,
  disabled,
  style,
  children,
  androidRipple = true,
  ...rest
}: PressableProps & { androidRipple?: boolean; children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        Animated.spring(scale, {
          toValue: 0.97,
          useNativeDriver: true,
          speed: 50,
          bounciness: 0,
        }).start();
      }}
      onPressOut={() => {
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 30,
          bounciness: 4,
        }).start();
      }}
      android_ripple={
        androidRipple && !disabled
          ? { color: "rgba(16,13,10,0.08)", borderless: false }
          : undefined
      }
      {...rest}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style as ViewStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/* ---------------------------------------------------------------- Screen */

export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  // A real spacer view (not just padding) guarantees the last row scrolls
  // above the floating tab bar (~72 tall) on every device — independent of
  // how the scroll library treats contentContainerStyle.
  const bottomSpacer = Math.max(insets.bottom, 12) + 96;
  if (!scroll) {
    return (
      <View style={[styles.screen, styles.pad, contentStyle]}>
        {children}
        <View style={{ height: bottomSpacer }} />
      </View>
    );
  }
  return (
    <KeyboardAwareScrollView
      style={styles.screen}
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      enableOnAndroid
      extraScrollHeight={Platform.OS === "android" ? 24 : 0}
      enableResetScrollToCoords={false}
      refreshControl={
        onRefresh
          ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.orange} />
          : undefined
      }
    >
      {children}
      <View style={{ height: bottomSpacer }} />
    </KeyboardAwareScrollView>
  );
}

/* ----------------------------------------------------------- SavedToast */

/**
 * Banner that slides down from the top of the screen with a spring tick mark.
 * Self-dismisses after ~1.8s. Render once per screen, control via React state.
 */
export function SavedToast({
  visible,
  text,
  onHide,
}: {
  visible: boolean;
  text: string;
  onHide: () => void;
}) {
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    translateY.setValue(-80);
    opacity.setValue(0);
    checkScale.setValue(0);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 14,
        bounciness: 6,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    Animated.spring(checkScale, {
      toValue: 1,
      useNativeDriver: true,
      delay: 120,
      speed: 10,
      bounciness: 18,
    }).start();

    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -80,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => onHide());
    }, 1800);
    return () => clearTimeout(t);
  }, [visible, translateY, opacity, checkScale, onHide]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <Animated.View style={[styles.toastDot, { transform: [{ scale: checkScale }] }]}>
        <CheckGlyph />
      </Animated.View>
      <Text style={styles.toastText} numberOfLines={2}>
        {text}
      </Text>
    </Animated.View>
  );
}

function CheckGlyph() {
  // Inline mark — no extra icon import needed.
  return (
    <View style={styles.checkGlyph}>
      <View style={styles.checkArm1} />
      <View style={styles.checkArm2} />
    </View>
  );
}

/* ----------------------------------------------------------------- Text */

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{String(children).toUpperCase()}</Text>;
}

/* ----------------------------------------------------------------- Card */

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}) {
  if (onPress) {
    return (
      <PressableScale onPress={onPress} style={[styles.card, style]}>
        {children}
      </PressableScale>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

/* --------------------------------------------------------------- Button */

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export function Button({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const off = disabled || loading;
  const v = BUTTON_VARIANTS[variant];
  return (
    <PressableScale
      onPress={onPress}
      disabled={off}
      style={[
        styles.button,
        { backgroundColor: v.bg, borderColor: v.border },
        off && styles.buttonOff,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} size="small" />
      ) : (
        <Text style={[styles.buttonLabel, { color: v.fg }]}>{label}</Text>
      )}
    </PressableScale>
  );
}

const BUTTON_VARIANTS: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.orange, fg: colors.white, border: colors.orange },
  secondary: { bg: colors.white, fg: colors.ink, border: colors.ruleStrong },
  danger: { bg: colors.errorSoft, fg: colors.error, border: colors.errorSoft },
  ghost: { bg: "transparent", fg: colors.ink60, border: "transparent" },
};

/* ---------------------------------------------------------------- Badge */

export function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/* ------------------------------------------------------------ TextField */

export function TextField({
  label,
  style,
  ...props
}: TextInputProps & { label?: string }) {
  return (
    <View style={{ gap: space[1] }}>
      {label ? <SectionLabel>{label}</SectionLabel> : null}
      <TextInput
        placeholderTextColor={colors.ink40}
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
}

/* ---------------------------------------------------------- Segmented */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; activeBg?: string; activeFg?: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              styles.segment,
              active && {
                backgroundColor: opt.activeBg ?? colors.orange,
              },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: active ? opt.activeFg ?? colors.white : colors.ink60 },
              ]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ----------------------------------------------------------- Stepper */

export function Stepper({
  label,
  onPrev,
  onNext,
  nextDisabled,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={onPrev} style={styles.stepperBtn} hitSlop={8}>
        <Text style={styles.stepperArrow}>‹</Text>
      </Pressable>
      <Text style={styles.stepperLabel}>{label}</Text>
      <Pressable
        onPress={onNext}
        disabled={nextDisabled}
        style={[styles.stepperBtn, nextDisabled && styles.buttonOff]}
        hitSlop={8}
      >
        <Text style={styles.stepperArrow}>›</Text>
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------ KeyValue */

export function KeyValue({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={styles.kvVal}>{v}</Text>
    </View>
  );
}

/* ------------------------------------------------------------ StateView */

/** Renders loading / error / empty placeholders; returns null when ready. */
export function StateView({
  loading,
  error,
  empty,
  emptyText = "Nothing here yet.",
  onRetry,
}: {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  emptyText?: string;
  onRetry?: () => void;
}): React.ReactElement | null {
  if (loading) {
    return (
      <View style={styles.state}>
        <ActivityIndicator color={colors.orange} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.state}>
        <Text style={styles.stateText}>
          {error instanceof Error ? error.message : "Something went wrong."}
        </Text>
        {onRetry ? <Button label="Retry" variant="secondary" onPress={onRetry} /> : null}
      </View>
    );
  }
  if (empty) {
    return (
      <View style={styles.state}>
        <Text style={styles.stateText}>{emptyText}</Text>
      </View>
    );
  }
  return null;
}

/* ----------------------------------------------------------------- styles */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.creamSoft },
  pad: { padding: space[4] },
  scrollContent: { padding: space[4], gap: space[3] },

  title: {
    fontSize: fontSize.displayS,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.4,
  },
  subtitle: { fontSize: fontSize.body, color: colors.ink60 },
  sectionLabel: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.ink40,
    letterSpacing: 1.4,
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.rule,
    padding: space[4],
    gap: space[2],
  },
  pressed: { opacity: 0.7 },

  button: {
    minHeight: 48,
    borderRadius: radius[3],
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space[4],
  },
  buttonOff: { opacity: 0.45 },
  buttonLabel: { fontSize: fontSize.bodyL, fontWeight: "700" },

  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
  badgeText: { fontSize: fontSize.cap, fontWeight: "700" },

  input: {
    minHeight: 48,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.ruleStrong,
    borderRadius: radius[3],
    paddingHorizontal: space[3],
    fontSize: fontSize.bodyL,
    color: colors.ink,
  },

  segmented: {
    flexDirection: "row",
    backgroundColor: colors.cream,
    borderRadius: radius[3],
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minHeight: 38,
    borderRadius: radius[2],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  segmentText: { fontSize: fontSize.bodyS, fontWeight: "700" },

  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius[3],
    paddingHorizontal: space[2],
    minHeight: 46,
  },
  stepperBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  stepperArrow: { fontSize: 26, color: colors.orange, fontWeight: "800", lineHeight: 30 },
  stepperLabel: { fontSize: fontSize.body, fontWeight: "700", color: colors.ink },

  kv: { flexDirection: "row", justifyContent: "space-between", gap: space[3] },
  kvKey: { fontSize: fontSize.body, color: colors.ink60 },
  kvVal: { fontSize: fontSize.body, color: colors.ink, fontWeight: "600", flexShrink: 1, textAlign: "right" },

  state: { padding: space[7], alignItems: "center", gap: space[3] },
  stateText: { fontSize: fontSize.body, color: colors.ink60, textAlign: "center" },

  /* SavedToast */
  toast: {
    position: "absolute",
    top: space[3],
    left: space[4],
    right: space[4],
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    backgroundColor: colors.white,
    borderRadius: radius[4],
    borderWidth: 1,
    borderColor: colors.rule,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 6,
    zIndex: 100,
  },
  toastDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  toastText: {
    flex: 1,
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.ink,
  },
  /* Inline tick mark — two rotated bars form a check. */
  checkGlyph: {
    width: 14,
    height: 14,
    transform: [{ translateY: -1 }],
  },
  checkArm1: {
    position: "absolute",
    width: 7,
    height: 2.5,
    backgroundColor: colors.white,
    borderRadius: 2,
    bottom: 3,
    left: 0,
    transform: [{ rotate: "45deg" }],
  },
  checkArm2: {
    position: "absolute",
    width: 12,
    height: 2.5,
    backgroundColor: colors.white,
    borderRadius: 2,
    bottom: 5,
    left: 3,
    transform: [{ rotate: "-45deg" }],
  },
});
