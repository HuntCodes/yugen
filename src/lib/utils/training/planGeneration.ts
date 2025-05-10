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
  
  // Variables to track current day being processed
  let currentWeekNumber = 1;
  let currentDayOfWeek: number | null = null;
  let currentDate: string | null = null;
  let currentType: string | null = null;
  let currentDistance = 0;
  let currentTime = 0;
  let currentNotes = '';
  let currentPhase = 'Base';
  
  const sessions: TrainingSession[] = [];
  
  // Track if we're currently parsing a day's content
  let processingDay = false;
  
  // Lines of the plan text (remove any HTML and normalize line breaks)
  const lines = planText
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\r\n/g, '\n') // Normalize line breaks
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0); // Remove empty lines
  
  // Reset day variables when we start a new day
  const resetDayVariables = () => {
    currentDayOfWeek = null;
    currentDate = null;
    currentType = null;
    currentDistance = 0;
    currentTime = 0;
    currentNotes = '';
  };
  
  // Add the current session to our list if valid
  const addCurrentSession = () => {
    if (currentDate && currentType && currentType.toLowerCase() !== 'rest' && currentType.toLowerCase() !== 'rest day') {
      // Parse date into a proper date object
      try {
        const dateObj = new Date(currentDate);
        
        // Determine day of week if not already set
        if (!currentDayOfWeek) {
          const day = dateObj.getDay(); // 0 = Sunday, 1 = Monday, etc.
          currentDayOfWeek = day === 0 ? 7 : day; // Convert 0 to 7 (Sunday)
        }
        
        // Create session object
        sessions.push(createTrainingSession(
          currentWeekNumber,
          currentDate,
          currentType,
          currentDistance,
          currentTime,
          currentNotes,
          currentDayOfWeek,
          currentPhase
        ));
      } catch (err) {
        console.error('Error parsing date:', currentDate, err);
      }
    }
    resetDayVariables();
  };
  
  // Look for week markers and date markers to track where we are in the plan
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lowerLine = line.toLowerCase();
    
    // Check for week markers
    if (lowerLine.includes('week') && !lowerLine.includes('weekly') && (lowerLine.includes('week 1') || lowerLine.includes('week 2'))) {
      // If we were processing a day, complete it before moving to a new week
      if (processingDay) {
        addCurrentSession();
        processingDay = false;
      }
      
      // Extract week number
      const weekMatch = lowerLine.match(/week\s+(\d+)/i);
      if (weekMatch && weekMatch[1]) {
        currentWeekNumber = parseInt(weekMatch[1], 10);
      }
      
      // Look for phase information
      if (lowerLine.includes('phase')) {
        const phaseMatch = line.match(/phase:?\s*([^,)]+)/i);
        if (phaseMatch && phaseMatch[1]) {
          currentPhase = phaseMatch[1].trim();
        }
      }
      
      continue;
    }
    
    // Check for dates (YYYY-MM-DD format or other common formats)
    const dateMatch = line.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}-\d{1,2}-\d{2,4})\b/);
    if (dateMatch) {
      // If we were processing a day, complete it before starting a new one
      if (processingDay) {
        addCurrentSession();
      }
      
      currentDate = normalizeDate(dateMatch[1]);
      processingDay = true;
      
      // Look for day of week
      const dayOfWeekMatch = line.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i);
      if (dayOfWeekMatch) {
        currentDayOfWeek = convertDayToNumber(dayOfWeekMatch[1]);
      }
      
      continue;
    }
    
    // Check for day names without dates
    const dayNameMatch = line.match(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)[:\s]/i);
    if (dayNameMatch && !processingDay) {
      // If we were processing a day, complete it before starting a new one
      if (processingDay) {
        addCurrentSession();
      }
      
      currentDayOfWeek = convertDayToNumber(dayNameMatch[1]);
      processingDay = true;
      
      // Try to infer date from week number and day of week
      if (currentWeekNumber && currentDayOfWeek) {
        // Assume week 1 starts on current week's Monday
        const today = new Date();
        const daysSinceMonday = (today.getDay() || 7) - 1;
        const thisMonday = new Date(today);
        thisMonday.setDate(today.getDate() - daysSinceMonday);
        
        // Calculate the date for this session
        const sessionDate = new Date(thisMonday);
        sessionDate.setDate(thisMonday.getDate() + (currentWeekNumber - 1) * 7 + (currentDayOfWeek - 1));
        
        currentDate = sessionDate.toISOString().split('T')[0];
      }
      
      continue;
    }
    
    // If we're processing a day, look for workout details
    if (processingDay) {
      // Type
      if (lowerLine.includes('type:') || lowerLine.startsWith('type ') || lowerLine.startsWith('session type')) {
        currentType = extractValue(line);
        continue;
      }
      
      // Distance
      if (lowerLine.includes('distance:') || lowerLine.startsWith('distance ')) {
        const distanceText = extractValue(line);
        currentDistance = parseDistance(distanceText, defaultUnits);
        continue;
      }
      
      // Time
      if (lowerLine.includes('time:') || lowerLine.startsWith('time ') || lowerLine.includes('duration:')) {
        const timeText = extractValue(line);
        currentTime = parseTime(timeText);
        continue;
      }
      
      // Notes
      if (lowerLine.includes('notes:') || lowerLine.startsWith('notes ')) {
        currentNotes = extractValue(line);
        continue;
      }
      
      // Check if this might be a shorthand format line with type/distance/notes together
      if (!currentType && (
        lowerLine.includes('run') || 
        lowerLine.includes('workout') || 
        lowerLine.includes('rest') || 
        lowerLine.includes('cross') || 
        lowerLine.includes('training')
      )) {
        // This might be a combined line like "Easy Run: 5 km, 30 minutes"
        const typeParts = line.split(':');
        if (typeParts.length > 0) {
          currentType = typeParts[0].trim();
          
          // If there's more after the type, try to extract distance and notes
          if (typeParts.length > 1) {
            const detailsPart = typeParts.slice(1).join(':').trim();
            
            // Try to extract distance
            const distanceMatches = detailsPart.match(/(\d+(?:\.\d+)?)\s*(km|mi|mile|miles)/i);
            if (distanceMatches) {
              currentDistance = parseDistance(distanceMatches[0], defaultUnits);
            }
            
            // Try to extract time
            const timeMatches = detailsPart.match(/(\d+(?::\d+)?)\s*(min|minutes|hrs|hours)/i);
            if (timeMatches) {
              currentTime = parseTime(timeMatches[0]);
            }
            
            // Use the rest as notes
            currentNotes = detailsPart;
          }
        }
      }
    }
  }
  
  // Add the final session if we were processing one
  if (processingDay) {
    addCurrentSession();
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
    // Handle different formats
    let date: Date;
    
    if (dateString.includes('-')) {
      // Format: YYYY-MM-DD or DD-MM-YYYY or MM-DD-YYYY
      const parts = dateString.split('-');
      if (parts[0].length === 4) {
        // YYYY-MM-DD (already in ISO format)
        date = new Date(dateString);
      } else {
        // Assuming DD-MM-YYYY or MM-DD-YYYY based on locale
        // For simplicity, we'll assume MM-DD-YYYY for US users
        date = new Date(dateString);
      }
    } else if (dateString.includes('/')) {
      // Format: MM/DD/YYYY or DD/MM/YYYY
      // For simplicity, we'll assume MM/DD/YYYY for US users
      date = new Date(dateString);
    } else {
      // Unknown format, try native parsing
      date = new Date(dateString);
    }
    
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