/**
 * Determine the training phase based on race date and plan start date
 * @param raceDate Optional date of the race (YYYY-MM-DD format)
 * @param currentDate Current date to calculate phase from
 * @param planStartDate Date when the user started their plan
 * @returns The current training phase
 */
export function getTrainingPhase(
  raceDate?: string | null,
  currentDate: Date = new Date(),
  planStartDate?: Date | null
): string {
  // Clone current date to avoid modifying the original
  const today = new Date(currentDate);
  today.setHours(0, 0, 0, 0);

  // If plan start date is not provided, assume it's the same as current date
  const startDate = planStartDate ? new Date(planStartDate) : new Date(today);
  startDate.setHours(0, 0, 0, 0);

  // Calculate time since plan started (in weeks)
  const weeksSincePlanStart = Math.floor((today.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
  
  // If race date exists and is valid, calculate phase based on race
  if (raceDate && raceDate !== 'None') {
    const raceDay = new Date(raceDate);
    
    // Handle invalid date
    if (isNaN(raceDay.getTime())) {
      return calculateCyclicalPhase(weeksSincePlanStart);
    }
    
    // Calculate days until race
    const daysUntilRace = Math.floor((raceDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    
    // Check if race is in the next 3 months (90 days)
    if (daysUntilRace <= 90 && daysUntilRace > 0) {
      // Find the Monday of race week
      const raceDayOfWeek = raceDay.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysToRaceWeekMonday = raceDayOfWeek === 0 ? -6 : 1 - raceDayOfWeek; // Calculate days to previous Monday
      
      const raceWeekMonday = new Date(raceDay);
      raceWeekMonday.setDate(raceDay.getDate() + daysToRaceWeekMonday);
      raceWeekMonday.setHours(0, 0, 0, 0);
      
      // Find Monday 1 week before race (taper week)
      const taperWeekMonday = new Date(raceWeekMonday);
      taperWeekMonday.setDate(taperWeekMonday.getDate() - 7);
      
      // Find Monday 2 weeks before race (start of peak)
      const peakWeekMonday = new Date(taperWeekMonday);
      peakWeekMonday.setDate(peakWeekMonday.getDate() - 7);
      
      // Determine phase based on these dates
      if (today >= raceWeekMonday) {
        return "Race Week";
      } else if (today >= taperWeekMonday) {
        return "Taper";
      } else if (today >= peakWeekMonday) {
        return "Peak";
      } else if (daysUntilRace <= 7) {
        // Race is very soon but not on a Monday boundary
        return "Race Week";
      } else {
        // We're still in the build phase
        return "Build";
      }
    }
    
    // Race is more than 3 months away (or in the past), use cyclical pattern
    if (daysUntilRace <= 0) {
      // Race is in the past, check if within recovery period (2 weeks after race)
      const daysAfterRace = Math.abs(daysUntilRace);
      if (daysAfterRace <= 14) {
        return "Recovery";
      }
    }
  }
  
  // No race date or race is far away, use cyclical pattern
  return calculateCyclicalPhase(weeksSincePlanStart);
}

/**
 * Calculate training phase in a cyclical pattern of 3 weeks build + 1 week recovery
 * @param weeksSincePlanStart Number of weeks since the plan started
 * @returns The current training phase
 */
export function calculateCyclicalPhase(weeksSincePlanStart: number): string {
  // First week is always Base
  if (weeksSincePlanStart === 0) {
    return "Base";
  }
  
  // 3 weeks build + 1 week recovery cycle (after the first Base week)
  const adjustedWeeks = weeksSincePlanStart - 1;
  const cyclePosition = adjustedWeeks % 4;
  
  // Weeks 1-3 of cycle are build, week 4 is recovery
  return cyclePosition < 3 ? "Build" : "Recovery";
}

/**
 * Extract the numeric training frequency from the training frequency text
 */
export function extractTrainingFrequency(trainingFrequency: string): number {
  // Try to extract a number from the string
  const matches = trainingFrequency.match(/(\d+)/);
  if (matches && matches[1]) {
    const frequency = parseInt(matches[1], 10);
    // Sanity check - only accept 1-7 days per week
    if (frequency >= 1 && frequency <= 7) {
      return frequency;
    }
  }
  
  // If we couldn't extract a number, try to interpret common phrases
  const loweredText = trainingFrequency.toLowerCase();
  if (loweredText.includes('once a week') || loweredText.includes('1 day')) {
    return 1;
  } else if (loweredText.includes('twice a week') || loweredText.includes('2 day')) {
    return 2;
  } else if (loweredText.includes('three') || loweredText.includes('3 day')) {
    return 3;
  } else if (loweredText.includes('four') || loweredText.includes('4 day')) {
    return 4;
  } else if (loweredText.includes('five') || loweredText.includes('5 day')) {
    return 5;
  } else if (loweredText.includes('six') || loweredText.includes('6 day')) {
    return 6;
  } else if (loweredText.includes('seven') || loweredText.includes('every day') || loweredText.includes('7 day')) {
    return 7;
  }
  
  // Default to 3 days if we can't determine
  return 3;
} 