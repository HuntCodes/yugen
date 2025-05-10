import { TrainingSession } from '../../../types/training';
import { v4 as uuidv4 } from 'uuid';

/**
 * Update any session dates to use the current year
 */
export function updateSessionDatesToCurrentYear(sessions: TrainingSession[], isNewUser: boolean = false): TrainingSession[] {
  const currentYear = new Date().getFullYear();
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0); // Start of today
  
  // Get the current day of week (0-6, where 0 is Sunday)
  const currentDay = startDate.getDay();
  const daysToMonday = currentDay === 0 ? 6 : currentDay - 1; // Convert to days until Monday
  const startOfCurrentWeek = new Date(startDate);
  startOfCurrentWeek.setDate(startDate.getDate() - daysToMonday);
  startOfCurrentWeek.setHours(0, 0, 0, 0);
  
  return sessions.map((session, index) => {
    try {
      // Parse the date
      const sessionDate = new Date(session.date);
      
      // Check if date is in the past or has an old year
      if (sessionDate.getFullYear() < currentYear || sessionDate < startDate) {
        // For new users in week 1, only include sessions from their signup day onwards
        if (isNewUser && session.week_number === 1) {
          const signupDay = currentDay === 0 ? 7 : currentDay; // Convert to 1-7 format
          if (session.day_of_week < signupDay) {
            return session; // Skip sessions before signup day
          }
        }
        
        // Calculate new date based on week number and day of week
        const newDate = new Date(startOfCurrentWeek);
        newDate.setDate(startOfCurrentWeek.getDate() + (session.week_number - 1) * 7 + (session.day_of_week - 1));
        
        return {
          ...session,
          date: newDate.toISOString().split('T')[0] // YYYY-MM-DD format
        };
      }
      
      return session;
    } catch (err) {
      console.error('Error updating session date:', err);
      return session;
    }
  });
}

/**
 * Update session dates based on week number and day of week
 */
export function updateSessionDates(sessions: TrainingSession[], isNewUser: boolean = false): TrainingSession[] {
  // Similar to updateSessionDatesToCurrentYear but maintains original functionality
  return updateSessionDatesToCurrentYear(sessions, isNewUser);
}

/**
 * Create a new training session with the given parameters
 */
export const createTrainingSession = (
  weekNumber: number,
  date: string,
  sessionType: string,
  distance: number,
  time: number,
  notes: string,
  dayOfWeek?: number,
  phase: string = 'Base'
): TrainingSession => {
  // Calculate day of week if not provided (1-7, Monday-Sunday)
  const calculatedDayOfWeek = dayOfWeek || new Date(date).getDay() || 7; // Convert 0 (Sunday) to 7
  
  return {
    id: uuidv4(),
    week_number: weekNumber,
    day_of_week: calculatedDayOfWeek,
    date,
    session_type: sessionType,
    distance,
    time,
    notes,
    status: 'not_completed',
    phase
  };
}; 