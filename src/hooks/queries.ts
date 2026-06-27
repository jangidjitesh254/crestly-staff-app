/** React Query hooks wrapping the Crestly API endpoints the staff app uses. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AppNotification,
  AttendanceBulk,
  AttendanceHistoryResponse,
  AttendanceMyClassesResponse,
  AttendanceRosterResponse,
  CalendarEvent,
  CalendarEventUpsert,
  CalendarFeedResponse,
  DashboardSummary,
  DiaryDayResponse,
  DiarySaveInput,
  DiaryEntry,
  ExamDatesheetRow,
  ExamSubject,
  ExamTerm,
  HolidayCalendarResponse,
  Leave,
  LeaveApplyInput,
  LeaveListResponse,
  LeaveType,
  NotificationListResponse,
  PunchCreateInput,
  PunchTodayResponse,
  SalaryResponse,
  SchoolClass,
  ParseQuestionsInput,
  ParseQuestionsResult,
  StaffPunch,
  StaffPunchListResponse,
  Test,
  TestListItem,
  TestResultsResponse,
  TestStatus,
  TestUpsert,
  TimetableGridResponse,
} from "../types/api";
import { api } from "../lib/api";

/* ----------------------------------------------------------------- classes */

export function useClasses() {
  return useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await api.get<SchoolClass[]>("/classes")).data,
  });
}

/* -------------------------------------------------------- student attendance */

export function useRoster(date: string, classSlug: string, section: string) {
  return useQuery({
    queryKey: ["roster", date, classSlug, section],
    queryFn: async () =>
      (
        await api.get<AttendanceRosterResponse>("/attendance/roster", {
          params: { date, class: classSlug, section },
        })
      ).data,
  });
}

export function useSaveAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: AttendanceBulk) =>
      (await api.post<{ ok: true; count: number }>("/attendance/bulk", body)).data,
    // Bulk save is idempotent (upserts by sr_number + date). If the network
    // drops the response on a flaky hotspot, retry quietly twice.
    retry: 2,
    retryDelay: (attempt) => Math.min(1500 * 2 ** attempt, 6000),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roster"] }),
  });
}

/** Single-row attendance save — used by auto-save when a teacher taps a status. */
export function useMarkAttendance() {
  return useMutation({
    mutationFn: async (body: {
      srNumber: number;
      date: string;
      status: import("../types/api").AttendanceStatus;
      remarks?: string | null;
    }) => (await api.post<{ ok: true }>("/attendance/mark", body)).data,
    retry: 1,
    retryDelay: 1200,
  });
}

/**
 * Class/section(s) the signed-in user may mark attendance for. A class teacher
 * gets only their own section(s); admins get `canMarkAll: true` + every section.
 * The roster/mark/bulk endpoints reject anything outside this list, so the
 * picker must be driven from here.
 */
export function useMyClasses() {
  return useQuery({
    queryKey: ["attendance-my-classes"],
    staleTime: 5 * 60_000,
    queryFn: async () =>
      (await api.get<AttendanceMyClassesResponse>("/attendance/my-classes")).data,
  });
}

export function useAttendanceHistory(srNumber: number, year: number, month: number) {
  return useQuery({
    queryKey: ["attendance-history", srNumber, year, month],
    queryFn: async () =>
      (
        await api.get<AttendanceHistoryResponse>("/attendance/history", {
          params: { srNumber, year, month },
        })
      ).data,
  });
}

/* ---------------------------------------------------------- staff check-in */

export function usePunch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: PunchCreateInput) =>
      (await api.post<StaffPunch>("/punch", body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-punches"] });
      qc.invalidateQueries({ queryKey: ["punch-today"] });
    },
  });
}

/**
 * Self-service "today" snapshot for the signed-in user — status, first-in /
 * last-out, the punch-out cooldown (cooldownReadyAt / cooldownSeconds) and
 * today's events. Available to every staff member (not perm-gated), so this
 * is the authoritative source for the punch screen + the 15-min lock.
 */
export function usePunchToday() {
  return useQuery({
    queryKey: ["punch-today"],
    queryFn: async () => (await api.get<PunchTodayResponse>("/punch/today")).data,
  });
}

