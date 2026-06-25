/**
 * Crestly Staff — React Native theme.
 *
 * The colour, spacing and radius scales are the canonical Crestly v1.0
 * "Warm Indian SaaS" brand tokens (from the Crestly Design System /
 * @crestly/design `tokens.ts`). They are inlined here so this app stays a
 * standalone project. The type scale is adapted down for mobile. Never
 * invent values — pull from the tokens below.
 */
import { DefaultTheme, type Theme } from "@react-navigation/native";

/* --------------------------------------------------------------- tokens */

const ink = {
  100: "#100D0A",
  90: "#1A1714",
  80: "#2A2520",
  60: "#4A4239",
  40: "#7A7066",
  20: "#B5ACA0",
} as const;

const surface = {
  white: "#FFFFFF",
  whiteSoft: "#FAFAFA",
  paper: "#FBF9F3",
  creamSoft: "#FAF6EC",
  cream: "#F5EFE3",
  creamDeep: "#EBE3D1",
} as const;

const orange = {
  base: "#F25C19",
  deep: "#C9460C",
  soft: "#FF7B3D",
  tint: "#FCE4D6",
} as const;

const tint = {
  mint: { base: "#D6E8D9", deep: "#3E7A50" },
  peach: { base: "#F5DCC4", deep: "#A65A22" },
  rose: { base: "#F5D6CE", deep: "#A03A28" },
  mustard: { base: "#EFE2BE", deep: "#7A5A18" },
  wheat: { base: "#F0E5C8", deep: "#6E5418" },
  sky: { base: "#D5E2EE", deep: "#27517E" },
} as const;

const semantic = {
  success: { base: "#1F6F4A", soft: "#DDEBE0" },
  warn: { base: "#C97A0A", soft: "#F6E6C9" },
  error: { base: "#B83520", soft: "#F4D9D2" },
  info: { base: "#2A5FA8", soft: "#D6E1F0" },
} as const;

/* ---------------------------------------------------------------- export */

export const colors = {
  ink: ink[100],
  ink90: ink[90],
  ink80: ink[80],
  ink60: ink[60],
  ink40: ink[40],
  ink20: ink[20],

  white: surface.white,
  whiteSoft: surface.whiteSoft,
  paper: surface.paper,
  creamSoft: surface.creamSoft,
  cream: surface.cream,
  creamDeep: surface.creamDeep,

  orange: orange.base,
  orangeDeep: orange.deep,
  orangeSoft: orange.soft,
  orangeTint: orange.tint,

  rule: "rgba(16,13,10,0.10)",
  ruleSoft: "rgba(16,13,10,0.06)",
  ruleStrong: "rgba(16,13,10,0.18)",

  success: semantic.success.base,
  successSoft: semantic.success.soft,
  warn: semantic.warn.base,
  warnSoft: semantic.warn.soft,
  error: semantic.error.base,
  errorSoft: semantic.error.soft,
  info: semantic.info.base,
  infoSoft: semantic.info.soft,
} as const;

export const tints = tint;

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 32,
  8: 48,
  9: 64,
  10: 96,
} as const;

export const radius = {
  1: 4,
  2: 6,
  3: 8,
  4: 12,
  5: 16,
  pill: 999,
} as const;

/**
 * "Crestly Warm Card" — white rounded card on a white canvas, defined by a
 * hairline border with only a whisper of soft shadow (never a hard grey
 * drop-shadow). Reuse everywhere a card needs subtle elevation.
 */
export const shadow = {
  card: {
    shadowColor: "#2A2520",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  cardLg: {
    shadowColor: "#2A2520",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
} as const;

/** Token type scale, adapted for handset sizing. */
export const fontSize = {
  displayL: 32,
  displayM: 24,
  displayS: 20,
  h1: 18,
  h2: 16,
  bodyL: 16,
  body: 14,
  bodyS: 13,
  cap: 12,
  label: 11,
} as const;

/** Geist is not bundled — `undefined` falls back to the platform sans. */
export const fontFamily = {
  body: undefined as string | undefined,
  mono: undefined as string | undefined,
};

/** Attendance status → tint pairing, per the design-token domain mapping. */
export const statusColor: Record<
  "present" | "absent" | "late" | "excused",
  { bg: string; fg: string }
> = {
  present: { bg: tint.mint.base, fg: tint.mint.deep },
  absent: { bg: semantic.error.soft, fg: semantic.error.base },
  late: { bg: semantic.warn.soft, fg: semantic.warn.base },
  excused: { bg: tint.sky.base, fg: tint.sky.deep },
};

/** Leave status → colour pairing. */
export const leaveStatusColor: Record<string, { bg: string; fg: string }> = {
  pending: { bg: semantic.warn.soft, fg: semantic.warn.base },
  approved: { bg: tint.mint.base, fg: tint.mint.deep },
  rejected: { bg: semantic.error.soft, fg: semantic.error.base },
  cancelled: { bg: surface.creamDeep, fg: ink[60] },
};

export const navTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.orange,
    background: colors.white,
    card: colors.white,
    text: colors.ink,
    border: colors.rule,
    notification: colors.orange,
  },
};
