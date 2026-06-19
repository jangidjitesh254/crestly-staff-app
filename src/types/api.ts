/**
 * API contract types for the Crestly Staff app.
 *
 * These mirror the Zod-inferred types from the Crestly backend's
 * `@crestly/shared` package (packages/shared/src/*). The staff app is a
 * standalone project, so the shapes are vendored here. Keep them in sync
 * with the API if the contract changes.
 */

/* ----------------------------------------------------------------- auth */

export interface CurrentUser {
  id: number;
  name: string;
  email: string | null;
  phone: string;
  roleSlug: string | null;
  roleName: string | null;
  schoolId: number;
  schoolName: string;
  permissions: string[];
}

export interface LoginResponse {
  accessToken: string;
  user: CurrentUser;
}

/* -------------------------------------------------------------- classes */

export interface Section {
  id: number;
  classId: number;
  code: string;
  capacity: number | null;
  teacherUserId: number | null;
  teacherName: string | null;
  studentCount: number;
}

export interface SchoolClass {
  id: number;
  slug: string;
  name: string;
  sortOrder: number;
  isSystem: boolean;
  sections: Section[];
  totalStudents: number;
}

/* --------------------------------------------------- student attendance */

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AttendanceRow {
  srNumber: number;
  studentName: string;
  class: string;
  section: string;
  fatherName: string | null;
  status: AttendanceStatus | null;
  remarks: string | null;
  markedAt: string | null;
}

export interface AttendanceRosterResponse {
  date: string;
  class: string;
  section: string;
  sessionCode: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  notMarked: number;
  rows: AttendanceRow[];
}

export interface AttendanceBulk {
  date: string;
  marks: { srNumber: number; status: AttendanceStatus; remarks?: string | null }[];
}

export interface AttendanceHistoryResponse {
  srNumber: number;
  year: number;
  month: number;
  marked: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  /** Map of YYYY-MM-DD → status. Unmarked days are absent from the map. */
  days: Record<string, AttendanceStatus>;
}

/* --------------------------------------------------- staff attendance */

export type PunchType = "in" | "out";
export type GeofenceType = "school" | "pickup";

export interface StaffPunch {
  id: number;
  userId: number;
  userName: string;
  designation: string | null;
  department: string | null;
  punchType: PunchType;
  punchedAt: string;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  distanceM: number | null;
  geofenceType: GeofenceType;
  geofencePickupId: number | null;
  isOutside: boolean;
  selfiePath: string | null;
  notes: string | null;
}

export interface StaffPunchListResponse {
  items: StaffPunch[];
  total: number;
  page: number;
  pageSize: number;
  punchIns: number;
  punchOuts: number;
  outsideCount: number;
}

export interface PunchCreateInput {
  punchType: PunchType;
  latitude: number;
  longitude: number;
  accuracyM?: number | null;
  notes?: string | null;
  selfieBase64?: string | null;
}

/** Self-service today snapshot — drives the punch screen incl. the cooldown. */
export interface PunchTodayResponse {
  isIn: boolean;
  nextType: PunchType;
  /** Seconds remaining before punch-out is allowed (0 when unlocked). */
  cooldownSeconds: number;
  /** ISO time punch-out unlocks, or null when not currently in. */
  cooldownReadyAt: string | null;
  doneForDay: boolean;
  tomorrowAt: string;
  target: {
    type: GeofenceType;
    label: string;
    radiusM: number;
    latitude: number | null;
    longitude: number | null;
  } | null;
  punches: StaffPunch[];
  firstIn: StaffPunch | null;
  lastOut: StaffPunch | null;
}

/* --------------------------------------------------------------- leaves */

export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
export type HalfDay = "none" | "first_half" | "second_half";

export interface LeaveType {
  id: number;
  slug: string;
  name: string;
  shortCode: string;
  annualQuota: number;
  isPaid: boolean;
  carryForward: boolean;
  isSystem: boolean;
  colorHex: string | null;
  sortOrder: number;
}

export interface Leave {
  id: number;
  userId: number;
  userName: string | null;
  leaveTypeId: number;
  leaveType: string;
  leaveShortCode: string;
  fromDate: string;
  toDate: string;
  halfDay: HalfDay;
  days: number;
  reason: string | null;
  attachmentPath: string | null;
  status: LeaveStatus;
  appliedAt: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
}

