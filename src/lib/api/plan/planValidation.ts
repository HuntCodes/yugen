import { TrainingSession } from "../../../types/training";

/**
 * Validate that the training plan meets minimum requirements
 */
export function validatePlan(sessions: TrainingSession[], expectedFrequency: number): {
  valid: boolean;
  errors: string[];
} {
  const result = {
    valid: true,
    errors: [] as string[]
  };

  // Check if there are any sessions
  if (!sessions || sessions.length === 0) {
    result.valid = false;
    result.errors.push('No training sessions in plan');
    return result;
  }

  // Count workout days (excluding rest days)
  const workoutDays = sessions.filter(s => 
    s.session_type?.toLowerCase() !== 'rest' && 
    s.session_type?.toLowerCase() !== 'rest day'
  ).length;

  // Validate training frequency
  if (Math.abs(workoutDays - expectedFrequency) > 1) {
    result.valid = false;
    result.errors.push(`Frequency mismatch: Plan has ${workoutDays} training days, expected around ${expectedFrequency}`);
  }

  // Check for required session types based on phase
  const phase = sessions[0]?.phase?.toLowerCase() || 'base';
  const sessionTypes = sessions.map(s => s.session_type?.toLowerCase());
  
  if (phase === 'base' || phase === 'build') {
    // Should have at least one long run in base or build phases
    if (!sessionTypes.some(type => type?.includes('long'))) {
      result.valid = false;
      result.errors.push(`Missing long run in ${phase} phase`);
    }
  }

  // Validate session distances and times
  for (const session of sessions) {
    if (session.session_type?.toLowerCase() !== 'rest' && 
        session.session_type?.toLowerCase() !== 'rest day') {
      // Non-rest sessions should have distance and time
      if (!session.distance || session.distance <= 0) {
        result.valid = false;
        result.errors.push(`Session ${session.session_type} on ${session.date} has invalid distance: ${session.distance}`);
      }
      
      if (!session.time || session.time <= 0) {
        result.valid = false;
        result.errors.push(`Session ${session.session_type} on ${session.date} has invalid time: ${session.time}`);
      }
    }
  }

  return result;
}

/**
 * Calculate the cyclical training phase based on week number
 */
export function calculateCyclicalPhase(weekNumber: number): string {
  // Basic 3-week cycle: 2 weeks build, 1 week recovery
  const cyclePosition = weekNumber % 3;
  
  if (cyclePosition < 2) {
    // First two weeks of cycle are build
    return 'Build';
  } else {
    // Third week is recovery
    return 'Recovery';
  }
}

/**
 * Ensure sessions have proper IDs and status fields
 */
export function normalizeSessionData(sessions: TrainingSession[]): TrainingSession[] {
  return sessions.map(session => ({
    ...session,
    id: session.id || crypto.randomUUID(),
    status: session.status || 'not_completed'
  }));
}

/**
 * Ensure dates are in correct format and order
 */
export function validateSessionDates(sessions: TrainingSession[]): TrainingSession[] {
  // Sort sessions by date
  const sorted = [...sessions].sort((a, b) => {
    const dateA = new Date(a.date || '');
    const dateB = new Date(b.date || '');
    return dateA.getTime() - dateB.getTime();
  });

  // Ensure all dates are valid
  return sorted.map(session => {
    if (!session.date) {
      // If no date, assume it's an error and set to today
      session.date = new Date().toISOString().split('T')[0];
    }
    return session;
  });
} 