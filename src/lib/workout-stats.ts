// Pure, stateless stats derived fresh from raw workout dates each time — no separate "streak"
// table to keep in sync. Weeks are calendar weeks starting Monday.
//
// All date math here works in UTC throughout (parse, manipulate, format), never via a
// local-midnight-constructed Date read back through toISOString() — that combination silently
// rolls the date backward a day in any positive-UTC-offset timezone (e.g. `new Date('2026-08-25T00:00:00')`
// in UTC+2 is 2026-08-24T22:00:00Z, and .toISOString().slice(0, 10) then reports the wrong day).

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function parseISODateUTC(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatISODateUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getWeekStart(dateStr: string): string {
  const date = parseISODateUTC(dateStr);
  const day = date.getUTCDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diffToMonday);
  return formatISODateUTC(date);
}

function addWeeks(weekStart: string, weeks: number): string {
  const date = parseISODateUTC(weekStart);
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return formatISODateUTC(date);
}

function addDaysISO(dateStr: string, days: number): string {
  const date = parseISODateUTC(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return formatISODateUTC(date);
}

export type WeeklyStreak = {
  current: number;
  longest: number;
};

// The still-in-progress current week is never counted as a miss — only fully completed weeks
// (the current week's Monday and earlier) go into the streak, so training later this week can't
// retroactively break something that hasn't failed yet.
export function computeWeeklyStreak(workoutDates: string[], weeklyGoal: number | null): WeeklyStreak {
  if (!weeklyGoal || weeklyGoal <= 0 || workoutDates.length === 0) {
    return { current: 0, longest: 0 };
  }

  const countByWeek = new Map<string, number>();
  for (const date of workoutDates) {
    const weekStart = getWeekStart(date);
    countByWeek.set(weekStart, (countByWeek.get(weekStart) ?? 0) + 1);
  }

  const currentWeekStart = getWeekStart(todayISODate());
  const lastCompletedWeek = addWeeks(currentWeekStart, -1);
  const earliestWeek = [...countByWeek.keys()].sort()[0];

  if (!earliestWeek || earliestWeek > lastCompletedWeek) {
    return { current: 0, longest: 0 };
  }

  let longest = 0;
  let running = 0;
  let week = earliestWeek;

  while (week <= lastCompletedWeek) {
    const met = (countByWeek.get(week) ?? 0) >= weeklyGoal;
    running = met ? running + 1 : 0;
    longest = Math.max(longest, running);
    week = addWeeks(week, 1);
  }

  return { current: running, longest };
}

// Sessions per week, averaged over the trailing `days` (a rolling window rather than a calendar
// month, so it's a stable, equally-sized sample no matter what day of the month it is) — or since
// the user's actual first workout if that's more recent, so a new user isn't diluted by a window
// that predates them (same idea as computeYearlyWeeklyAverage below).
export function computeRollingWeeklyAverage(
  workoutDates: string[],
  days: number,
  firstWorkoutDate: string | null,
): number {
  const cutoffDate = parseISODateUTC(todayISODate());
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - days);
  const cutoffStr = formatISODateUTC(cutoffDate);
  const startDate = firstWorkoutDate && firstWorkoutDate > cutoffStr ? firstWorkoutDate : cutoffStr;
  const start = parseISODateUTC(startDate);
  const daysElapsed = Math.max(1, Math.round((Date.now() - start.getTime()) / 86_400_000));
  const count = workoutDates.filter((date) => date >= startDate).length;
  return count / (daysElapsed / 7);
}

// Sessions per week since the later of "January 1st this year" or the user's actual first
// logged workout — so a new user isn't dragged down by months where they didn't exist yet.
export function computeYearlyWeeklyAverage(workoutDates: string[], firstWorkoutDate: string | null): number {
  if (!firstWorkoutDate) return 0;

  const jan1 = `${new Date().getUTCFullYear()}-01-01`;
  const startDate = firstWorkoutDate > jan1 ? firstWorkoutDate : jan1;
  const start = parseISODateUTC(startDate);
  const daysElapsed = Math.max(1, Math.round((Date.now() - start.getTime()) / 86_400_000));
  const count = workoutDates.filter((date) => date >= startDate).length;
  return count / (daysElapsed / 7);
}

export type CalendarDay = {
  date: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  hasWorkout: boolean;
};

export type CalendarWeek = {
  weekStart: string;
  days: CalendarDay[];
  metGoal: boolean;
};

// Builds a Monday-start grid covering the given month, padded with the leading/trailing days
// from neighboring months needed to complete the first/last week rows (dimmed via
// `isCurrentMonth`). `metGoal` reflects the real session count across the *entire* week (Monday
// through Sunday) even where some of its days spill into an adjacent month.
export function buildMonthCalendar(
  year: number,
  month: number, // 0-indexed, matches JS Date
  workoutDates: string[],
  weeklyGoal: number | null,
): CalendarWeek[] {
  const workoutDateSet = new Set(workoutDates);
  const todayStr = todayISODate();

  const firstOfMonth = formatISODateUTC(new Date(Date.UTC(year, month, 1)));
  const lastOfMonth = formatISODateUTC(new Date(Date.UTC(year, month + 1, 0)));

  const gridStart = getWeekStart(firstOfMonth);
  const lastWeekStart = getWeekStart(lastOfMonth);

  const weeks: CalendarWeek[] = [];
  let weekStart = gridStart;

  while (weekStart <= lastWeekStart) {
    const days: CalendarDay[] = [];
    let sessionsThisWeek = 0;

    for (let i = 0; i < 7; i++) {
      const date = addDaysISO(weekStart, i);
      const hasWorkout = workoutDateSet.has(date);
      if (hasWorkout) sessionsThisWeek += 1;
      days.push({
        date,
        dayOfMonth: Number(date.slice(8, 10)),
        isCurrentMonth: date >= firstOfMonth && date <= lastOfMonth,
        isToday: date === todayStr,
        hasWorkout,
      });
    }

    weeks.push({
      weekStart,
      days,
      metGoal: weeklyGoal != null && sessionsThisWeek >= weeklyGoal,
    });

    weekStart = addWeeks(weekStart, 1);
  }

  return weeks;
}
