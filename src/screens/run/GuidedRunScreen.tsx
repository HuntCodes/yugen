import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import useRunTracking from '../../hooks/useRunTracking';
import TeammateVoiceCoach from '../../components/run/TeammateVoiceCoach';

// TODO: adjust import path for map library peer types if needed

type Props = NativeStackScreenProps<RootStackParamList, 'GuidedRun'>;

export default function GuidedRunScreen({ navigation, route }: Props) {
  const { sessionId } = route.params || {};
  const [hasEnded, setHasEnded] = useState(false);
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

  const handleEndRun = () => {
    setHasEnded(true);
    // Give a moment for end message to play
    setTimeout(() => {
      stopTracking();
      navigation.replace('GuidedRunSummary', {
        sessionId,
        distanceM,
        durationS,
        coords,
      });
    }, 3000); // 3 second delay for end message
  };

  const initialRegion = coords.length
    ? {
        latitude: coords[coords.length - 1].latitude,
        longitude: coords[coords.length - 1].longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : {
        latitude: 37.78825,
        longitude: -122.4324,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

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
      />
      <MapView style={{ flex: 1 }} initialRegion={initialRegion} showsUserLocation followsUserLocation>
        {coords.length > 0 && <Polyline coordinates={coords} strokeWidth={4} strokeColor="#ff0000" />}
        {coords.length > 0 && (
          <Marker coordinate={coords[0]} title="Start" />
        )}
      </MapView>
      {/* HUD overlay */}
      <View className="absolute top-12 left-4 right-4 bg-white/80 rounded-lg p-4 flex-row justify-between">
        <Text className="font-semibold">{distanceKm} km</Text>
        <Text className="font-semibold">
          {minutes}:{seconds}
        </Text>
      </View>
      <TouchableOpacity
        onPress={hasEnded ? undefined : handleEndRun}
        disabled={hasEnded}
        className={`absolute bottom-12 self-center px-6 py-3 rounded-full ${
          hasEnded ? 'bg-gray-400' : 'bg-red-600'
        }`}>
        <Text className="text-white font-semibold">
          {hasEnded ? 'Ending...' : 'End Run'}
        </Text>
      </TouchableOpacity>
    </View>
  );
} 