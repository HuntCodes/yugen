# Weather Service

This directory contains services for fetching and processing weather data using the Open-Meteo API.

## Files

### weatherService.ts
Core weather service that fetches forecast data from Open-Meteo API.

**Interfaces:**
- `WeatherData`: Individual weather data point with temperature, weather code, wind speed, humidity, and time
- `WeatherForecast`: Complete forecast with current and hourly data

**Functions:**
- `getWeatherData(latitude, longitude)`: Fetch weather forecast for given coordinates
- `getWeatherDescription(code)`: Convert WMO weather code to human-readable description
- `getWeatherIcon(code)`: Get appropriate Feather icon name for weather code

## API Integration

Uses the Open-Meteo API (https://api.open-meteo.com/v1/forecast) with the following parameters:
- Current weather: temperature, weather code, wind speed, humidity
- Hourly forecast: 24-hour forecast with same parameters
- Timezone: Automatic based on coordinates

## Weather Icon Mapping

Maps WMO weather interpretation codes to Feather icon names:
- **0**: `sun` (Clear sky)
- **1-3**: `cloud` (Partly cloudy to overcast)
- **45-48**: `cloud` (Fog conditions)
- **51-57**: `cloud-drizzle` (Drizzle variations)
- **61-67**: `cloud-rain` (Rain variations)
- **71-77**: `cloud-snow` (Snow variations)
- **80-82**: `cloud-rain` (Rain showers)
- **85-86**: `cloud-snow` (Snow showers)
- **95-99**: `cloud-lightning` (Thunderstorms)

This provides runners with precise weather condition information crucial for training decisions.

## Usage

```tsx
import { getWeatherData, getWeatherDescription, getWeatherIcon } from '../services/weather/weatherService';

// Fetch weather
const forecast = await getWeatherData(latitude, longitude);

// Get icon for display
const iconName = getWeatherIcon(forecast.current.weatherCode);

// Get description
const description = getWeatherDescription(forecast.current.weatherCode);
```

## Weather Codes

Uses WMO Weather interpretation codes:
- 0: Clear sky ☀️
- 1-3: Partly cloudy ⛅
- 45-48: Fog 🌫️  
- 51-67: Rain 🌧️
- 71-77: Snow ❄️
- 80-82: Rain showers 🌦️
- 85-86: Snow showers 🌨️
- 95-99: Thunderstorm ⛈️

## Error Handling

Returns `null` if API request fails or data is invalid. Errors are logged to console. 