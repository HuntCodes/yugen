import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { saveGuidedRun } from '../../services/run';
import { calculateAveragePace, formatPace, calculateSplits } from '../../services/run';
import { supabase } from '../../lib/supabase';

// TODO: Accept metrics via route params or fetch from context

type Props = NativeStackScreenProps<RootStackParamList, 'GuidedRunSummary'>;

export default function GuidedRunSummaryScreen({ navigation, route }: Props) {
  const {
    sessionId,
    distanceM = 0,
    durationS = 0,
    coords = [],
  } = route.params || {};

  const [saving, setSaving] = useState(false);

  const distanceKm = (distanceM / 1000).toFixed(2);
  const minutes = Math.floor(durationS / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(durationS % 60)
    .toString()
    .padStart(2, '0');
  const durationStr = `${minutes}:${seconds}`;

  // Calculate pace and splits
  const avgPace = calculateAveragePace(distanceM, durationS);
  const splits = calculateSplits(coords);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const user = supabase.auth.user();
      if (!user) {
        Alert.alert('Not signed in', 'Please sign in to save your run.');
        return;
      }

      await saveGuidedRun({
        user_id: user.id,
        training_plan_id: sessionId,
        distance_m: distanceM,
        duration_s: durationS,
        coords,
        completed_at: new Date().toISOString(),
      });

      navigation.popToTop();
    } catch (err) {
      console.error('[GuidedRunSummary] Failed to save run:', err);
      Alert.alert('Save failed', 'Unable to save run. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    navigation.popToTop();
  };

  const initialRegion = coords && coords.length
    ? {
        latitude: coords[0].latitude,
        longitude: coords[0].longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }
    : undefined;

  return (
    <View className="flex-1 bg-white">
      <MapView style={{ flex: 1 }} initialRegion={initialRegion}>
        {coords && coords.length > 0 && (
          <Polyline coordinates={coords} strokeWidth={4} strokeColor="#ff0000" />
        )}
        {coords && coords.length > 0 && (
          <Marker coordinate={coords[0]} title="Start" />
        )}
        {coords && coords.length > 1 && (
          <Marker coordinate={coords[coords.length - 1]} title="Finish" />
        )}
      </MapView>

      <View className="p-6">
        <Text className="text-2xl font-bold mb-4">Run Summary</Text>
        
        {/* Main stats */}
        <View className="mb-6">
          <Text className="mb-2 text-lg font-semibold">Distance: <Text className="font-bold">{distanceKm} km</Text></Text>
          <Text className="mb-2 text-lg font-semibold">Time: <Text className="font-bold">{durationStr}</Text></Text>
          <Text className="mb-2 text-lg font-semibold">Avg Pace: <Text className="font-bold">{formatPace(avgPace)}/km</Text></Text>
        </View>

        {/* Splits section */}
        {splits.length > 0 && (
          <View className="mb-4">
            <Text className="text-lg font-semibold mb-2">Splits</Text>
            {splits.map((split, index) => (
              <View key={index} className="flex-row justify-between py-1">
                <Text className="text-sm">
                  {split.distance_m >= 1000 
                    ? `Km ${split.split_km}` 
                    : `Final ${(split.distance_m / 1000).toFixed(2)}km`
                  }
                </Text>
                <Text className="text-sm">{formatPace(split.pace_s)}</Text>
              </View>
            ))}
          </View>
        )}

        <View className="flex-row justify-between">
          <TouchableOpacity
            onPress={handleDiscard}
            className="flex-1 mr-2 bg-gray-300 px-6 py-4 rounded-full items-center">
            <Text className="font-semibold text-lg">Discard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            disabled={saving}
            onPress={handleSave}
            className="flex-1 ml-2 bg-black px-6 py-4 rounded-full items-center flex-row justify-center">
            {saving && <ActivityIndicator color="#ffffff" style={{ marginRight: 8 }} />}
            <Text className="text-white font-bold text-lg">
              {saving ? 'Saving...' : 'Save Run'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
} 