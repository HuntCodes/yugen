/**
 * Utility functions for voice chat functionality
 */

import { Audio } from 'expo-av';

/**
 * Check if microphone permissions are granted
 * @returns Promise resolving to boolean indicating if permission is granted
 */
export const checkMicrophonePermission = async (): Promise<boolean> => {
  try {
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted';
  } catch (err) {
    console.error('Error checking microphone permission:', err);
    return false;
  }
};

/**
 * Request microphone permissions from the user
 * @returns Promise resolving to boolean indicating if permission was granted
 */
export const requestMicrophonePermission = async (): Promise<boolean> => {
  try {
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted';
  } catch (err) {
    console.error('Error requesting microphone permission:', err);
    return false;
  }
};

/**
 * Format transcript text for better readability
 * This is useful for cleaning up the raw transcript text
 * @param text Raw transcript text
 * @returns Formatted text
 */
export const formatTranscript = (text: string): string => {
  // Capitalize first letter
  let formatted = text.trim();
  if (formatted.length > 0) {
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  // Add period at the end if not already present
  const lastChar = formatted.charAt(formatted.length - 1);
  if (formatted.length > 0 && !['.', '!', '?'].includes(lastChar)) {
    formatted += '.';
  }

  return formatted;
};

/**
 * Process and clean up speech recognition output
 * @param text Raw transcript text from speech recognition
 * @returns Cleaned and processed text
 */
export const processVoiceInput = (text: string): string => {
  // Remove fillers and hesitations
  let processed = text.replace(/uh |um |ah |er |like |you know /gi, '');
  
  // Trim extra whitespace
  processed = processed.replace(/\s+/g, ' ').trim();
  
  return formatTranscript(processed);
}; 