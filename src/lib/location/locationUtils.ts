/**
 * Utility functions for location functionality
 */

import * as Location from 'expo-location';

/**
 * Check if location permissions are granted
 * @returns Promise resolving to boolean indicating if permission is granted
 */
export const checkLocationPermission = async (): Promise<boolean> => {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch (err) {
    console.error('Error checking location permission:', err);
    return false;
  }
};

/**
 * Request location permissions from the user
 * @returns Promise resolving to boolean indicating if permission was granted
 */
export const requestLocationPermission = async (): Promise<boolean> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (err) {
    console.error('Error requesting location permission:', err);
    return false;
  }
};

/**
 * Get the user's current location
 * @returns Promise resolving to location coordinates
 */
export const getCurrentLocation = async (): Promise<{
  latitude: number;
  longitude: number;
} | null> => {
  try {
    const hasPermission = await checkLocationPermission();
    if (!hasPermission) {
      console.warn('Location permission not granted');
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (err) {
    console.error('Error getting current location:', err);
    return null;
  }
};
