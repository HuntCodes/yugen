import { LocalDate, DayOfWeek, TemporalAdjusters, ZoneId, Month } from '@js-joda/core';
import { getTrainingPhase } from './planAnalysis'; // Existing function

export interface WeeklyPhaseOutlook {
  weekIdentifier: string; // e.g., "This Week: Oct 23 - Oct 29" or "Nov 6 - Nov 12"
  weekStartDate: string; // YYYY-MM-DD (Monday)
  weekEndDate: string; // YYYY-MM-DD (Sunday)
  phase: string;
  isCurrentWeek: boolean;
}

/**
 * Generates a projection of training phases for a given number of months.
 * @param raceDateString Optional race date in YYYY-MM-DD format.
 * @param planStartDateString Optional plan start date in YYYY-MM-DD format.
 * @param projectionMonths Number of months to project into the future (default: 3).
 * @returns Array of weekly phase outlooks.
 */
export function generatePhaseOutlook(
  raceDateString?: string | null,
  planStartDateString?: string | null,
  projectionMonths: number = 3
): WeeklyPhaseOutlook[] {
  const outlook: WeeklyPhaseOutlook[] = [];
  const systemZone = ZoneId.systemDefault();
  const todayLd = LocalDate.now(systemZone);

  let currentIterMondayLd = todayLd.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
  const endDateLd = todayLd.plusMonths(projectionMonths).with(TemporalAdjusters.lastDayOfMonth());

  const planStartDateForPhaseCalc = planStartDateString ? new Date(planStartDateString + 'T00:00:00.000Z') : undefined;

  while (currentIterMondayLd.isBefore(endDateLd) || currentIterMondayLd.isEqual(endDateLd)) {
    const currentIterSundayLd = currentIterMondayLd.plusDays(6);

    // Convert LocalDate to JS Date for getTrainingPhase
    // getTrainingPhase expects a JS Date representing the local day for its `currentDate` param.
    // We use the Monday of the week to determine the phase for that whole week.
    const jsDateForPhaseCurrentDate = new Date(
      currentIterMondayLd.year(),
      currentIterMondayLd.monthValue() - 1, // JS Date month is 0-indexed
      currentIterMondayLd.dayOfMonth()
    );
    // No setHours(0,0,0,0) here, as getTrainingPhase does that internally on its copy.

    const phase = getTrainingPhase(raceDateString, jsDateForPhaseCurrentDate, planStartDateForPhaseCalc);
    
    const isCurrentWeek = todayLd.isEqual(currentIterMondayLd) || (todayLd.isAfter(currentIterMondayLd) && todayLd.isBefore(currentIterSundayLd.plusDays(1)));
    
    let weekIdentifierPrefix = '';
    if (isCurrentWeek) {
      weekIdentifierPrefix = 'This Week: ';
    } else if (currentIterMondayLd.isAfter(todayLd.with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY)))) {
      // Check if it's the very next week
      const nextWeekMonday = todayLd.with(TemporalAdjusters.next(DayOfWeek.MONDAY));
      if(currentIterMondayLd.isEqual(nextWeekMonday)){
        weekIdentifierPrefix = 'Next Week: ';
      }
    }

    const formatMonthDay = (date: LocalDate): string => {
      return `${date.month().toString().substring(0, 3)} ${date.dayOfMonth()}`;
    };

    outlook.push({
      weekIdentifier: `${weekIdentifierPrefix}${formatMonthDay(currentIterMondayLd)} - ${formatMonthDay(currentIterSundayLd)}`,
      weekStartDate: currentIterMondayLd.toString(), // YYYY-MM-DD
      weekEndDate: currentIterSundayLd.toString(), // YYYY-MM-DD
      phase: phase,
      isCurrentWeek: isCurrentWeek,
    });

    currentIterMondayLd = currentIterMondayLd.plusWeeks(1);
  }

  return outlook;
}

// Helper to get abbreviated month name (if needed standalone, otherwise inline is fine)
// const getShortMonthName = (month: Month): string => {
//   return month.toString().substring(0, 3);
// }; 