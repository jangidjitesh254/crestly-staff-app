import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../store/auth";
import { getErrorMessage } from "../lib/api";

const C = {
  bg:        "#FFFFFF",
  orange:    "#E8621A",
  orangeDeep:"#C9460C",
  orangeTint:"#FCE7DA",
  ink:       "#15110D",
  ink70:     "#3A342D",
  ink50:     "#8C857A",
  ink30:     "#B4ADA1",
  ink20:     "#C9C2B6",
  ink10:     "#E7E1D6",
  hair:      "#ECE6DB",
};

export function LoginScreen() {
  const { signIn } = useAuth();
  const { width } = useWindowDimensions();
  const maxW = Math.min(width, 460);

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setError(null);
    if (phone.replace(/\D/g, "").length < 10 || password.length < 1) {
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
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[s.formCol, { maxWidth: maxW }]}>
            {/* Brand */}
            <View style={s.brand}>
              <Image source={require("../../assets/icon.png")} style={s.markImg} />
              <Text style={s.wordmark}>Crestly</Text>
              <View style={s.pill}>
                <Text style={s.pillText}>STAFF</Text>
              </View>
            </View>

            {/* Heading */}
            <Text style={s.hello}>Welcome</Text>
            <Text style={s.there}>back!</Text>
            <Text style={s.sub}>Sign in with your school staff account.</Text>

            {/* Phone */}
            <View style={s.field}>
              <Ionicons name="call-outline" size={19} color={C.ink50} />
              <TextInput
                style={s.fieldInput}
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/[^\d+ ]/g, "").slice(0, 15))}
                keyboardType="phone-pad"
                autoComplete="tel"
                placeholder="Phone number"
                placeholderTextColor={C.ink20}
                maxLength={15}
                returnKeyType="next"
              />
            </View>

            {/* Password */}
            <View style={s.field}>
              <Ionicons name="lock-closed-outline" size={19} color={C.ink50} />
              <TextInput
                style={s.fieldInput}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                placeholder="Password"
                placeholderTextColor={C.ink20}
                returnKeyType="go"
                onSubmitEditing={submit}
              />
              <TouchableOpacity onPress={() => setShowPw((v) => !v)} hitSlop={8} accessibilityLabel="Toggle password">
                <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={20} color={C.ink50} />
              </TouchableOpacity>
            </View>

            {/* Error */}
            {error ? (
              <View style={s.error}>
                <Ionicons name="alert-circle" size={16} color="#C0392B" />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* CTA */}
            <TouchableOpacity
              style={[s.btn, busy && s.btnBusy]}
              onPress={submit}
              activeOpacity={0.88}
              disabled={busy}
            >
              <Text style={s.btnText}>{busy ? "Signing in…" : "Sign in"}</Text>
              {!busy ? <Ionicons name="arrow-forward" size={18} color="#fff" /> : null}
            </TouchableOpacity>
          </View>

          {/* Footer pinned to the bottom */}
          <View style={[s.footerWrap, { maxWidth: maxW }]}>
            <Text style={s.privacy}>Crestly School ERP · Staff</Text>
            <Text style={s.brandFoot}>Powered by Shadowbiz Startups</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: C.bg },
  flex:  { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 26,
    paddingTop: 24,
    paddingBottom: 18,
  },
  formCol: { flex: 1, width: "100%", alignSelf: "center", justifyContent: "center" },
  footerWrap: { width: "100%", alignSelf: "center", paddingTop: 16 },

  brand: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 34 },
  markImg: { width: 44, height: 44, borderRadius: 13 },
  wordmark: { fontSize: 22, fontWeight: "800", color: C.ink, letterSpacing: -0.5 },
  pill: {
    backgroundColor: C.orangeTint,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: { fontSize: 10, fontWeight: "900", color: C.orangeDeep, letterSpacing: 1.4 },

  hello: { fontSize: 42, fontWeight: "900", color: C.orange, letterSpacing: -1.4, lineHeight: 46 },
  there: { fontSize: 42, fontWeight: "900", color: C.ink, letterSpacing: -1.4, lineHeight: 46, marginBottom: 12 },
  sub: { fontSize: 13.5, color: C.ink50, lineHeight: 20, marginBottom: 28 },

  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.hair,
    borderRadius: 16,
    paddingHorizontal: 16,
    minHeight: 60,
    marginBottom: 14,
  },
  fieldInput: { flex: 1, fontSize: 16, color: C.ink, paddingVertical: 16 },

  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FCEDEB",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 12,
  },
  errorText: { flex: 1, color: "#B23B2A", fontSize: 13, fontWeight: "700" },

  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.orange,
    borderRadius: 16,
    paddingVertical: 19,
    marginTop: 22,
    shadowColor: C.orange,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 20,
    elevation: 5,
  },
  btnBusy: { opacity: 0.65 },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "800", letterSpacing: 0.2 },

  privacy: { textAlign: "center", fontSize: 12.5, color: C.ink30, lineHeight: 19 },
  brandFoot: { textAlign: "center", fontSize: 11, color: C.ink20, fontWeight: "700", marginTop: 8, letterSpacing: 0.3 },
});