/**
 * Today's punches for the signed-in user. The list endpoint is gated on
 * `staff.view_team`; a plain teacher will get 403 — callers should treat a
 * failure here as "history unavailable", not a hard error.
 */
export function useMyPunches(userId: number, dayIso: string) {
  return useQuery({
    queryKey: ["my-punches", userId, dayIso],
    retry: false,
    queryFn: async () =>
      (
        await api.get<StaffPunchListResponse>("/staff-attendance", {
          params: { userId, from: dayIso, to: dayIso, pageSize: 50 },
        })
      ).data,
  });
}

/* --------------------------------------------------------------- leaves */

export function useLeaves() {
  return useQuery({
    queryKey: ["leaves"],
    queryFn: async () =>
      (await api.get<LeaveListResponse>("/leaves", { params: { scope: "mine" } })).data,
  });
}

export function useLeaveTypes() {
  return useQuery({
    queryKey: ["leave-types"],
    queryFn: async () => (await api.get<LeaveType[]>("/leaves/types")).data,
  });
}

export function useApplyLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: LeaveApplyInput) =>
      (await api.post<Leave>("/leaves", body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leaves"] }),
  });
}

export function useCancelLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      (await api.post<Leave>(`/leaves/${id}/cancel`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leaves"] }),
  });
}

/* --------------------------------------------------------------- holidays */

export function useHolidayCalendar(academicYear: number) {
  return useQuery({
    queryKey: ["holidays", academicYear],
    queryFn: async () =>
      (
        await api.get<HolidayCalendarResponse>("/holidays", {
          params: { academicYear },
        })
      ).data,
    staleTime: 5 * 60_000, // holidays don't change often
  });
}

/* ---------------------------------------------------------- notifications */

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () =>
      (await api.get<NotificationListResponse>("/notifications")).data,
    staleTime: 30_000,
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post("/notifications/mark-all-read")).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      (await api.post(`/notifications/${id}/read`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

/* --------------------------------------------------------------- salary */

export function useSalary(month: string) {
  return useQuery({
    queryKey: ["salary", month],
    queryFn: async () =>
      (await api.get<SalaryResponse>("/salary", { params: { month } })).data,
  });
}

/* ------------------------------------------------------------ dashboard */

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () =>
      (await api.get<DashboardSummary>("/dashboard")).data,
    staleTime: 60_000,
  });
}

/* ------------------------------------------------------------ timetable */

/** Weekly grid by teacher (defaults to the signed-in user). */
export function useTimetableForTeacher(teacherUserId: number) {
  return useQuery({
    queryKey: ["timetable", "teacher", teacherUserId],
    queryFn: async () =>
      (
        await api.get<TimetableGridResponse>("/timetable", {
          params: { teacherUserId },
        })
      ).data,
    staleTime: 5 * 60_000,
  });
}

/* ----------------------------------------------------------------- diary */

/** A class/section's day grid — one fillable entry per period. */
export function useDiaryDay(classSlug: string, section: string, date: string) {
  return useQuery({
    queryKey: ["diary", classSlug, section, date],
    enabled: !!classSlug && !!section && !!date,
    queryFn: async () =>
      (
        await api.get<DiaryDayResponse>("/diary", {
          params: { class: classSlug, section, date },
        })
      ).data,
  });
}

/** Save (upsert) a single period's diary note. */
export function useSaveDiary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: DiarySaveInput) =>
      (await api.post<DiaryEntry>("/diary", body)).data,
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({
        queryKey: ["diary", vars.classSlug, vars.sectionCode, vars.diaryDate],
      }),
  });
}

/* ---------------------------------------------------------------- exams */

export function useExamTerms() {
  return useQuery({
    queryKey: ["exam-terms"],
    queryFn: async () => (await api.get<ExamTerm[]>("/exams/terms")).data,
    staleTime: 5 * 60_000,
  });
}

