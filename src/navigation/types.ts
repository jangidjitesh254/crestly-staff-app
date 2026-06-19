/** Navigation param lists — shared across navigators and screens. */

export type AttendanceStackParams = {
  AttendanceHome: undefined;
  MarkAttendance: {
    date: string;
    classSlug: string;
    className: string;
    section: string;
  };
  StudentHistory: {
    srNumber: number;
    studentName: string;
  };
};

export type MoreStackParams = {
  MoreHome: undefined;
  Holidays: undefined;
  LeavesList: undefined;
  ApplyLeave: undefined;
  Salary: undefined;
  Exams: undefined;
};

export type MainTabParams = {
  Home: undefined;
  Attendance: undefined;
  Timetable: undefined;
  Punch: undefined;
  Profile: undefined;
};

/**
 * Root stack wrapping the tabs. Notifications lives here (not inside the
 * Profile stack) so the bell can open it directly over any screen with a
 * normal slide-in — no visible detour through the Profile tab.
 */
export type RootStackParams = {
  Tabs: undefined;
  Notifications: undefined;
};
