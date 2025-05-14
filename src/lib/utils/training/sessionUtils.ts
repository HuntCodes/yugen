import { TrainingSession } from '../../../types/training';
import { v4 as uuidv4 } from 'uuid';

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