/** Master subject list (each carries the classes it's offered in). */
export function useExamSubjects() {
  return useQuery({
    queryKey: ["exam-subjects"],
    staleTime: 10 * 60_000,
    retry: false, // best-effort: needs exams.view; a 403 just means "no list"
    queryFn: async () => (await api.get<ExamSubject[]>("/exams/subjects")).data,
  });
}

export function useExamDatesheet(termId: number | null, classSlug?: string) {
  return useQuery({
    queryKey: ["exam-datesheet", termId, classSlug],
    enabled: termId != null,
    queryFn: async () =>
      (
        await api.get<ExamDatesheetRow[]>("/exams/datesheet", {
          params: classSlug ? { termId, class: classSlug } : { termId },
        })
      ).data,
  });
}

/* -------------------------------------------------------------- calendar */

/** Merged calendar feed (events + holidays + exams) for a month. */
export function useCalendarFeed(month: string, classSlug?: string | null) {
  return useQuery({
    queryKey: ["calendar", "feed", month, classSlug ?? null],
    staleTime: 60_000,
    queryFn: async () =>
      (
        await api.get<CalendarFeedResponse>("/calendar/feed", {
          params: classSlug ? { month, classSlug } : { month },
        })
      ).data,
  });
}

/** A single editable event (for the edit form). */
export function useCalendarEvent(id: number | null) {
  return useQuery({
    queryKey: ["calendar", "event", id],
    enabled: id != null && id > 0,
    staleTime: 0,
    queryFn: async () =>
      (await api.get<CalendarEvent>(`/calendar/events/${id}`)).data,
  });
}

/** Create (no id) or update (id) a calendar event. */
export function useSaveCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id?: number | null; body: CalendarEventUpsert }) => {
      const { id, body } = vars;
      const res = id
        ? await api.put<CalendarEvent>(`/calendar/events/${id}`, body)
        : await api.post<CalendarEvent>("/calendar/events", body);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar"] }),
  });
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      (await api.delete<{ ok: true }>(`/calendar/events/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar"] }),
  });
}

/* ----------------------------------------------------------------- tests */

export function useTestsList(status?: TestStatus, classSlug?: string) {
  return useQuery({
    queryKey: ["tests", status ?? null, classSlug ?? null],
    queryFn: async () =>
      (
        await api.get<TestListItem[]>("/tests", {
          params: {
            ...(status ? { status } : {}),
            ...(classSlug ? { classSlug } : {}),
          },
        })
      ).data,
  });
}

/** Full test incl. answer key — for editing or reviewing. */
export function useTest(id: number | null) {
  return useQuery({
    queryKey: ["test", id],
    enabled: id != null && id > 0,
    staleTime: 0,
    queryFn: async () => (await api.get<Test>(`/tests/${id}`)).data,
  });
}

/** Create (no id) or update (id) a test. Update is blocked once attempts exist. */
export function useSaveTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id?: number | null; body: TestUpsert }) => {
      const { id, body } = vars;
      const res = id
        ? await api.put<Test>(`/tests/${id}`, body)
        : await api.post<Test>("/tests", body);
      return res.data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["tests"] });
      if (vars.id) qc.invalidateQueries({ queryKey: ["test", vars.id] });
    },
  });
}

/** Publish or close a test. */
export function useTestAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: number; action: "publish" | "close" }) =>
      (await api.post<Test>(`/tests/${vars.id}/${vars.action}`)).data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["tests"] });
      qc.invalidateQueries({ queryKey: ["test", vars.id] });
    },
  });
}

export function useDeleteTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      (await api.delete<{ ok: true }>(`/tests/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tests"] }),
  });
}

export function useTestResults(id: number | null) {
  return useQuery({
    queryKey: ["test-results", id],
    enabled: id != null && id > 0,
    queryFn: async () =>
      (await api.get<TestResultsResponse>(`/tests/${id}/results`)).data,
  });
}

/** Server-side parse of pasted text into draft questions (staff reviews, then saves). */
export function useParseQuestions() {
  return useMutation({
    mutationFn: async (body: ParseQuestionsInput) =>
      (await api.post<ParseQuestionsResult>("/tests/parse-questions", body)).data,
  });
}
