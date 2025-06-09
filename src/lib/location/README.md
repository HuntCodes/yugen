# Location Utilities

This directory contains utility functions for handling location permissions and retrieving user location.

## Files

### locationUtils.ts
Core location utility functions for permission handling and location retrieval.

**Functions:**
- `checkLocationPermission()`: Check if location permissions are granted
- `requestLocationPermission()`: Request location permissions from the user  
- `getCurrentLocation()`: Get the user's current coordinates

## Usage

```tsx
import { checkLocationPermission, requestLocationPermission, getCurrentLocation } from '../lib/location/locationUtils';

// Check permission
const hasPermission = await checkLocationPermission();

// Request permission
const granted = await requestLocationPermission();

// Get current location
const location = await getCurrentLocation();
// Returns: { latitude: number, longitude: number } | null
```

## Dependencies

Uses `expo-location` for accessing device location services.

## Permissions

Requires the following permissions to be configured:

**iOS (Info.plist):**
- `NSLocationWhenInUseUsageDescription`

**Android (AndroidManifest.xml):**
- `android.permission.ACCESS_COARSE_LOCATION`
- `android.permission.ACCESS_FINE_LOCATION` 