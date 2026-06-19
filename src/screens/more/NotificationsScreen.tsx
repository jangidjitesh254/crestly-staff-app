import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AppNotification } from "../../types/api";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "../../hooks/queries";
import { Card, FadeInView, Screen, StateView } from "../../components/ui";
import { TopBar } from "../../components/TopBar";
import { PageHead } from "../../components/PageHead";
import { getErrorMessage } from "../../lib/api";
import { formatBreadcrumbDate, todayIso } from "../../lib/dates";
import { colors, fontSize, radius, space } from "../../theme";
import type { RootStackParams } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParams, "Notifications">;

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationsScreen({ navigation }: Props) {
  const inbox = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const markOne = useMarkNotificationRead();

  return (
    <View style={styles.root}>
      <TopBar showBack onBack={() => navigation.goBack()} />
      <Screen
        refreshing={inbox.isRefetching}
        onRefresh={() => void inbox.refetch()}
      >
        <PageHead
          crumb="Inbox"
          date={formatBreadcrumbDate(todayIso())}
          title="Notifications"
          subtitle={
            inbox.data
              ? inbox.data.unread === 0
                ? "All caught up."
                : `${inbox.data.unread} unread`
              : undefined
          }
        />

        {inbox.data && inbox.data.unread > 0 ? (
          <Pressable
            onPress={() => markAll.mutate()}
            android_ripple={{ color: "rgba(16,13,10,0.08)" }}
            style={({ pressed }) => [styles.markAll, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="checkmark-done" size={16} color={colors.ink} />
            <Text style={styles.markAllText}>Mark all as read</Text>
          </Pressable>
        ) : null}

        <StateView
          loading={inbox.isLoading && !inbox.data}
          error={!inbox.data && inbox.error
            ? new Error(getErrorMessage(inbox.error))
            : undefined}
          empty={!inbox.isLoading && (inbox.data?.items.length ?? 0) === 0}
          emptyText="No notifications yet."
          onRetry={() => void inbox.refetch()}
        />

        {inbox.data?.items.map((n, i) => (
          <FadeInView key={n.id} delay={i * 30}>
            <Row
              n={n}
              onTap={() => {
                if (!n.readAt) markOne.mutate(n.id);
              }}
            />
          </FadeInView>
        ))}
      </Screen>
    </View>
  );
}

function Row({ n, onTap }: { n: AppNotification; onTap: () => void }) {
  const unread = !n.readAt;
  return (
    <Card onPress={onTap} style={unread ? styles.unread : undefined}>
      <View style={styles.head}>
        <Text style={styles.title} numberOfLines={2}>
          {n.title}
        </Text>
        {unread ? <View style={styles.dot} /> : null}
      </View>
      {n.body ? (
        <Text style={styles.body} numberOfLines={4}>
          {n.body}
        </Text>
      ) : null}
      <Text style={styles.time}>{timeAgo(n.createdAt)}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.creamSoft },

  markAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    alignSelf: "flex-start",
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.ruleStrong,
    borderRadius: radius[3],
  },
  markAllText: { fontSize: fontSize.bodyS, fontWeight: "700", color: colors.ink },

  unread: { borderColor: colors.orangeTint, backgroundColor: colors.paper },
  head: { flexDirection: "row", alignItems: "center", gap: space[2] },
  title: { flex: 1, fontSize: fontSize.bodyL, fontWeight: "800", color: colors.ink },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.orange },
  body: { fontSize: fontSize.bodyS, color: colors.ink80, lineHeight: 19 },
  time: { fontSize: fontSize.cap, color: colors.ink40, marginTop: 2 },
});
