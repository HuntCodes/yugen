import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, SafeAreaView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import { colors } from '../../styles/colors';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';
import { Feather } from '@expo/vector-icons';
import { getSuggestedShoe } from '../../lib/utils/training/shoeRecommendations';

// Local asset (add an actual jpg in assets/coaches/yared.jpg)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const YaredImg = require('../../assets/yared.jpg');

// Simple setup screen allowing user to review details and start the run

type Props = NativeStackScreenProps<RootStackParamList, 'GuidedRunSetup'>;

export default function GuidedRunSetupScreen({ navigation, route }: Props) {
  const { sessionId } = route.params || {};

  const [loading, setLoading] = useState<boolean>(!!sessionId);
  const [session, setSession] = useState<any>(null);
  const [userRegion, setUserRegion] = useState<{ latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      if (!sessionId) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('training_plans')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        console.error('[GuidedRunSetup] Error fetching session:', error);
      }
      setSession(data);
      setLoading(false);
    };

    fetchSession();
  }, [sessionId]);

  // Fetch user location once for mini map
  useEffect(() => {
    const getLoc = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({});
        setUserRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      } catch (err) {
        console.warn('[GuidedRunSetup] Location error', err);
      }
    };
    getLoc();
  }, []);

  const handleStart = () => {
    navigation.replace('GuidedRun', { sessionId });
  };

  const PlanItem = ({ label, value }: { label: string; value: string | number | undefined }) => {
    if (!value) return null;
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ color: colors.text.secondary, fontWeight: '500' }}>{label}</Text>
        <Text style={{ color: colors.text.primary, fontWeight: '600' }}>{value}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          {/* simple back arrow */}
          <Text style={{ fontSize: 18 }}>{'←'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={{ flex: 1, padding: 24 }}>
          {/* Teammate selection */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 8 }}>Choose your teammate</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              style={{
                borderWidth: 1,
                borderColor: '#E5E5E5',
                borderRadius: 12,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              {/* Avatar */}
              <Image
                source={YaredImg}
                style={{ width: 80, height: 80, borderRadius: 40, marginRight: 16 }}
                resizeMode="cover"
              />

              {/* Text block */}
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text.primary, marginBottom: 4 }}>
                  Yared Nuguse
                </Text>
                <Text style={{ fontSize: 12, color: colors.text.secondary }}>
                  "Running quickly becomes people's whole life, but it's never been mine. That's why I'm so good."
                </Text>
              </View>

              {/* Chevron column */}
              <View style={{ width: 32, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="chevron-down" size={24} color="#C4C4C4" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Today's Run Plan */}
          {session && (
            <View style={{ backgroundColor: '#F0ECEB', padding: 16, borderRadius: 12, marginBottom: 24 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12 }}>Today's Run Plan</Text>
              <PlanItem label="Distance" value={`${session.distance} km`} />
              <PlanItem label="Time" value={`${session.time} min`} />
              <PlanItem label="Suggested Shoe" value={session.suggested_shoe || getSuggestedShoe(session.session_type)} />
              <PlanItem label="Suggested Location" value={session.suggested_location} />
              {session.notes && (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ color: colors.text.secondary, fontWeight: '500', marginBottom: 4 }}>Notes:</Text>
                  <Text style={{ color: colors.text.primary }}>{session.notes}</Text>
                </View>
              )}
            </View>
          )}

          {/* Mini map placeholder */}
          <View style={{ height: 200, borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
            <MapView
              style={{ flex: 1 }}
              initialRegion={userRegion || {
                latitude: 37.7749,
                longitude: -122.4194,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
              showsUserLocation
              pointerEvents="none"
            />
          </View>

          {/* Spacer to push button down */}
          <View style={{ flex: 1 }} />

          {/* Start Run Button */}
          <TouchableOpacity
            onPress={handleStart}
            style={{
              backgroundColor: '#000',
              paddingVertical: 18,
              borderRadius: 999,
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>Start Run</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
} 