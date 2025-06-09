import { useState, useEffect, useCallback } from 'react';

import {
  getCurrentLocation,
  requestLocationPermission,
  checkLocationPermission,
} from '../lib/location/locationUtils';
import { getWeatherData, WeatherForecast } from '../services/weather/weatherService';

export function useWeather() {
  const [weatherData, setWeatherData] = useState<WeatherForecast | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Check location permission on mount
  useEffect(() => {
    checkLocationPermission().then(setHasLocationPermission);
  }, []);

  // Request location permission
  const requestPermission = useCallback(async () => {
    setIsLoading(true);
    try {
      const granted = await requestLocationPermission();
      setHasLocationPermission(granted);
      if (granted) {
        await fetchWeatherData();
      } else {
        setError('Location permission is required for weather updates');
      }
    } catch (err) {
      setError('Failed to request location permission');
      console.error('Error requesting location permission:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch weather data
  const fetchWeatherData = useCallback(async () => {
    if (!hasLocationPermission) {
      setError('Location permission not granted');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const currentLocation = await getCurrentLocation();
      if (!currentLocation) {
        setError('Unable to get current location');
        return;
      }

      setLocation(currentLocation);
      const weather = await getWeatherData(currentLocation.latitude, currentLocation.longitude);

      if (!weather) {
        setError('Unable to fetch weather data');
        return;
      }

      setWeatherData(weather);
    } catch (err) {
      setError('Failed to fetch weather data');
      console.error('Error fetching weather:', err);
    } finally {
      setIsLoading(false);
    }
  }, [hasLocationPermission]);

  // Auto-fetch weather when permission is granted
  useEffect(() => {
    if (hasLocationPermission === true) {
      fetchWeatherData();
    }
  }, [hasLocationPermission, fetchWeatherData]);

  // Refresh weather data
  const refreshWeather = useCallback(() => {
    if (hasLocationPermission) {
      fetchWeatherData();
    } else {
      requestPermission();
    }
  }, [hasLocationPermission, fetchWeatherData, requestPermission]);

  return {
    weatherData,
    isLoading,
    error,
    hasLocationPermission,
    location,
    requestPermission,
    refreshWeather,
  };
}
