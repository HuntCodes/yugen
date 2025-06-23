import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import useRunTracking from '../../hooks/useRunTracking';
import TeammateVoiceCoach from '../../components/run/TeammateVoiceCoach';
import * as Location from 'expo-location';

// TODO: adjust import path for map library peer types if needed

type Props = NativeStackScreenProps<RootStackParamList, 'GuidedRun'>;

export default function GuidedRunScreen({ navigation, route }: Props) {
  const { sessionId, runDetails } = route.params || {};
  const [hasEnded, setHasEnded] = useState(false);
  const [userRegion, setUserRegion] = useState<{ latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null>(null);
  const {
    startTracking,
    stopTracking,
    distanceM,
    durationS,
    coords,
    voiceState,
    setVoiceState,
  } = useRunTracking();

  // Start tracking on mount, stop on unmount
  useEffect(() => {
    startTracking();
    return () => {
      stopTracking();
    };
  }, []);

  // Fetch user location once on mount to avoid map jumping
  useEffect(() => {
    const getLoc = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({});
        setUserRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        });
      } catch (err) {
        console.warn('[GuidedRunScreen] Location error', err);
      }
    };
    getLoc();
  }, []);

  const handleEndRun = () => {
    setHasEnded(true);
    // Allow time for congratulatory message (~5s in TeammateVoiceCoach) plus buffer
    setTimeout(() => {
      stopTracking();
      navigation.replace('GuidedRunSummary', {
        sessionId,
        distanceM,
        durationS,
        coords,
      });
    }, 7000); // 7-second delay ensures voice finishes before navigating
  };

  const fallbackRegion = {
    latitude: 37.7749,
    longitude: -122.4194,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  const mapRegion = userRegion
    ? userRegion
    : coords.length
    ? {
        latitude: coords[coords.length - 1].latitude,
        longitude: coords[coords.length - 1].longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }
    : fallbackRegion;

  const distanceKm = (distanceM / 1000).toFixed(2);
  const minutes = Math.floor(durationS / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(durationS % 60)
    .toString()
    .padStart(2, '0');

  return (
    <View className="flex-1 bg-white">
      <TeammateVoiceCoach
        distanceKm={distanceM / 1000}
        hasStarted={coords.length > 0}
        hasEnded={hasEnded}
        voiceState={voiceState}
        onVoiceStateChange={setVoiceState}
        runDetails={runDetails}
      />
      <MapView style={{ flex: 1 }} region={mapRegion} showsUserLocation followsUserLocation>
        {coords.length > 0 && <Polyline coordinates={coords} strokeWidth={4} strokeColor="#ff0000" />}
        {coords.length > 0 && (
          <Marker coordinate={coords[0]} title="Start" />
        )}
      </MapView>
      {/* HUD overlay */}
      <View className="absolute top-24 left-4 right-4 bg-white/90 rounded-xl p-6 flex-row justify-between items-center">
        <Text className="text-2xl font-bold text-black">{distanceKm} km</Text>
        <Text className="text-2xl font-bold text-black">
          {minutes}:{seconds}
        </Text>
      </View>
      <TouchableOpacity
        onPress={hasEnded ? undefined : handleEndRun}
        disabled={hasEnded}
        className={`absolute bottom-12 self-center px-8 py-4 rounded-full ${
          hasEnded ? 'bg-gray-400' : 'bg-red-600'
        }`}>
        <Text className="text-white text-lg font-bold">
          {hasEnded ? 'Ending...' : 'End Run'}
        </Text>
      </TouchableOpacity>
    </View>
  );
} 