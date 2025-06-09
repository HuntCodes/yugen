import { v4 as uuidv4 } from 'uuid';

import { createTrainingSession } from './sessionUtils';
import { parseDistance, parseTime, extractValue, getTrainingDays } from './workoutCalculations';
import { TrainingSession } from '../../../types/training';

/**
 * Generate a basic fallback training plan for initial onboarding
 * Generates from signup date through next Sunday (Week 1) plus one full week (Week 2)
 */
export function generateFallbackPlan(
  daysPerWeek: number = 3,
  weeklyVolume: number = 20,
  units: string = 'km'
): TrainingSession[] {
  console.log(
    'Generating fallback training plan with',
    daysPerWeek,
    'days per week and',
    weeklyVolume,
    units,
    'weekly volume'
  );

  // Use current date as starting point
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today

  // Default to 3 days if invalid
  if (daysPerWeek < 1 || daysPerWeek > 7) {
    daysPerWeek = 3;
  }

  // Determine if this is a high-mileage runner requiring double days
  const isHighMileage = weeklyVolume >= (units === 'km' ? 80 : 50);
  const needsDoubleDays = isHighMileage && daysPerWeek >= 6;

  console.log(`[Fallback] High mileage: ${isHighMileage}, Needs double days: ${needsDoubleDays}`);

  // Calculate sessions needed per week
  let sessionsPerWeek = daysPerWeek;
  if (needsDoubleDays) {
    if (weeklyVolume >= (units === 'km' ? 120 : 75)) {
      sessionsPerWeek = daysPerWeek + 3; // 3-4 double days
    } else if (weeklyVolume >= (units === 'km' ? 80 : 50)) {
      sessionsPerWeek = daysPerWeek + 1; // 1-2 double days
    }
  }

  // Calculate average distance per session based on weekly volume and sessions
  const avgSessionDistance = weeklyVolume / sessionsPerWeek || 5;

  console.log(
    `[Fallback] Sessions per week: ${sessionsPerWeek}, Avg session distance: ${avgSessionDistance.toFixed(1)} ${units}`
  );

  // Find the next Sunday for end of Week 1
  const currentDay = today.getDay(); // 0 (Sunday) to 6 (Saturday)
  const daysUntilNextSunday = currentDay === 0 ? 7 : 7 - currentDay;
  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + daysUntilNextSunday);

  // Calculate start of Week 2 (Monday after next Sunday)
  const startOfWeekTwo = new Date(nextSunday);
  startOfWeekTwo.setDate(nextSunday.getDate() + 1);

  // Calculate end of Week 2 (Sunday)
  const endOfWeekTwo = new Date(startOfWeekTwo);
  endOfWeekTwo.setDate(startOfWeekTwo.getDate() + 6);

  // Get training days (1-7, Monday-Sunday)
  const trainingDays = getTrainingDays(daysPerWeek);

  const sessions: TrainingSession[] = [];
  let sessionId = 1;

  // Helper function to create a session
  const createSession = (
    date: Date,
    dayNumber: number,
    weekNumber: number,
    sessionType: string,
    distanceMultiplier: number = 1,
    timeOfDay?: string
  ): TrainingSession => {
    let distance = avgSessionDistance * distanceMultiplier;
    distance = Math.round(distance * 10) / 10;

    const time = Math.round(distance * (units === 'km' ? 6 : 10));
    const displayType = timeOfDay ? `${sessionType} (${timeOfDay})` : sessionType;

    return {
      id: uuidv4(),
      week_number: weekNumber,
      day_of_week: dayNumber,
      date: date.toISOString().split('T')[0],
      session_type: displayType,
      distance,
      time,
      notes: generateNotes(sessionType, distance, units),
      status: 'not_completed' as const,
      phase: 'Base',
    };
  };

  // Create sessions for Week 1 (partial week)
  for (let i = currentDay; i <= 7; i++) {
    const dayNumber = i === 0 ? 7 : i; // Convert Sunday (0) to 7

    // Only create session if this is a training day
    if (trainingDays.includes(dayNumber === 7 ? 0 : dayNumber)) {
      const sessionDate = new Date(today);
      sessionDate.setDate(today.getDate() + (i - currentDay));

      // Determine session type based on day of week and training frequency
      let sessionType = 'Easy Run';
      let distanceMultiplier = 1.0;

      if (daysPerWeek <= 3) {
        // Lower frequency: focus on key workouts
        if (dayNumber === 3 || dayNumber === 4) {
          // Wed/Thu
          sessionType = 'Tempo Run';
          distanceMultiplier = 0.8;
        } else if (dayNumber === 6 || dayNumber === 7) {
          // Sat/Sun
          sessionType = 'Long Run';
          distanceMultiplier = 1.5;
        }
      } else if (daysPerWeek <= 5) {
        // Medium frequency: add variety
        if (dayNumber === 2) {
          // Tuesday
          sessionType = 'Easy Run + Strides';
          distanceMultiplier = 1.0;
        } else if (dayNumber === 4) {
          // Thursday
          sessionType = 'Tempo Run';
          distanceMultiplier = 0.8;
        } else if (dayNumber === 6) {
          // Saturday
          sessionType = 'Long Run';
          distanceMultiplier = 1.5;
        }
      } else {
        // High frequency: full variety
        if (dayNumber === 2) {
          // Tuesday
          sessionType = 'Speed Work';
          distanceMultiplier = 0.7;
        } else if (dayNumber === 3) {
          // Wednesday
          sessionType = 'Recovery Run';
          distanceMultiplier = 0.8;
        } else if (dayNumber === 4) {
          // Thursday
          sessionType = 'Fartlek';
          distanceMultiplier = 0.9;
        } else if (dayNumber === 6) {
          // Saturday
          sessionType = 'Long Run';
          distanceMultiplier = 1.6;
        }
      }

      sessions.push(createSession(sessionDate, dayNumber, 1, sessionType, distanceMultiplier));

      // Add double session if needed (high mileage and not Sunday)
      if (needsDoubleDays && dayNumber !== 7 && sessionType !== 'Long Run') {
        if (weeklyVolume >= (units === 'km' ? 100 : 60) || dayNumber === 2 || dayNumber === 4) {
          sessions.push(createSession(sessionDate, dayNumber, 1, 'Recovery Run', 0.6, 'PM'));
        }
      }

      sessionId++;
    }
  }

  // Create sessions for Week 2 (full week)
  for (let i = 1; i <= 7; i++) {
    // Only create session if this is a training day
    if (trainingDays.includes(i === 7 ? 0 : i)) {
      const sessionDate = new Date(startOfWeekTwo);
      sessionDate.setDate(startOfWeekTwo.getDate() + i - 1);

      // Determine session type based on day of week and training frequency
      let sessionType = 'Easy Run';
      let distanceMultiplier = 1.0;

      if (daysPerWeek <= 3) {
        // Lower frequency: focus on key workouts
        if (i === 2 || i === 3) {
          // Tue/Wed
          sessionType = 'Tempo Run';
          distanceMultiplier = 0.8;
        } else if (i === 6 || i === 7) {
          // Sat/Sun
          sessionType = 'Long Run';
          distanceMultiplier = 1.6;
        }
      } else if (daysPerWeek <= 5) {
        // Medium frequency: structured approach
        if (i === 2) {
          // Tuesday
          sessionType = 'Hill Repeats';
          distanceMultiplier = 0.7;
        } else if (i === 4) {
          // Thursday
          sessionType = 'Tempo Run';
          distanceMultiplier = 0.8;
        } else if (i === 6) {
          // Saturday
          sessionType = 'Long Run';
          distanceMultiplier = 1.7;
        } else if (i === 3 || i === 5) {
          // Wed/Fri
          sessionType = 'Recovery Run';
          distanceMultiplier = 0.8;
        }
      } else {
        // High frequency: full training spectrum
        if (i === 1) {
          // Monday
          sessionType = 'Easy Run';
          distanceMultiplier = 1.0;
        } else if (i === 2) {
          // Tuesday
          sessionType = 'Track Intervals';
          distanceMultiplier = 0.7;
        } else if (i === 3) {
          // Wednesday
          sessionType = 'Recovery Run';
          distanceMultiplier = 0.7;
        } else if (i === 4) {
          // Thursday
          sessionType = 'Progressive Run';
          distanceMultiplier = 0.9;
        } else if (i === 5) {
          // Friday
          sessionType = 'Easy Run + Strides';
          distanceMultiplier = 0.8;
        } else if (i === 6) {
          // Saturday
          sessionType = 'Long Run';
          distanceMultiplier = 1.8;
        } else {
          // Sunday
          sessionType = 'Cross Training';
          distanceMultiplier = 0.8;
        }
      }

      sessions.push(createSession(sessionDate, i, 2, sessionType, distanceMultiplier));

      // Add double session if needed for high mileage
      if (needsDoubleDays && i !== 7) {
        // Not Sunday
        const shouldAddDouble =
          weeklyVolume >= (units === 'km' ? 120 : 75) || // High volume: most days
          (weeklyVolume >= (units === 'km' ? 80 : 50) && (i === 2 || i === 4 || i === 5)); // Medium-high: select days

        if (shouldAddDouble && sessionType !== 'Long Run' && sessionType !== 'Cross Training') {
          const timeOfDay = sessionType === 'Easy Run' ? 'PM' : 'AM';
          const doubleType = sessionType === 'Easy Run' ? 'Easy Run' : 'Easy Run';
          sessions.push(createSession(sessionDate, i, 2, doubleType, 0.6, timeOfDay));
        }
      }

      sessionId++;
    }
  }

  // Log final volume check
  const week2Sessions = sessions.filter((s) => s.week_number === 2);
  const week2Volume = week2Sessions.reduce((total, s) => total + (s.distance || 0), 0);
  console.log(
    `[Fallback] Week 2 volume: ${week2Volume.toFixed(1)} ${units} (target: ${weeklyVolume}), sessions: ${week2Sessions.length}`
  );

  return sessions;
}

