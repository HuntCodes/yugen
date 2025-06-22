import { useRef, useState } from 'react';
import * as Location from 'expo-location';

interface Position {
  coords: {
    latitude: number;
    longitude: number;
  };
  timestamp: number;
}

export interface Coord {
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface VoiceCoachingState {
  hasPlayedStartMessage: boolean;
  lastKmSpoken: number;
  hasPlayedEndMessage: boolean;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371000; // metres
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function useRunTracking() {
  const [distanceM, setDistanceM] = useState(0);
  const [durationS, setDurationS] = useState(0);
  const [coords, setCoords] = useState<Coord[]>([]);
  const [voiceState, setVoiceState] = useState<VoiceCoachingState>({
    hasPlayedStartMessage: false,
    lastKmSpoken: 0,
    hasPlayedEndMessage: false,
  });
  const startTimeRef = useRef<number | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTracking = async () => {
    if (watchRef.current) return; // already tracking

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Location permission not granted');
      return;
    }

    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setDurationS(Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000));
    }, 1000);

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Highest,
        timeInterval: 3000,
        distanceInterval: 0,
        mayShowUserSettingsDialog: false,
      },
      (position: Position) => {
        const { latitude, longitude } = position.coords;
        setCoords((prev) => {
          const next = [...prev, { latitude, longitude, timestamp: position.timestamp }];
          if (next.length > 1) {
            const prevCoord = next[next.length - 2];
            const dist = haversineDistance(
              prevCoord.latitude,
              prevCoord.longitude,
              latitude,
              longitude
            );
            setDistanceM((d) => d + dist);
          }
          return next;
        });
      }
    );

    watchRef.current = subscription;
  };

  const stopTracking = () => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current as ReturnType<typeof setInterval>);
      timerRef.current = null;
    }
  };

  return {
    startTracking,
    stopTracking,
    distanceM,
    durationS,
    coords,
    voiceState,
    setVoiceState,
  };
} 