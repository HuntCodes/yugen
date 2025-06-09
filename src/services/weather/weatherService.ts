/**
 * Weather service using Open-Meteo API
 */

export interface WeatherData {
  temperature: number;
  weatherCode: number;
  windSpeed: number;
  humidity: number;
  time: string;
}

export interface WeatherForecast {
  current: WeatherData;
  hourly: WeatherData[];
}

/**
 * Get weather description from weather code
 * Based on WMO Weather interpretation codes
 */
export const getWeatherDescription = (code: number): string => {
  const weatherCodes: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
  };

  return weatherCodes[code] || 'Unknown';
};

/**
 * Get Feather icon name from weather code
 * Returns icon name to be used with Feather component
 */
export const getWeatherIcon = (code: number): string => {
  if (code === 0) return 'sun'; // Clear sky
  if (code >= 1 && code <= 3) return 'cloud'; // Partly cloudy to overcast
  if (code >= 45 && code <= 48) return 'cloud'; // Fog (using cloud as base)
  if (code >= 51 && code <= 57) return 'cloud-drizzle'; // Drizzle variations
  if (code >= 61 && code <= 67) return 'cloud-rain'; // Rain variations
  if (code >= 71 && code <= 77) return 'cloud-snow'; // Snow variations
  if (code >= 80 && code <= 82) return 'cloud-rain'; // Rain showers
  if (code >= 85 && code <= 86) return 'cloud-snow'; // Snow showers
  if (code >= 95 && code <= 99) return 'cloud-lightning'; // Thunderstorms
  return 'cloud'; // Default fallback
};

/**
 * Fetch weather data from Open-Meteo API
 */
export const getWeatherData = async (
  latitude: number,
  longitude: number
): Promise<WeatherForecast | null> => {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&hourly=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&timezone=auto&forecast_days=7`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();

    // Parse current weather
    const current: WeatherData = {
      temperature: Math.round(data.current.temperature_2m),
      weatherCode: data.current.weather_code,
      windSpeed: Math.round(data.current.wind_speed_10m),
      humidity: data.current.relative_humidity_2m,
      time: data.current.time,
    };

    // Parse hourly forecast (up to 7 days)
    const hourly: WeatherData[] = data.hourly.time.map((time: string, index: number) => ({
      temperature: Math.round(data.hourly.temperature_2m[index]),
      weatherCode: data.hourly.weather_code[index],
      windSpeed: Math.round(data.hourly.wind_speed_10m[index]),
      humidity: data.hourly.relative_humidity_2m[index],
      time,
    }));

    return {
      current,
      hourly,
    };
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return null;
  }
};