/**
 * Generate a weekly fallback training plan
 */
export function generateWeeklyFallbackPlan(
  daysPerWeek: number = 3,
  weeklyVolume: number = 20,
  units: string = 'km',
  phase: string = 'Base'
): TrainingSession[] {
  console.log(
    'Generating weekly fallback plan with',
    daysPerWeek,
    'days per week and',
    weeklyVolume,
    units,
    'weekly volume'
  );

  // Default to 3 days if invalid
  if (daysPerWeek < 1 || daysPerWeek > 7) {
    daysPerWeek = 3;
  }

  // Calculate average distance per session based on weekly volume
  const avgSessionDistance = weeklyVolume / daysPerWeek || 5; // Default to 5 if calculation fails

  // Get next Monday
  const today = new Date();
  const currentDay = today.getDay(); // 0 (Sunday) to 6 (Saturday)
  const daysUntilNextMonday = currentDay === 1 ? 7 : (8 - currentDay) % 7;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilNextMonday);
  nextMonday.setHours(0, 0, 0, 0);

  // Get training days (1-7, Monday-Sunday)
  const trainingDays = getTrainingDays(daysPerWeek);

  const sessions: TrainingSession[] = [];

  // Create sessions for the week
  for (let i = 0; i < 7; i++) {
    const dayOfWeek = i + 1; // 1-7 (Monday-Sunday)

    // Only create session if this is a training day
    if (trainingDays.includes(dayOfWeek === 7 ? 0 : dayOfWeek)) {
      const sessionDate = new Date(nextMonday);
      sessionDate.setDate(nextMonday.getDate() + i);

      // Determine session type based on day of week and phase
      let sessionType = 'Easy Run';

      if (phase === 'Base') {
        if (dayOfWeek === 2) {
          // Tuesday
          sessionType = 'Easy Run + Strides';
        } else if (dayOfWeek === 4) {
          // Thursday
          sessionType = 'Tempo Run';
        } else if (dayOfWeek === 6) {
          // Saturday
          sessionType = 'Long Run';
        } else if (dayOfWeek === 3 && daysPerWeek >= 5) {
          // Wednesday for higher frequency
          sessionType = 'Fartlek';
        } else if (dayOfWeek === 5 && daysPerWeek >= 6) {
          // Friday for high frequency
          sessionType = 'Recovery Run';
        }
      } else if (phase === 'Build') {
        if (dayOfWeek === 2) {
          // Tuesday
          sessionType = 'Track Intervals';
        } else if (dayOfWeek === 4) {
          // Thursday
          sessionType = 'Tempo Run';
        } else if (dayOfWeek === 6) {
          // Saturday
          sessionType = 'Long Run';
        } else if (dayOfWeek === 3 && daysPerWeek >= 5) {
          // Wednesday
          sessionType = 'Hill Repeats';
        } else if (dayOfWeek === 5 && daysPerWeek >= 6) {
          // Friday
          sessionType = 'Easy Run + Strides';
        }
      } else if (phase === 'Peak') {
        if (dayOfWeek === 2) {
          // Tuesday
          sessionType = 'Speed Work';
        } else if (dayOfWeek === 4) {
          // Thursday
          sessionType = 'Threshold Intervals';
        } else if (dayOfWeek === 6) {
          // Saturday
          sessionType = 'Race Pace Run';
        } else if (dayOfWeek === 3 && daysPerWeek >= 5) {
          // Wednesday
          sessionType = 'Progressive Run';
        } else if (dayOfWeek === 5 && daysPerWeek >= 6) {
          // Friday
          sessionType = 'Recovery Run';
        }
      } else if (phase === 'Taper') {
        if (dayOfWeek === 2) {
          // Tuesday
          sessionType = 'Speed Work';
        } else if (dayOfWeek === 4) {
          // Thursday
          sessionType = 'Easy Run + Strides';
        } else if (dayOfWeek === 6) {
          // Saturday
          sessionType = 'Easy Run';
        } else if (dayOfWeek === 3 && daysPerWeek >= 5) {
          // Wednesday
          sessionType = 'Fartlek';
        }
      } else if (phase === 'Race Week') {
        if (dayOfWeek === 2) {
          // Tuesday
          sessionType = 'Easy Run + Strides';
        } else if (dayOfWeek === 4) {
          // Thursday
          sessionType = 'Rest';
        } else if (dayOfWeek === 6) {
          // Saturday
          sessionType = 'Rest';
        } else if (dayOfWeek === 7) {
          // Sunday
          sessionType = 'Race Day';
        }
      } else if (phase === 'Recovery') {
        if (dayOfWeek === 6) {
          // Saturday
          sessionType = 'Cross Training';
        } else {
          sessionType = 'Recovery Run';
        }
      }

      // Skip rest days
      if (sessionType === 'Rest') {
        continue;
      }

      // Vary distance based on session type and phase
      let distance = avgSessionDistance;
      let distanceMultiplier = 1.0;

      if (sessionType === 'Easy Run') {
        distanceMultiplier = 1.0;
      } else if (sessionType === 'Recovery Run') {
        distanceMultiplier = 0.7;
      } else if (sessionType === 'Easy Run + Strides') {
        distanceMultiplier = 1.0;
      } else if (sessionType === 'Speed Work' || sessionType === 'Track Intervals') {
        distanceMultiplier = 0.8;
      } else if (sessionType === 'Hill Repeats') {
        distanceMultiplier = 0.6;
      } else if (sessionType === 'Tempo Run' || sessionType === 'Threshold Intervals') {
        distanceMultiplier = 0.9;
      } else if (sessionType === 'Fartlek') {
        distanceMultiplier = 1.0;
      } else if (sessionType === 'Progressive Run') {
        distanceMultiplier = 1.1;
      } else if (sessionType === 'Long Run') {
        distanceMultiplier =
          phase === 'Base' ? 1.5 : phase === 'Build' ? 1.8 : phase === 'Peak' ? 2.0 : 1.3;
      } else if (sessionType === 'Race Pace Run') {
        distanceMultiplier = 1.2;
      } else if (sessionType === 'Cross Training') {
        distanceMultiplier = 0.8; // Represents equivalent effort in time
      } else if (sessionType === 'Race Day') {
        // For race day, use the target race distance
        distanceMultiplier = 3.0; // Typical race might be 3x weekly average
      }

      // Apply phase-specific adjustments
      if (phase === 'Taper') {
        distanceMultiplier *= 0.7; // Reduce volume during taper
      } else if (phase === 'Race Week') {
        distanceMultiplier *= 0.5; // Further reduce volume race week
      } else if (phase === 'Recovery') {
        distanceMultiplier *= 0.6; // Reduce volume during recovery
      }

      distance = avgSessionDistance * distanceMultiplier;

      // Round to 1 decimal place
      distance = Math.round(distance * 10) / 10;

      // Estimate time (rough pace of 6 min/km or 10 min/mile)
      const time = Math.round(distance * (units === 'km' ? 6 : 10));

      sessions.push({
        id: uuidv4(),
        week_number: 1, // Always week 1 for weekly plans
        day_of_week: dayOfWeek,
        date: sessionDate.toISOString().split('T')[0],
        session_type: sessionType,
        distance,
        time,
        notes: generateNotes(sessionType, distance, units),
        status: 'not_completed' as const,
        phase,
      });
    }
  }

  return sessions;
}

