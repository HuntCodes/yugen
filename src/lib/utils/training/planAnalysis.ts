import { LocalDate, TemporalAdjusters, ChronoUnit, DayOfWeek } from '@js-joda/core';

// Helper to get the Monday of the week for a given JS Date
function getMondayOfWeek(date: Date): LocalDate {
  const jsJodaDate = LocalDate.of(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return jsJodaDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
}

// Helper to calculate full weeks between two Mondays (date1Monday is earlier or same as date2Monday)
function calculateFullWeeksBetweenMondays(date1Monday: LocalDate, date2Monday: LocalDate): number {
  if (date1Monday.isAfter(date2Monday)) return 0;
  return ChronoUnit.WEEKS.between(date1Monday, date2Monday);
}

/**
 * Determine the training phase based on race date and plan start date
 * @param raceDate Optional date of the race (YYYY-MM-DD format)
 * @param currentDate Current date to calculate phase from
 * @param planStartDate Date when the user started their plan
 * @returns The current training phase
 */
export function getTrainingPhase(
  raceDateString?: string | null,
  currentDateForPhase: Date = new Date(),
  planStartDateJs?: Date | null
): string {
  const today = new Date(currentDateForPhase);
  today.setHours(0, 0, 0, 0);
  const currentWeekMonday = getMondayOfWeek(today);

  const actualPlanStartDate = planStartDateJs ? new Date(planStartDateJs) : new Date(today);
  actualPlanStartDate.setHours(0, 0, 0, 0);
  const planStartMonday = getMondayOfWeek(actualPlanStartDate);

  const basePeriodEndDateGlobal = planStartMonday.plusDays(13); // End of the initial 2-week base period of the entire plan

  // Handle Post-Race Phases first if a race has occurred
  if (raceDateString && raceDateString !== 'None') {
    const raceDayLd = LocalDate.parse(raceDateString);
    if (currentWeekMonday.isAfter(raceDayLd)) {
      const daysPastRaceStartOfWeek = ChronoUnit.DAYS.between(raceDayLd, currentWeekMonday);

      if (daysPastRaceStartOfWeek < 0) {
        // This means currentWeekMonday is before raceDayLd, logic error or raceDate in future, handled later.
      } else if (daysPastRaceStartOfWeek <= 6) {
        // Week 1 post-race (0-6 days after race day for Mon of that week)
        return 'Recovery';
      } else if (daysPastRaceStartOfWeek <= 13) {
        // Week 2 post-race (7-13 days after)
        return 'Recovery';
      } else if (daysPastRaceStartOfWeek <= 20) {
        // Week 3 post-race (14-20 days after)
        return 'Base';
      } else if (daysPastRaceStartOfWeek <= 27) {
        // Week 4 post-race (21-27 days after)
        return 'Base';
      }
      // If more than 4 weeks (2R+2B) past race, fall through to general cyclical logic based on original plan start.
    }
  }

  // Race-Specific Countdown (if race is in the future or very recent past for current week)
  if (raceDateString && raceDateString !== 'None') {
    const raceDayLd = LocalDate.parse(raceDateString);

    // Only apply race countdown if current week is not significantly past the race (beyond the 4-week post-race special handling)
    const daysTillRaceForPrimaryLogic = ChronoUnit.DAYS.between(currentWeekMonday, raceDayLd);
    if (daysTillRaceForPrimaryLogic >= -27) {
      // -27 allows this block to catch the Race Week itself even if currentWeekMonday is slightly after raceDayLd
      const raceWeekMonday = raceDayLd.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
      const taperWeekMonday = raceWeekMonday.minusWeeks(1);
      const peakWeekMonday = taperWeekMonday.minusWeeks(1);

      if (
        currentWeekMonday.isEqual(
          raceDayLd.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
        ) &&
        daysTillRaceForPrimaryLogic >= 0
      ) {
        // Ensure this is only for future/current race week, not overriding post-race.
        // The post-race block above handles currentWeekMonday > raceDayLd already.
        return 'Race Week';
      }
      if (currentWeekMonday.isEqual(taperWeekMonday)) {
        return 'Taper';
      }
      if (currentWeekMonday.isEqual(peakWeekMonday)) {
        return 'Peak';
      }

      if (currentWeekMonday.isBefore(peakWeekMonday)) {
        // Check if it's global Base period first (initial 2 weeks of entire plan)
        if (
          currentWeekMonday.isBefore(basePeriodEndDateGlobal.plusDays(1)) &&
          (currentWeekMonday.isEqual(planStartMonday) || currentWeekMonday.isAfter(planStartMonday))
        ) {
          return 'Base';
        }

        // If after global Base and before Peak, apply reverse cyclical from Peak
        const weeksFromPeakToCurrent = calculateFullWeeksBetweenMondays(
          currentWeekMonday,
          peakWeekMonday.minusDays(1)
        );
        const cyclePositionReversed = weeksFromPeakToCurrent % 4;
        if (cyclePositionReversed === 0) return 'Base'; // Week immediately before Peak (was Recovery)
        if (cyclePositionReversed === 1) return 'Build';
        if (cyclePositionReversed === 2) return 'Build';
        if (cyclePositionReversed === 3) return 'Build';
      }
    }
  }

  // General Cyclical Logic (No race, race is far, or race significantly in past >4wks)
  // Is it the global initial Base period?
  if (
    currentWeekMonday.isBefore(basePeriodEndDateGlobal.plusDays(1)) &&
    (currentWeekMonday.isEqual(planStartMonday) || currentWeekMonday.isAfter(planStartMonday))
  ) {
    return 'Base';
  }

  // If after global Base period, apply forward cyclical logic
  const weeksSincePlanStartForCycle = calculateFullWeeksBetweenMondays(
    planStartMonday,
    currentWeekMonday
  );
  const adjustedWeeksForCycle = weeksSincePlanStartForCycle - 2; // Subtract 2 global base weeks

  if (adjustedWeeksForCycle < 0) {
    return 'Base'; // Should be caught by the check above
  }

  const cyclePositionForward = adjustedWeeksForCycle % 4;
  if (cyclePositionForward < 3) return 'Build';
  return 'Base'; // Was Recovery
}

/**
 * Extract the numeric training frequency from the training frequency text
 */
export function extractTrainingFrequency(trainingFrequency: string): number {
  const matches = trainingFrequency.match(/(\\d+)/);
  if (matches && matches[1]) {
    const frequency = parseInt(matches[1], 10);
    if (frequency >= 1 && frequency <= 7) {
      return frequency;
    }
  }
  const loweredText = trainingFrequency.toLowerCase();
  if (loweredText.includes('once a week') || loweredText.includes('1 day')) return 1;
  if (loweredText.includes('twice a week') || loweredText.includes('2 day')) return 2;
  if (loweredText.includes('three') || loweredText.includes('3 day')) return 3;
  if (loweredText.includes('four') || loweredText.includes('4 day')) return 4;
  if (loweredText.includes('five') || loweredText.includes('5 day')) return 5;
  if (loweredText.includes('six') || loweredText.includes('6 day')) return 6;
  if (
    loweredText.includes('seven') ||
    loweredText.includes('every day') ||
    loweredText.includes('7 day')
  )
    return 7;
  return 3;
}
