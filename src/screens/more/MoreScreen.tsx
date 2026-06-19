import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../../store/auth";
import { FadeInView, Screen } from "../../components/ui";
import { TopBar } from "../../components/TopBar";
import { PageHead } from "../../components/PageHead";
import { formatBreadcrumbDate, todayIso } from "../../lib/dates";
import { colors, fontSize, radius, space, tints } from "../../theme";
import type { MoreStackParams } from "../../navigation/types";

type Props = NativeStackScreenProps<MoreStackParams, "MoreHome">;

interface FeatureCard {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: { base: string; deep: string };
  go?: () => void;
  perm: string | null;
}

interface Section {
  label: string;
  items: FeatureCard[];
}

export function MoreScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const hasPerm = (p: string | null) =>
    p === null ? true : Boolean(user?.permissions.includes(p));

  function confirmSignOut() {
    Alert.alert("Logout?", "You'll need to enter your phone & password again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: () => void signOut() },
    ]);
  }

  const sections: Section[] = [
    {
      label: "MY DAY",
      items: [
        {
          key: "leaves",
          label: "My Leaves",
          icon: "briefcase-outline",
          tint: tints.mint,
          go: () => navigation.navigate("LeavesList"),
          perm: null,
        },
        {
          key: "salary",
          label: "My Salary",
          icon: "wallet-outline",
          tint: tints.mustard,
          go: () => navigation.navigate("Salary"),
          perm: null,
        },
        {
          key: "diary",
          label: "Daily Diary",
          icon: "book-outline",
          tint: tints.wheat,
          perm: "diary.log",
        },
      ],
    },
    {
      label: "SCHOOL",
      items: [
        {
          key: "holidays",
          label: "Holidays",
          icon: "calendar-clear-outline",
          tint: tints.sky,
          go: () => navigation.navigate("Holidays"),
          perm: null,
        },
        {
          key: "exams",
          label: "Exams",
          icon: "school-outline",
          tint: tints.mint,
          go: () => navigation.navigate("Exams"),
          perm: "exams.view",
        },
      ],
    },
    {
      label: "ACCOUNT",
      items: [
        {
          key: "logout",
          label: "Logout",
          icon: "log-out-outline",
          tint: { base: colors.errorSoft, deep: colors.error },
          go: confirmSignOut,
          perm: null,
        },
      ],
    },
  ];

  return (
    <View style={styles.root}>
      <TopBar />
      <Screen>
        <PageHead
          crumb="Account"
          date={formatBreadcrumbDate(todayIso())}
          title="Profile"
          subtitle="Your services, school info & logout."
        />

        {sections.map((sec, si) => (
          <FadeInView key={sec.label} delay={si * 80}>
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>{sec.label}</Text>
              <View style={styles.grid}>
                {sec.items.map((it) => {
                  const allowed = hasPerm(it.perm);
                  const ready = !!it.go;
                  const enabled = allowed && ready;
                  return (
                    <Pressable
                      key={it.key}
                      onPress={enabled ? it.go : undefined}
                      disabled={!enabled}
                      android_ripple={
                        enabled ? { color: "rgba(16,13,10,0.08)" } : undefined
                      }
                      style={({ pressed }) => [
                        styles.tile,
                        pressed && enabled && styles.tilePressed,
                        !enabled && styles.tileOff,
                      ]}
                    >
                      <View style={[styles.tileIcon, { backgroundColor: it.tint.base }]}>
                        <Ionicons name={it.icon} size={22} color={it.tint.deep} />
                      </View>
                      <Text style={styles.tileLabel}>{it.label}</Text>
                      {!enabled ? (
                        <View style={styles.soonBadge}>
                          <Text style={styles.soonText}>
                            {!allowed ? "LOCKED" : "SOON"}
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </FadeInView>
        ))}

        <Text style={styles.footer}>
          Powered by{" "}
          <Text style={styles.footerStrong}>Shadowbiz Startups Developer.</Text>
          {"\n"}Built to support the school ecosystem.
        </Text>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.creamSoft },

  sectionBlock: { gap: space[2], marginTop: space[3] },
  sectionLabel: {
    fontSize: fontSize.label,
    fontWeight: "800",
    color: colors.ink40,
    letterSpacing: 1.6,
  },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: space[3] },
  tile: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 20,
    padding: space[4],
    minHeight: 110,
    gap: space[3],
    overflow: "hidden",
  },
  tilePressed: { transform: [{ scale: 0.98 }] },
  tileOff: { opacity: 0.55 },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: radius[3],
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: {
    fontSize: fontSize.bodyL,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.2,
  },
  soonBadge: {
    position: "absolute",
    top: space[3],
    right: space[3],
    backgroundColor: colors.cream,
    borderRadius: radius.pill,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
  soonText: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.ink40,
    letterSpacing: 1.2,
  },

  footer: {
    marginTop: space[6],
    paddingTop: space[5],
    borderTopWidth: 1,
    borderTopColor: colors.rule,
    fontSize: fontSize.bodyS,
    color: colors.ink40,
    textAlign: "center",
    lineHeight: 20,
  },
  footerStrong: { color: colors.ink, fontWeight: "700" },
});
