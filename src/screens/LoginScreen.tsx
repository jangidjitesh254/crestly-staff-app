import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../store/auth";
import { getErrorMessage } from "../lib/api";
import { Button, TextField } from "../components/ui";
import { colors, fontSize, radius, space } from "../theme";

export function LoginScreen() {
  const { signIn } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setError(null);
    if (phone.trim().length < 10 || password.length < 1) {
      setError("Enter your phone number and password.");
      return;
    }
    setBusy(true);
    try {
      await signIn(phone.trim(), password);
    } catch (err) {
      setError(getErrorMessage(err, "Login failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <View style={styles.mark}>
              <Text style={styles.markText}>C</Text>
            </View>
            <Text style={styles.wordmark}>Crestly</Text>
            <View style={styles.pill}>
              <Text style={styles.pillText}>STAFF</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>Sign in</Text>
            <Text style={styles.sub}>
              Use the phone number and password from your school account.
            </Text>

            <TextField
              label="Phone number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              placeholder="10-digit mobile number"
              maxLength={15}
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Your password"
              onSubmitEditing={submit}
              returnKeyType="go"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button label="Sign in" onPress={submit} loading={busy} />
          </View>

          <Text style={styles.footer}>Crestly School ERP · Staff App</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: space[5],
    gap: space[6],
  },
  brand: { alignItems: "center", gap: space[2] },
  mark: {
    width: 56,
    height: 56,
    borderRadius: radius[4],
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  markText: { color: colors.white, fontSize: 30, fontWeight: "800" },
  wordmark: {
    fontSize: fontSize.displayM,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.6,
  },
  pill: {
    backgroundColor: colors.orangeTint,
    borderRadius: radius.pill,
    paddingHorizontal: space[3],
    paddingVertical: 3,
  },
  pillText: {
    color: colors.orangeDeep,
    fontSize: fontSize.label,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius[5],
    borderWidth: 1,
    borderColor: colors.rule,
    padding: space[5],
    gap: space[4],
  },
  heading: { fontSize: fontSize.displayS, fontWeight: "800", color: colors.ink },
  sub: { fontSize: fontSize.bodyS, color: colors.ink60, marginTop: -space[2] },
  error: {
    color: colors.error,
    backgroundColor: colors.errorSoft,
    fontSize: fontSize.bodyS,
    padding: space[3],
    borderRadius: radius[3],
    overflow: "hidden",
  },
  footer: {
    textAlign: "center",
    color: colors.ink40,
    fontSize: fontSize.cap,
  },
});