/**
 * Generates placeholder notes for a given session type, distance, and units.
 * This function is kept as it's used by fallback plan generators.
 */
function generateNotes(sessionType: string, distance: number, units: string): string {
  switch (sessionType) {
    case 'Easy Run':
      return `Easy conversational pace for ${distance}${units}. Focus on recovery and aerobic base building.`;
    case 'Recovery Run':
      return `Very easy pace recovery run for ${distance}${units}. Should feel effortless and refreshing.`;
    case 'Long Run':
      return `Steady long run of ${distance}${units}. Build endurance at comfortable aerobic pace.`;
    case 'Tempo Run':
      return `Tempo run: warm-up, ${Math.max(1, Math.round(distance * 0.6))}${units} at comfortably hard pace, cool-down. Total ${distance}${units}.`;
    case 'Speed Work':
      return `Speed session: include warm-up, fast intervals (e.g., 6x400m at 5K pace), and cool-down. Total ${distance}${units}.`;
    case 'Track Intervals':
      return `Structured track intervals: warm-up, main set (e.g., 5x1000m at 5K pace), cool-down. Total ${distance}${units}.`;
    case 'Hill Repeats':
      return `Hill training: warm-up, ${Math.max(4, Math.round(distance * 2))} x 90-second hill repeats at 5K effort, jog down recovery. Total ${distance}${units}.`;
    case 'Fartlek':
      return `Fartlek run: ${distance}${units} with unstructured speed play. Mix fast surges (30s-3min) with easy recovery.`;
    case 'Progressive Run':
      return `Progressive run: start easy for ${Math.round(distance * 0.5)}${units}, gradually increase to moderate-hard for final ${Math.round(distance * 0.3)}${units}. Total ${distance}${units}.`;
    case 'Easy Run + Strides':
      return `Easy run of ${Math.max(1, distance - 0.5)}${units}, followed by 4-6 x 100m strides with full recovery.`;
    case 'Race Pace Run':
      return `Run ${distance}${units} at your target race pace. Practice fueling and pacing strategy.`;
    case 'Threshold Intervals':
      return `Threshold intervals: warm-up, 3-4 x 6-8min at tempo pace with 2min recovery, cool-down. Total ${distance}${units}.`;
    case 'Cross Training':
      return `Non-impact cross training for ${Math.round(distance * 8)}min. Options: cycling, swimming, elliptical, or strength training.`;
    case 'Strength Training':
      return `Running-specific strength training session. Focus on core, glutes, and single-leg stability. 45-60 minutes.`;
    case 'Negative Split Run':
      return `Negative split run: first ${Math.round(distance * 0.5)}${units} easy, second half progressively faster. Total ${distance}${units}.`;
    case 'Time Trial':
      return `Time trial effort over ${distance}${units}. Warm-up well, then race effort to gauge current fitness.`;
    case 'Brick Training':
      return `Back-to-back training: main session immediately followed by easy running to simulate race fatigue.`;
    case 'Workout + Easy':
      return `Combined session: structured workout followed by easy running. Total volume ${distance}${units}.`;
    case 'Race Day':
      return `Race Day! Good luck! Remember your pacing and nutrition strategy.`;
    case 'Rest':
      return 'Complete rest day for recovery and adaptation.';
    default:
      return `Workout: ${sessionType}, ${distance}${units}. Follow your coach's specific instructions.`;
  }
}
