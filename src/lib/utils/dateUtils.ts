/**
 * Utility functions for date formatting and manipulation
 */
import { LocalDate, ZoneId } from '@js-joda/core';
import '@js-joda/timezone'; // Required for ZoneId.systemDefault()

/**
 * Format a date string for display in the UI
 * @param dateString - ISO date string to format
 * @returns Formatted date string (e.g., "Monday, Jan 1")
 */
export const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  } catch (err) {
    console.error('Error formatting date:', dateString, err);
    return dateString; // Return original if parsing fails
  }
};

/**
 * Get day of week for a given date
 * @param dateString - ISO date string
 * @returns Day of week (e.g., "Mon")
 */
export const getDayOfWeek = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } catch (err) {
    return '';
  }
};

/**
 * Format a date as YYYY-MM-DD in the user's LOCAL timezone
 * This properly uses local date methods to avoid UTC conversion issues
 * 
 * IMPORTANT: This fixes the timezone issue where training plan autoscroll
 * was using UTC dates but should use the user's local timezone.
 * 
 * Example: If it's 11 PM PST on Dec 15, UTC is already Dec 16.
 * - Wrong approach: toISOString().split('T')[0] gives UTC date (Dec 16)
 * - Correct approach: Use local date methods to get actual local date (Dec 15)
 * 
 * @param date - Date object to format (optional, defaults to today)
 * @returns Date string in YYYY-MM-DD format in user's LOCAL timezone
 */
export const formatDateYMD = (date: Date = new Date()): string => {
  // Use local date methods to avoid UTC conversion
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get today's date as YYYY-MM-DD string in user's LOCAL timezone
 * Uses js-joda to ensure proper timezone handling like HomeScreen
 * 
 * DEBUG: To verify this works correctly, you can test:
 * console.log('Wrong (UTC):', new Date().toISOString().split('T')[0]);
 * console.log('Correct (Local):', getTodayYMD());
 * 
 * @returns Today's date string in YYYY-MM-DD format in user's local timezone
 */
export const getTodayYMD = (): string => {
  const systemZone = ZoneId.systemDefault();
  const userLocalToday = LocalDate.now(systemZone);
  return userLocalToday.toString(); // Returns YYYY-MM-DD format
}; 