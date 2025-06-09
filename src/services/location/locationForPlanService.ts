/**
 * Location service for training plan generation
 * Provides user location and city information for AI to suggest appropriate training locations
 */

import { getCurrentLocation } from '../../lib/location/locationUtils';

export interface LocationInfo {
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
  country?: string;
}

/**
 * Get user's current location and reverse geocode to get city/region info
 * Used for training plan generation to suggest appropriate training locations
 */
export const getLocationForPlanGeneration = async (): Promise<LocationInfo | null> => {
  try {
    const coordinates = await getCurrentLocation();
    if (!coordinates) {
      console.log('[LocationForPlan] Could not get user coordinates');
      return null;
    }

    // Use Nominatim API (free) for reverse geocoding
    const reverseGeoUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coordinates.latitude}&lon=${coordinates.longitude}&addressdetails=1`;

    try {
      const response = await fetch(reverseGeoUrl, {
        headers: {
          'User-Agent': 'Yugen-RunningApp/1.0', // Required by Nominatim
        },
      });

      if (response.ok) {
        const geoData = await response.json();
        const address = geoData.address || {};

        return {
          ...coordinates,
          city: address.city || address.town || address.village || null,
          region: address.state || address.region || null,
          country: address.country || null,
        };
      } else {
        console.log('[LocationForPlan] Reverse geocoding failed, returning coordinates only');
        return coordinates;
      }
    } catch (geoError) {
      console.log(
        '[LocationForPlan] Reverse geocoding error, returning coordinates only:',
        geoError
      );
      return coordinates;
    }
  } catch (error) {
    console.error('[LocationForPlan] Error getting location for plan generation:', error);
    return null;
  }
};

/**
 * Format location info for AI prompt
 * Returns a string describing the user's location for AI context
 */
export const formatLocationForPrompt = (locationInfo: LocationInfo | null): string => {
  if (!locationInfo) {
    return '';
  }

  const { city, region, country } = locationInfo;

  if (city && region && country) {
    return `${city}, ${region}, ${country}`;
  } else if (city && country) {
    return `${city}, ${country}`;
  } else if (region && country) {
    return `${region}, ${country}`;
  } else if (country) {
    return country;
  } else {
    return 'Unknown location';
  }
};
