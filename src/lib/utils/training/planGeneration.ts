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
 * Parse text-based training plan into structured TrainingSession objects
 */
export function parseTextPlanToSessions(planText: string, defaultUnits: string = 'km'): TrainingSession[] {
  console.log('Parsing text plan with default units:', defaultUnits);

  const sessions: TrainingSession[] = [];
  let currentWeekNumber = 0;
  let currentPhase = 'Base'; // Default phase
  let columnOrder: string[] = [];

  const lines = planText
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\r\n|\r/g, '\n') // Normalize all line breaks to \n
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();

    // Detect WEEK block (allows for markdown headers like ### WEEK 1)
    const weekMatch = lowerLine.match(/(?:^#*\s*)?week\s*(\d+)/i);
    if (weekMatch && weekMatch[1]) {
      currentWeekNumber = parseInt(weekMatch[1], 10);
      columnOrder = []; // Reset column order for new week/table
      currentPhase = 'Base'; // Reset to default phase for a new week block

      // Attempt to find Phase on the same line or next few lines
      let phaseFound = false;
      for (let j = 0; j <= 3 && (i + j) < lines.length; j++) {
        const searchLine = lines[i+j];
        // Regex for Phase: case-insensitive, handles optional bolding, extracts phase name before parentheses or commas
        const phaseMatch = searchLine.match(/(?:\*\*)?Phase:(?:\*\*)?\s*([^\(\[\n,]+)/i);
        if (phaseMatch && phaseMatch[1]) {
          currentPhase = phaseMatch[1].trim();
          phaseFound = true;
          // If phase is found on a different line than week, advance i to avoid re-processing phase line as something else
          if (j > 0) i = i + j;
          break;
        }
      }
      if(phaseFound) console.log(`Detected Week: ${currentWeekNumber}, Phase: ${currentPhase}`);
      else console.log(`Detected Week: ${currentWeekNumber}, Phase: ${currentPhase} (default)`);
      continue; // Move to next line after processing week/phase info
    }
    
    // Skip lines that are just "---", decorative, or section summaries that aren't table data
    if (line.match(/^---+$/) || lowerLine.startsWith('total volume for week') || lowerLine.startsWith('summary:')) {
        continue;
    }

    // Detect Markdown table header row (e.g., | Date | Type | ... |)
    // And then the separator (e.g., |---|---|...|)
    if (line.startsWith('|') && line.endsWith('|') && lines[i+1] && lines[i+1].startsWith('|') && lines[i+1].includes('---')) {
      columnOrder = line.split('|').map(header => header.trim().toLowerCase()).filter(h => h);
      // console.log('Detected table headers:', columnOrder);
      i++; // Skip the separator line for the next iteration
      continue;
    }

    // Process Markdown table data row
    if (line.startsWith('|') && line.endsWith('|') && columnOrder.length > 0 && currentWeekNumber > 0) {
      const cells = line.split('|').map(cell => cell.trim()).slice(1, -1); // Get content cells, remove first/last empty from split

      if (cells.length === columnOrder.length) {
        let sessionData: any = { phase: currentPhase, week: currentWeekNumber };
        
        columnOrder.forEach((colName, idx) => {
          const cellValue = cells[idx];
          if (colName.includes('date')) sessionData.date = normalizeDate(cellValue);
          else if (colName.includes('type')) sessionData.type = cellValue;
          // Ensure distance and time text are captured even if they are just numbers
          else if (colName.includes('distance')) sessionData.distanceText = cellValue; 
          else if (colName.includes('time')) sessionData.timeText = cellValue; 
          else if (colName.includes('notes')) sessionData.notes = cellValue;
        });

        if (sessionData.date && sessionData.type && sessionData.type.toLowerCase() !== 'rest' && sessionData.type.toLowerCase() !== 'rest day' && !sessionData.type.toLowerCase().includes('total volume')) {
          try {
            const dateObj = new Date(sessionData.date);
            const dayOfWeek = dateObj.getDay() === 0 ? 7 : dateObj.getDay(); // Sunday is 7

            const distance = sessionData.distanceText ? parseDistance(sessionData.distanceText, defaultUnits) : 0;
            const time = sessionData.timeText ? parseTime(sessionData.timeText) : 0;
            
            // Only add session if essential data is present (e.g. type is not empty)
            if(sessionData.type && sessionData.type.trim() !== '' ){
              sessions.push(createTrainingSession(
                currentWeekNumber,
                sessionData.date,
                sessionData.type,
                distance,
                time,
                sessionData.notes || '',
                dayOfWeek,
                currentPhase
              ));
            } else {
              // console.log('Skipping row due to empty type:', cells);
            }
          } catch (err) {
            console.error('Error creating session from Markdown row:', sessionData, err);
          }
        }
      } else {
        // console.log('Cell count mismatch. Expected:', columnOrder.length, 'Got:', cells.length, 'Row:', line);
      }
    }
  }

  console.log('Parsed sessions:', sessions.length);
  return sessions;
}

/**
 * Generate workout notes based on session type
 */
function generateNotes(sessionType: string, distance: number, units: string): string {
  switch (sessionType) {
    case 'Easy Run':
      return `Easy run at comfortable, conversational pace.`;
    case 'Easy Run + Strides':
      return `Easy run with 6-8 strides (15-20 seconds) at the end.`;
    case 'Speed Work':
      return `Warm up, then ${Math.round(distance * 0.4)} ${units} of intervals at 5K pace, cool down.`;
    case 'Tempo Run':
      return `Warm up, then ${Math.round(distance * 0.5)} ${units} at threshold pace, cool down.`;
    case 'Long Run':
      return `Long run at easy, comfortable pace.`;
    case 'Race Pace Run':
      return `Warm up, then ${Math.round(distance * 0.6)} ${units} at goal race pace, cool down.`;
    case 'Race Day':
      return `RACE DAY! Good luck and enjoy the race!`;
    default:
      return `${sessionType} at appropriate effort.`;
  }
}

/**
 * Convert day name to number (1-7, Monday-Sunday)
 */
function convertDayToNumber(dayName: string): number {
  const lowerDay = dayName.toLowerCase();
  
  if (lowerDay.startsWith('mon')) return 1;
  if (lowerDay.startsWith('tue')) return 2;
  if (lowerDay.startsWith('wed')) return 3;
  if (lowerDay.startsWith('thu')) return 4;
  if (lowerDay.startsWith('fri')) return 5;
  if (lowerDay.startsWith('sat')) return 6;
  if (lowerDay.startsWith('sun')) return 7;
  
  return 1; // Default to Monday
}

/**
 * Normalize different date formats to YYYY-MM-DD
 */
function normalizeDate(dateString: string): string {
  try {
    // Parse the date directly - JavaScript's Date constructor can handle 
    // most common formats like YYYY-MM-DD, MM/DD/YYYY, etc.
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid date format:', dateString);
      return dateString;
    }
    
    // Format as YYYY-MM-DD
    return date.toISOString().split('T')[0];
  } catch (err) {
    console.error('Error normalizing date:', dateString, err);
    return dateString;
  }
} 