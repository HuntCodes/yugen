# Notification Services

This directory contains services for managing push notifications in the Yugen app.

## Overview

The notification system provides daily motivational messages from the user's selected coach. These notifications are sent every morning at 8 AM and include:

- Personalized greeting from the user's coach
- Today's workout details (type, distance, time)
- Weather-based motivation message
- Coach-specific motivational closing

## Files

- `notificationService.ts`: Core notification functions
- `index.ts`: Exports for clean imports
- `__tests__/notificationMessages.test.ts`: Test scenarios for message generation
- `testRunner.ts`: Standalone test runner
- `README.md`: This documentation

## Features

### Daily Morning Notifications
- Scheduled at 8:00 AM local time
- Personalized content based on:
  - User's selected coach
  - Today's training plan
  - Local weather conditions
  - Coach communication style

### Permission Management
- Requests notification permissions on first use
- Handles permission denial gracefully
- Provides settings to enable/disable notifications

### Coach Personalities
- **Craig**: "Rise and shine!" - Direct, high-energy motivation
- **Thomas**: "Good morning, athlete" - Technical, focused on form
- **Dathan**: "Morning, runner" - Strategic, data-driven approach

### Weather Integration
- Uses location services to get local weather
- Adapts message based on conditions:
  - Hot weather: Reminds to stay hydrated
  - Cold weather: "Perfect running weather"
  - Rain: "Embrace the elements"
  - Pleasant: "Ideal conditions"

## Testing

### Automated Testing
Run the notification message tests to verify different scenarios:

```bash
# Run all notification tests
npm run test:notifications

# Or run directly with tsx
npx tsx src/services/notifications/testRunner.ts
```

### Test Scenarios
The test suite covers:

1. **Different Workouts**:
   - Easy runs
   - Tempo runs
   - Interval training
   - Long runs
   - Rest days
   - No workout scheduled

2. **Different Coaches**:
   - Craig (motivational, high energy)
   - Thomas (technical, precise)
   - Dathan (strategic, smart)

3. **Different Weather**:
   - Hot weather (>25°C)
   - Cold weather (<5°C)
   - Rainy conditions
   - Perfect conditions
   - No location/weather data

4. **Edge Cases**:
   - Missing workout data
   - Weather service failures
   - Invalid coach IDs
   - Location permission denied

### Sample Messages

**Craig + Easy Run + Perfect Weather:**
> "Rise and shine! Today you've got an easy 6km run (about 36 minutes). It's 18°C with partly cloudy - ideal conditions for your run, so let's get going. Let's get after it! Hit me up if you need any adjustments or advice."

**Thomas + Intervals + Hot Weather:**
> "Good morning, athlete! Today you've got 7km of intervals (35 minutes) - let's get fast. It's warm at 29°C with clear sky, so stay hydrated out there, so let's get going. Remember, every step counts. Let me know if you want to make any changes or need guidance."

**Dathan + Rest Day + Rainy:**
> "Morning, runner! Today is a rest day - recovery is just as important as the hard work. There's some rain with moderate rain - embrace the elements, so let's get going. Smart training beats hard training. Message me if you need any tweaks or have questions."

## Usage

### In Components
```typescript
import { useNotifications } from '../../hooks/notifications/useNotifications';

const MyComponent = () => {
  const {
    permissionsGranted,
    isScheduled,
    loading,
    setupNotifications,
    disableNotifications
  } = useNotifications();

  const handleEnable = async () => {
    const success = await setupNotifications();
    if (success) {
      console.log('Notifications enabled!');
    }
  };

  return (
    <button onPress={handleEnable} disabled={loading}>
      {isScheduled ? 'Disable' : 'Enable'} Notifications
    </button>
  );
};
```

### Direct Service Usage
```typescript
import { scheduleDailyMorningNotification, generateCoachMessage } from '../services/notifications';

// Schedule notifications
const success = await scheduleDailyMorningNotification({
  userId: 'user123',
  coachId: 'craig',
  latitude: 40.7128,
  longitude: -74.0060
});

// Generate a test message
const message = await generateCoachMessage('craig', {
  sessionType: 'Easy Run',
  distance: 5,
  time: 30,
  notes: 'Conversational pace'
}, 40.7128, -74.0060);
```

## Configuration

### Notification Timing
- Default: 8:00 AM local time
- Recurring: Daily
- Trigger: Based on local timezone

### Message Structure
1. **Greeting**: Coach-specific greeting style
2. **Workout**: Today's training details
3. **Weather**: Location-based weather message
4. **Motivation**: Coach-specific closing

### Permissions Required
- **Notifications**: To send daily messages
- **Location** (optional): For weather-based messages

## Error Handling

The system gracefully handles:
- Permission denials
- Weather service failures
- Missing workout data
- Invalid coach configurations
- Network connectivity issues

## Future Enhancements

Potential improvements:
- Custom notification timing
- Multiple daily notifications
- Workout reminders
- Post-workout check-ins
- Gear recommendations based on weather
- Weekly training summaries 