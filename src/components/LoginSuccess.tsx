/**
 * LoginSuccess — a full-screen success flourish shown once, right after a
 * successful sign-in, before Home is revealed. Plays the Crestly-branded
 * (black circle + orange tick + confetti) Lottie, then fades the overlay out.
 */
import React, { useCallback, useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import LottieView from "lottie-react-native";
import * as Haptics from "expo-haptics";
import { colors, fontSize } from "../theme";

export function LoginSuccess({ onDone }: { onDone: () => void }) {
  const overlay = useRef(new Animated.Value(1)).current;
  const textOp = useRef(new Animated.Value(0)).current;
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    Animated.timing(overlay, {
      toValue: 0,
      duration: 320,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onDone());
  }, [overlay, onDone]);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    Animated.timing(textOp, {
      toValue: 1, duration: 260, delay: 500,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
    const t = setTimeout(finish, 2600);
    return () => clearTimeout(t);
  }, [finish, textOp]);

  return (
    <Animated.View style={[styles.overlay, { opacity: overlay }]} pointerEvents="none">
      <LottieView
        source={require("../../assets/lottie/login-tick.json")}
        autoPlay
        loop={false}
        speed={1.6}
        resizeMode="contain"
        onAnimationFinish={finish}
        style={styles.lottie}
      />
      <Animated.Text style={[styles.text, { opacity: textOp }]}>Signed in</Animated.Text>
      <View style={{ height: 24 }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  lottie: { width: 240, height: 240 },
  text: {
    fontSize: fontSize.displayS,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.3,
    marginTop: -8,
  },
});
