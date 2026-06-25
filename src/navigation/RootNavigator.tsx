import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  createMaterialTopTabNavigator,
  type MaterialTopTabBarProps,
} from "@react-navigation/material-top-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../store/auth";
import { colors, space } from "../theme";
import type {
  AttendanceStackParams,
  MainTabParams,
  MoreStackParams,
  RootStackParams,
} from "./types";

import { LoginScreen } from "../screens/LoginScreen";
import { LoginSuccess } from "../components/LoginSuccess";
import { HomeScreen } from "../screens/HomeScreen";
import { AttendanceHomeScreen } from "../screens/attendance/AttendanceHomeScreen";
import { MarkAttendanceScreen } from "../screens/attendance/MarkAttendanceScreen";
import { StudentHistoryScreen } from "../screens/attendance/StudentHistoryScreen";
import { PunchScreen } from "../screens/punch/PunchScreen";
import { LeavesListScreen } from "../screens/leaves/LeavesListScreen";
import { ApplyLeaveScreen } from "../screens/leaves/ApplyLeaveScreen";
import { MoreScreen } from "../screens/more/MoreScreen";
import { HolidaysScreen } from "../screens/more/HolidaysScreen";
import { NotificationsScreen } from "../screens/more/NotificationsScreen";
import { SalaryScreen } from "../screens/more/SalaryScreen";
import { TimetableScreen } from "../screens/more/TimetableScreen";
import { ExamsScreen } from "../screens/more/ExamsScreen";

// Every stack hides the navigator header — every screen renders its own
// <TopBar /> at the top so the brand surface is consistent.
const stackScreenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.white },
};

/* ------------------------------------------------------------ Attendance */

const AttendanceStack = createNativeStackNavigator<AttendanceStackParams>();

function AttendanceNavigator() {
  return (
    <AttendanceStack.Navigator screenOptions={stackScreenOptions}>
      <AttendanceStack.Screen name="AttendanceHome" component={AttendanceHomeScreen} />
      <AttendanceStack.Screen name="MarkAttendance" component={MarkAttendanceScreen} />
      <AttendanceStack.Screen name="StudentHistory" component={StudentHistoryScreen} />
    </AttendanceStack.Navigator>
  );
}

/* ------------------------------------------------------------------ More */

const MoreStack = createNativeStackNavigator<MoreStackParams>();

function MoreNavigator() {
  return (
    <MoreStack.Navigator screenOptions={stackScreenOptions}>
      <MoreStack.Screen name="MoreHome" component={MoreScreen} />
      <MoreStack.Screen name="Holidays" component={HolidaysScreen} />
      <MoreStack.Screen name="LeavesList" component={LeavesListScreen} />
      <MoreStack.Screen name="ApplyLeave" component={ApplyLeaveScreen} />
      <MoreStack.Screen name="Salary" component={SalaryScreen} />
      <MoreStack.Screen name="Exams" component={ExamsScreen} />
    </MoreStack.Navigator>
  );
}

/* ------------------------------------------------------------- Main tabs */

const Tabs = createMaterialTopTabNavigator<MainTabParams>();

const TAB_ICON: Record<
  keyof MainTabParams,
  { off: keyof typeof Ionicons.glyphMap; on: keyof typeof Ionicons.glyphMap }
> = {
  Home: { off: "home-outline", on: "home" },
  Attendance: { off: "checkbox-outline", on: "checkbox" },
  Timetable: { off: "grid-outline", on: "grid" },
  Punch: { off: "time-outline", on: "time" },
  Profile: { off: "person-circle-outline", on: "person-circle" },
};

/**
 * Custom floating tab bar — a compact, content-width frosted-glass pill
 * centred at the bottom. Icons + labels, with a circular highlight behind
 * the active tab. Swipe between tabs is handled by the pager navigator.
 */
function FloatingTabBar({ state, navigation }: MaterialTopTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[fb.wrap, { bottom: Math.max(insets.bottom, 10) }]}>
      <View style={fb.shadow}>
        <View style={fb.bar}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const icon = TAB_ICON[route.name as keyof MainTabParams];
            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name as never);
              }
            };
            const tint = focused ? colors.orange : colors.ink60;
            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                onPress={onPress}
                android_ripple={{ color: "rgba(16,13,10,0.08)", borderless: true, radius: 30 }}
                style={fb.item}
              >
                <View style={[fb.iconWrap, focused && fb.iconWrapActive]}>
                  <Ionicons name={focused ? icon.on : icon.off} size={22} color={tint} />
                </View>
                <Text style={[fb.label, { color: tint }]} numberOfLines={1}>
                  {route.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      tabBarPosition="bottom"
      // Swipe left/right between tabs (pager-backed), lazy-mount each screen.
      screenOptions={{ swipeEnabled: true, lazy: true }}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Attendance" component={AttendanceNavigator} />
      <Tabs.Screen name="Timetable" component={TimetableScreen} />
      <Tabs.Screen name="Punch" component={PunchScreen} />
      <Tabs.Screen name="Profile" component={MoreNavigator} />
    </Tabs.Navigator>
  );
}

const fb = StyleSheet.create({
  // Full-width transparent layer that centres the pill horizontally.
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  // Soft shadow lives on the wrapper so the solid bar stays crisp.
  shadow: {
    borderRadius: 30,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 10,
  },
  // Clean, crisp solid floating bar.
  bar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.rule,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 2,
  },
  item: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 64,
    paddingHorizontal: 4,
    gap: 3,
  },
  // Circular highlight behind the active icon.
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  iconWrapActive: { backgroundColor: "rgba(242,92,25,0.15)" },
  label: { fontSize: 10, fontWeight: "700", letterSpacing: 0.2 },
});

/* ----------------------------------------------------------------- Root */

function Splash() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.orange,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ActivityIndicator color={colors.white} size="large" />
    </View>
  );
}

/* Root stack: the tab navigator + screens that open OVER the tabs
   (Notifications) so the bell slides straight in without a tab detour. */
const RootStack = createNativeStackNavigator<RootStackParams>();

function AppStack() {
  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.white },
        animation: "slide_from_right",
      }}
    >
      <RootStack.Screen name="Tabs" component={MainTabs} />
      <RootStack.Screen name="Notifications" component={NotificationsScreen} />
    </RootStack.Navigator>
  );
}

export function RootNavigator() {
  const { user, loading, justSignedIn, clearJustSignedIn } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <LoginScreen />;
  return (
    <View style={{ flex: 1 }}>
      <AppStack />
      {justSignedIn ? <LoginSuccess onDone={clearJustSignedIn} /> : null}
    </View>
  );
}

// Keep an export so old imports don't break; space is in the theme too.
export { space };
