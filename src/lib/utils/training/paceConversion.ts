/**
 * Convert pace between different units (km and miles)
 *
 * @param pace Pace value (time per distance unit)
 * @param fromUnit Source unit ('km' or 'mi')
 * @param toUnit Target unit ('km' or 'mi')
 * @returns Converted pace value
 */
export function convertPace(pace: number, fromUnit: 'km' | 'mi', toUnit: 'km' | 'mi'): number {
  if (fromUnit === toUnit) return pace;

  // 1 mile = 1.60934 km
  const conversionFactor = 1.60934;

  if (fromUnit === 'km' && toUnit === 'mi') {
    // Converting from min/km to min/mi
    return pace * conversionFactor;
  } else {
    // Converting from min/mi to min/km
    return pace / conversionFactor;
  }
}

/**
 * Convert distance between km and miles
 *
 * @param distance Distance value
 * @param fromUnit Source unit ('km' or 'mi')
 * @param toUnit Target unit ('km' or 'mi')
 * @returns Converted distance value
 */
export function convertDistance(
  distance: number,
  fromUnit: 'km' | 'mi',
  toUnit: 'km' | 'mi'
): number {
  if (fromUnit === toUnit) return distance;

  // 1 mile = 1.60934 km
  const conversionFactor = 1.60934;

  if (fromUnit === 'km' && toUnit === 'mi') {
    // Converting from km to miles
    return distance / conversionFactor;
  } else {
    // Converting from miles to km
    return distance * conversionFactor;
  }
}

/**
 * Format pace as a string (e.g., "8:30 min/km")
 *
 * @param paceMinutes Pace in minutes per unit
 * @param unit Unit ('km' or 'mi')
 * @returns Formatted pace string
 */
export function formatPace(paceMinutes: number, unit: 'km' | 'mi'): string {
  if (!paceMinutes || paceMinutes <= 0) return '-';

  const minutes = Math.floor(paceMinutes);
  const seconds = Math.round((paceMinutes - minutes) * 60);

  // Handle case where seconds rounds to 60
  const adjustedMinutes = seconds === 60 ? minutes + 1 : minutes;
  const adjustedSeconds = seconds === 60 ? 0 : seconds;

  return `${adjustedMinutes}:${adjustedSeconds.toString().padStart(2, '0')} min/${unit}`;
}

/**
 * Format time as a string (e.g., "1:30:45" for 1 hour, 30 minutes, 45 seconds)
 *
 * @param timeMinutes Time in minutes
 * @returns Formatted time string
 */
export function formatTime(timeMinutes: number): string {
  if (!timeMinutes || timeMinutes <= 0) return '-';

  const hours = Math.floor(timeMinutes / 60);
  const minutes = Math.floor(timeMinutes % 60);
  const seconds = Math.round((timeMinutes - Math.floor(timeMinutes)) * 60);

  // Handle case where seconds rounds to 60
  let adjustedMinutes = minutes;
  let adjustedHours = hours;
  let adjustedSeconds = seconds;

  if (adjustedSeconds === 60) {
    adjustedSeconds = 0;
    adjustedMinutes += 1;
  }

  if (adjustedMinutes === 60) {
    adjustedMinutes = 0;
    adjustedHours += 1;
  }

  if (adjustedHours > 0) {
    return `${adjustedHours}:${adjustedMinutes.toString().padStart(2, '0')}:${adjustedSeconds.toString().padStart(2, '0')}`;
  }

  return `${adjustedMinutes}:${adjustedSeconds.toString().padStart(2, '0')}`;
}
