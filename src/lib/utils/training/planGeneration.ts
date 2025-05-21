import { TrainingSession } from '../../../types/training';
import { v4 as uuidv4 } from 'uuid';
import { createTrainingSession } from './sessionUtils';
import { parseDistance, parseTime, extractValue } from './workoutCalculations';
import { getTrainingDays } from './workoutCalculations';

/**
 * Generate a basic fallback training plan for initial onboarding
 * Generates from signup date through next Sunday (Week 1) plus one full week (Week 2)
 */
export function generateFallbackPlan(daysPerWeek: number = 3, weeklyVolume: number = 20, units: string = 'km'): TrainingSession[] {
  console.log('Generating fallback training plan with', daysPerWeek, 'days per week and', weeklyVolume, units, 'weekly volume');
  
  // Use current date as starting point
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today
  
  // Default to 3 days if invalid
  if (daysPerWeek < 1 || daysPerWeek > 7) {
    daysPerWeek = 3;
  }
  
  // Calculate average distance per session based on weekly volume
  const avgSessionDistance = weeklyVolume / daysPerWeek || 5; // Default to 5 if calculation fails
  
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
  
  // Create sessions for Week 1 (partial week)
  for (let i = currentDay; i <= 7; i++) {
    const dayNumber = i === 0 ? 7 : i; // Convert Sunday (0) to 7
    
    // Only create session if this is a training day
    if (trainingDays.includes(dayNumber === 7 ? 0 : dayNumber)) {
      const sessionDate = new Date(today);
      sessionDate.setDate(today.getDate() + (i - currentDay));
      
      // Determine session type based on day of week
      let sessionType = "Easy Run";
      if (dayNumber === 3) { // Wednesday
        sessionType = "Tempo Run";
      } else if (dayNumber === 6) { // Saturday
        sessionType = "Long Run";
      }
      
      // Vary distance based on session type
      let distance = avgSessionDistance;
      if (sessionType === "Tempo Run") {
        distance = avgSessionDistance * 0.8;
      } else if (sessionType === "Long Run") {
        distance = avgSessionDistance * 1.5;
      }
      
      // Round to 1 decimal place
      distance = Math.round(distance * 10) / 10;
      
      // Estimate time (rough pace of 6 min/km or 10 min/mile)
      const time = Math.round(distance * (units === 'km' ? 6 : 10));
      
      sessions.push({
        id: uuidv4(),
        week_number: 1,
        day_of_week: dayNumber,
        date: sessionDate.toISOString().split('T')[0],
        session_type: sessionType,
        distance,
        time,
        notes: `${sessionType} at easy pace`,
        status: 'not_completed',
        phase: 'Base'
      });
      
      sessionId++;
    }
  }
  
  // Create sessions for Week 2 (full week)
  for (let i = 1; i <= 7; i++) {
    // Only create session if this is a training day
    if (trainingDays.includes(i === 7 ? 0 : i)) {
      const sessionDate = new Date(startOfWeekTwo);
      sessionDate.setDate(startOfWeekTwo.getDate() + i - 1);
      
      // Determine session type based on day of week
      let sessionType = "Easy Run";
      if (i === 2) { // Tuesday
        sessionType = "Speed Work";
      } else if (i === 4) { // Thursday
        sessionType = "Tempo Run";
      } else if (i === 6) { // Saturday
        sessionType = "Long Run";
      }
      
      // Vary distance based on session type
      let distance = avgSessionDistance;
      if (sessionType === "Speed Work") {
        distance = avgSessionDistance * 0.7;
      } else if (sessionType === "Tempo Run") {
        distance = avgSessionDistance * 0.8;
      } else if (sessionType === "Long Run") {
        distance = avgSessionDistance * 1.8;
      }
      
      // Round to 1 decimal place
      distance = Math.round(distance * 10) / 10;
      
      // Estimate time (rough pace of 6 min/km or 10 min/mile)
      const time = Math.round(distance * (units === 'km' ? 6 : 10));
      
      sessions.push({
        id: uuidv4(),
        week_number: 2,
        day_of_week: i,
        date: sessionDate.toISOString().split('T')[0],
        session_type: sessionType,
        distance,
        time,
        notes: generateNotes(sessionType, distance, units),
        status: 'not_completed',
        phase: 'Base'
      });
      
      sessionId++;
    }
  }
  
  return sessions;
}

/**
 * Generate a weekly fallback training plan
 */
