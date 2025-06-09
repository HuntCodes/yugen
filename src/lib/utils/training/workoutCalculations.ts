import { TrainingSession } from '../../../types/training';

/**
 * Get array of days to schedule workouts based on frequency
 */
export function getTrainingDays(daysPerWeek: number): number[] {
  // Default to Monday, Wednesday, Friday for 3 days
  const defaultDays = [1, 3, 5]; // 1 = Monday, 3 = Wednesday, 5 = Friday

  if (daysPerWeek <= 0 || daysPerWeek > 7) {
    return defaultDays;
  }

  if (daysPerWeek === 1) {
    return [3]; // Wednesday
  } else if (daysPerWeek === 2) {
    return [2, 5]; // Tuesday, Friday
  } else if (daysPerWeek === 3) {
    return defaultDays;
  } else if (daysPerWeek === 4) {
    return [1, 3, 5, 6]; // Monday, Wednesday, Friday, Saturday
  } else if (daysPerWeek === 5) {
    return [1, 2, 4, 5, 6]; // Monday, Tuesday, Thursday, Friday, Saturday
  } else if (daysPerWeek === 6) {
    return [1, 2, 3, 4, 5, 6]; // Monday through Saturday
  } else {
    return [0, 1, 2, 3, 4, 5, 6]; // Every day
  }
}

/**
 * Parse distance text into a numeric value
 * @param text Text containing distance information
 * @param defaultUnits Default units (km or miles)
 * @returns Numeric distance value
 */
export function parseDistance(text: string, defaultUnits: string): number {
  if (!text) return 0;

  // Clean up the text
  const lowerText = text.toLowerCase().trim();

  // Try to extract a number and unit
  const matches = lowerText.match(/(\d+(?:\.\d+)?)\s*(km|mi|mile|miles)?/);
  if (matches && matches[1]) {
    const value = parseFloat(matches[1]);
    const unit = matches[2] || defaultUnits;

    // Convert to km or miles based on default unit
    if (defaultUnits === 'km' && (unit === 'mi' || unit === 'mile' || unit === 'miles')) {
      return value * 1.60934;
    } else if (defaultUnits === 'mi' && unit === 'km') {
      return value / 1.60934;
    }

    return value;
  }

  return 0;
}

/**
 * Parse time text into minutes
 * @param text Text containing time information
 * @returns Time in minutes
 */
export function parseTime(text: string): number {
  if (!text) return 0;

  // Clean up the text
  const lowerText = text.toLowerCase().trim();

  // Format: HH:MM:SS or MM:SS
  const timeFormatMatch = lowerText.match(/(\d+):(\d+)(?::(\d+))?/);
  if (timeFormatMatch) {
    if (timeFormatMatch[3]) {
      // HH:MM:SS format
      const hours = parseInt(timeFormatMatch[1], 10);
      const minutes = parseInt(timeFormatMatch[2], 10);
      const seconds = parseInt(timeFormatMatch[3], 10);
      return hours * 60 + minutes + seconds / 60;
    } else {
      // MM:SS format
      const minutes = parseInt(timeFormatMatch[1], 10);
      const seconds = parseInt(timeFormatMatch[2], 10);
      return minutes + seconds / 60;
    }
  }

  // Format: X hours Y minutes
  const hourMinMatch = lowerText.match(
    /(\d+)\s*(?:hour|hr|h)s?\s*(?:and\s*)?(?:(\d+)\s*(?:minute|min|m)s?)?/
  );
  if (hourMinMatch) {
    const hours = parseInt(hourMinMatch[1], 10);
    const minutes = hourMinMatch[2] ? parseInt(hourMinMatch[2], 10) : 0;
    return hours * 60 + minutes;
  }

  // Format: X minutes
  const minutesMatch = lowerText.match(/(\d+)\s*(?:minute|min|m)s?/);
  if (minutesMatch) {
    return parseInt(minutesMatch[1], 10);
  }

  // Just a number, assume minutes
  const numberMatch = lowerText.match(/^(\d+)$/);
  if (numberMatch) {
    return parseInt(numberMatch[1], 10);
  }

  return 0;
}

/**
 * Extract a value from a line of text
 */
export function extractValue(line: string): string {
  const parts = line.split(':');
  return parts.length > 1 ? parts.slice(1).join(':').trim() : '';
}
