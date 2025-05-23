import { useState, useEffect } from 'react';
import { TrainingSession } from '../../types/training';

export interface WeeklyMileage {
  weekNumber: number;
  plannedMileage: number;
  actualMileage: number;
}

/**
 * Hook to calculate weekly mileage data from training sessions.
 * 
 * Important Week 1 Handling:
 * - Week 1 is a partial week from user's start date until the next Monday
 * - Week 1's training load should be proportionally reduced based on available days
 *   Example: If user joins on Saturday, Week 1 should only have 1-2 sessions,
 *   not try to fit a full week's training into 2 days
 * - Week 2 starts on the first Monday after joining and is always a full week
 * - All subsequent weeks are full Monday-Sunday weeks
 * 
 * @param sessions Array of training sessions
 * @returns Weekly mileage data for display
 */
export function useMileageData(sessions: TrainingSession[]) {
  const [weeklyMileage, setWeeklyMileage] = useState<WeeklyMileage[]>([]);

  useEffect(() => {
    if (sessions.length === 0) {
      setWeeklyMileage([]);
      return;
    }

    // Find the earliest session date to use as reference point
    const sortedSessions = [...sessions].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const firstSessionDate = new Date(sortedSessions[0].date);
    
    // Find the next Monday after the first session
    // This will be the start of Week 2
    const firstSessionDay = firstSessionDate.getDay(); // 0 (Sunday) to 6 (Saturday)
    const daysUntilNextMonday = firstSessionDay === 0 ? 1 : 8 - firstSessionDay;
    const startOfWeekTwo = new Date(firstSessionDate);
    startOfWeekTwo.setDate(firstSessionDate.getDate() + daysUntilNextMonday);
    startOfWeekTwo.setHours(0, 0, 0, 0);

    // Group sessions by their actual week based on date
    const sessionsByWeek = sessions.reduce((acc, session) => {
      try {
        const sessionDate = new Date(session.date);
        let weekNumber;

        // If the session is before the start of Week 2, it's in Week 1
        // Note: Week 1 is a partial week and should have reduced training load
        // proportional to the number of available days
        if (sessionDate < startOfWeekTwo) {
          weekNumber = 1;
        } else {
          // For Week 2 onwards, calculate full weeks since start of Week 2
          // These are always full Monday-Sunday weeks with normal training load
          const daysSinceWeekTwo = Math.floor(
            (sessionDate.getTime() - startOfWeekTwo.getTime()) / (1000 * 60 * 60 * 24)
          );
          weekNumber = Math.floor(daysSinceWeekTwo / 7) + 2; // +2 because we start at Week 2
        }

        // Skip sessions that are more than 8 weeks out (likely incorrect dates)
        if (weekNumber > 8 || weekNumber < 1) {
          return acc;
        }

        if (!acc[weekNumber]) {
          acc[weekNumber] = { planned: 0, actual: 0 };
        }
        
        // Add to planned mileage
        acc[weekNumber].planned += session.distance || 0;
        
        // Add to actual mileage only if completed
        if (session.status === 'completed') {
          acc[weekNumber].actual += session.distance || 0;
        }
      } catch (err) {
        console.error('Error processing session for mileage calculation:', err, session);
      }
      return acc;
    }, {} as Record<number, { planned: number; actual: number }>);

    // Convert to array format for the graph
    const mileageData = Object.entries(sessionsByWeek).map(([week, data]) => ({
      weekNumber: parseInt(week),
      plannedMileage: Math.round(data.planned * 10) / 10, // Round to 1 decimal place
      actualMileage: Math.round(data.actual * 10) / 10, // Round to 1 decimal place
    }));

    // Sort by week number
    mileageData.sort((a, b) => a.weekNumber - b.weekNumber);

    setWeeklyMileage(mileageData);
  }, [sessions]);

  return weeklyMileage;
} 