/**
 * Utility functions for date formatting and manipulation
 */

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