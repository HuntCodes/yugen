# Weather Components

This directory contains weather-related UI components for displaying weather forecast information.

## Components

### WeatherForecast.tsx
A comprehensive weather component that displays current weather and hourly forecast.

**Features:**
- Current weather with temperature, description, wind speed, and humidity
- Horizontal scrollable hourly forecast (12 hours)
- Clean Feather icons for weather conditions (consistent with app design)
- Refresh functionality with loading states
- Responsive layout with proper spacing

**Props:**
- `current`: Current weather data
- `hourly`: Array of hourly weather data  
- `onRefresh`: Function to refresh weather data
- `isLoading`: Boolean indicating loading state

## Usage

```tsx
import { WeatherForecast } from '../../components/weather/WeatherForecast';

<WeatherForecast
  current={weatherData.current}
  hourly={weatherData.hourly}
  onRefresh={refreshWeather}
  isLoading={weatherLoading}
/>
```

## Weather Icons

Uses Feather icons for consistent visual design:
- `sun` - Clear/sunny weather
- `cloud` - Cloudy/overcast/fog
- `cloud-drizzle` - Light rain/drizzle
- `cloud-rain` - Regular rain and showers
- `cloud-snow` - Snow conditions
- `cloud-lightning` - Thunderstorms

## Data Source

Weather data is provided by the Open-Meteo API through the weather service (`src/services/weather/weatherService.ts`). 