export interface LeaveBalance {
  leaveTypeId: number;
  leaveType: string;
  shortCode: string;
  quota: number;
  taken: number;
  pending: number;
  left: number;
}

export interface LeaveListResponse {
  items: Leave[];
  pendingCount: number;
  balances: LeaveBalance[];
}

export interface LeaveApplyInput {
  leaveTypeId: number;
  fromDate: string;
  toDate: string;
  halfDay: HalfDay;
  reason?: string | null;
}

/* -------------------------------------------------------------- holidays */

export type HolidayType = "public" | "school" | "optional" | "weekend";

export interface Holiday {
  id: number;
  holidayDate: string;          // YYYY-MM-DD
  name: string;
  type: HolidayType;
  isPaid: boolean;
  notes: string | null;
  createdBy: number | null;
  createdAt: string | null;
}

export interface HolidayCalendarResponse {
  /** AY 2026-27 → academicYear=2026, covers Apr 1 2026 → Mar 31 2027. */
  academicYear: number;
  totalHolidays: number;
  upcomingIn60Days: number;
  sundayCount: number;
  workingDays: number;
  items: Holiday[];
}

/* --------------------------------------------------------- notifications */

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  items: AppNotification[];
  unread: number;
}

/* --------------------------------------------------------------- salary */

export type SalaryDayState =
  | "holiday"
  | "weekend"
  | "no_shift"
  | "no_salary"
  | "sunday"
  | "pending"
  | "computed"
  | "absent"
  | "future";

export interface SalaryDayRow {
  date: string;
  marked: boolean;
  punchIn: string | null;
  punchOut: string | null;
  lateMinutes: number;
  earlyMinutes: number;
  cut: number;
  net: number;
  isHoliday: boolean;
  isWeekend: boolean;
  state: SalaryDayState;
}

export interface SalaryResponse {
  userId: number;
  userName: string;
  userDesignation: string | null;
  userDepartment: string | null;
  month: string; // YYYY-MM
  monthlySalary: number;
  dailyGross: number;
  daysInMonth: number;
  daysMarked: number;
  daysPresent: number;
  daysAbsent: number;
  daysPending: number;
  totalCut: number;
  netEarned: number;
  paidViaVoucher: number;
  due: number;
  pendingVouchers: number;
  rows: SalaryDayRow[];
}

/* ------------------------------------------------------------ dashboard */

/** Trimmed subset of the API's DashboardSummary — only fields used by the
 *  mobile teacher home. The endpoint returns much more; we ignore the rest. */
export interface DashboardSummary {
  activeStudents: number;
  inactiveStudents: number;
  sections: number;
  todayAttendance: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    marked: number;
    total: number;
    pct: number | null;
  };
  leavePending: number;
  leaveToday: number;
  staffCount: number;
  staffPunched: number;
}

/* ------------------------------------------------------------ timetable */

export interface TimetablePeriod {
  id: number;
  periodNo: number;
  name: string;
  startTime: string; // HH:MM:SS
  endTime: string;
  isBreak: boolean;
  sortOrder: number;
}

export interface TimetableCell {
  id: number;
  dayOfWeek: number; // 1..7 (Mon..Sun)
  periodId: number;
  classSlug: string;
  sectionCode: string;
  subjectId: number | null;
  subjectName: string | null;
  subjectShortCode: string | null;
  teacherUserId: number | null;
  teacherName: string | null;
  subjectId2: number | null;
  subjectName2: string | null;
  subjectShortCode2: string | null;
  teacherUserId2: number | null;
  teacherName2: string | null;
  room: string | null;
  notes: string | null;
}

export interface TimetableGridResponse {
  sessionCode: string;
  scope: "section" | "teacher";
  scopeLabel: string;
  periods: TimetablePeriod[];
  cells: TimetableCell[];
  fillCount?: number;
}

/* ---------------------------------------------------------------- exams */

export interface ExamTerm {
  id: number;
  sessionCode: string;
  slug: string;
  name: string;
  shortCode: string;
  weightPercent: number;
  defaultMaxMarks: number;
  sortOrder: number;
  isFinalized: boolean;
  papersCount?: number;
  marksCount?: number;
}

export interface ExamDatesheetRow {
  id: number;
  termId: number;
  classSlug: string;
  subjectId: number;
  subjectName: string;
  examDate: string;
  startTime: string | null;
  endTime: string | null;
  maxMarks: number;
  passMarks: number;
  syllabusText: string | null;
}