export function generateWeeklyFallbackPlan(daysPerWeek: number = 3, weeklyVolume: number = 20, units: string = 'km', phase: string = 'Base'): TrainingSession[] {
  console.log('Generating weekly fallback plan with', daysPerWeek, 'days per week and', weeklyVolume, units, 'weekly volume');
  
  // Default to 3 days if invalid
  if (daysPerWeek < 1 || daysPerWeek > 7) {
    daysPerWeek = 3;
  }
  
  // Calculate average distance per session based on weekly volume
  const avgSessionDistance = weeklyVolume / daysPerWeek || 5; // Default to 5 if calculation fails
  
  // Get next Monday
  const today = new Date();
  const currentDay = today.getDay(); // 0 (Sunday) to 6 (Saturday)
  const daysUntilNextMonday = (currentDay === 1) ? 7 : ((8 - currentDay) % 7);
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
      let sessionType = "Easy Run";
      
      if (phase === "Base") {
        if (dayOfWeek === 2) { // Tuesday
          sessionType = "Easy Run + Strides";
        } else if (dayOfWeek === 4) { // Thursday
          sessionType = "Tempo Run";
        } else if (dayOfWeek === 6) { // Saturday
          sessionType = "Long Run";
        }
      } else if (phase === "Build") {
        if (dayOfWeek === 2) { // Tuesday
          sessionType = "Speed Work";
        } else if (dayOfWeek === 4) { // Thursday
          sessionType = "Tempo Run";
        } else if (dayOfWeek === 6) { // Saturday
          sessionType = "Long Run";
        }
      } else if (phase === "Peak") {
        if (dayOfWeek === 2) { // Tuesday
          sessionType = "Speed Work";
        } else if (dayOfWeek === 4) { // Thursday
          sessionType = "Tempo Run";
        } else if (dayOfWeek === 6) { // Saturday
          sessionType = "Race Pace Run";
        }
      } else if (phase === "Taper") {
        if (dayOfWeek === 2) { // Tuesday
          sessionType = "Speed Work";
        } else if (dayOfWeek === 4) { // Thursday
          sessionType = "Easy Run + Strides";
        } else if (dayOfWeek === 6) { // Saturday
          sessionType = "Easy Run";
        }
      } else if (phase === "Race Week") {
        if (dayOfWeek === 2) { // Tuesday
          sessionType = "Easy Run + Strides";
        } else if (dayOfWeek === 4) { // Thursday
          sessionType = "Rest";
        } else if (dayOfWeek === 6) { // Saturday
          sessionType = "Rest";
        } else if (dayOfWeek === 7) { // Sunday
          sessionType = "Race Day";
        }
      } else if (phase === "Recovery") {
        sessionType = "Easy Run";
      }
      
      // Skip rest days
      if (sessionType === "Rest") {
        continue;
      }
      
      // Vary distance based on session type and phase
      let distance = avgSessionDistance;
      let distanceMultiplier = 1.0;
      
      if (sessionType === "Easy Run + Strides") {
        distanceMultiplier = 1.0;
      } else if (sessionType === "Speed Work") {
        distanceMultiplier = 0.8;
      } else if (sessionType === "Tempo Run") {
        distanceMultiplier = 0.9;
      } else if (sessionType === "Long Run") {
        distanceMultiplier = phase === "Base" ? 1.5 : 
                             phase === "Build" ? 1.8 :
                             phase === "Peak" ? 2.0 : 1.3;
      } else if (sessionType === "Race Pace Run") {
        distanceMultiplier = 1.2;
      } else if (sessionType === "Race Day") {
        // For race day, use the target race distance
        distanceMultiplier = 3.0; // Typical race might be 3x weekly average
      }
      
      // Apply phase-specific adjustments
      if (phase === "Taper") {
        distanceMultiplier *= 0.7; // Reduce volume during taper
      } else if (phase === "Race Week") {
        distanceMultiplier *= 0.5; // Further reduce volume race week
      } else if (phase === "Recovery") {
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
        status: 'not_completed',
        phase
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
    case "Easy Run":
      return `Easy conversational pace for ${distance}${units}. Focus on recovery.`;
    case "Long Run":
      return `Steady long run of ${distance}${units}. Build endurance.`;
    case "Tempo Run":
      return `Tempo run: warm-up, ${Math.max(1, Math.round(distance * 0.6))}${units} at comfortably hard pace, cool-down.`;
    case "Speed Work": // Generic Speed Work, could be intervals or fartlek
      return `Speed session: include warm-up, efforts (e.g., repeats of 400m-1km), and cool-down. Total ${distance}${units}.`;
    case "Easy Run + Strides":
      return `Easy run of about ${Math.max(1, distance - 0.5)}${units}, followed by 4-6 x 100m strides.`;
    case "Race Pace Run":
        return `Run ${distance}${units} at your target race pace. Practice fueling and pacing strategy.`;
    case "Race Day":
        return `Race Day! Good luck! Remember your pacing and nutrition strategy.`;
    default:
      return `Workout: ${sessionType}, ${distance}${units}.`;
  }
} 