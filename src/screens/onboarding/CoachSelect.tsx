import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';

import { MinimalSpinner } from '../../components/ui/MinimalSpinner';
import { COACHES } from '../../lib/constants/coaches';
import { supabase } from '../../lib/supabase';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { checkProfileExists, createProfile, updateCoachSelection } from '../../services/profile';

type CoachSelectNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CoachSelect'>;

export function CoachSelect() {
  const [selectedCoach, setSelectedCoach] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [profileExists, setProfileExists] = useState(false);
  const navigation = useNavigation<CoachSelectNavigationProp>();

  // Check if profile exists on component mount
  useEffect(() => {
    const initializeProfile = async () => {
      try {
        setInitialLoading(true);
        // Use v1 method to get the current user
        const user = supabase.auth.user();

        if (!user) {
          console.error('No authenticated user');
          setInitialLoading(false);
          return;
        }

        // Check if profile exists using profile service
        const profileData = await checkProfileExists(user.id);

        if (profileData?.exists) {
          setProfileExists(true);
          // If a coach is already selected, use it
          if (profileData.hasCoach && profileData.profile?.coach_id) {
            setSelectedCoach(profileData.profile.coach_id);
          }
        } else {
          setProfileExists(false);
        }
      } catch (err) {
        console.error('Error checking profile:', err);
      } finally {
        setInitialLoading(false);
      }
    };

    initializeProfile();
  }, []);

  const handleCoachSelect = async () => {
    if (!selectedCoach) {
      setError('Please select a coach to continue');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use v1 method to get the current user
      const user = supabase.auth.user();

      if (!user) throw new Error('User not authenticated');

      // If profile doesn't exist, create it first with the coach_id
      if (!profileExists) {
        console.log('Creating new profile with coach_id:', selectedCoach);
        await createProfile(user.id, user.email || '', selectedCoach);
      } else {
        // Profile exists, just update the coach_id
        console.log('Updating existing profile with coach_id:', selectedCoach);
        await updateCoachSelection(user.id, selectedCoach);
      }

      // Wait for Supabase to complete the operation
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Verify the operation succeeded by checking the profile again
      const verifyProfile = await checkProfileExists(user.id);

      if (
        !verifyProfile ||
        !verifyProfile.hasCoach ||
        verifyProfile.profile?.coach_id !== selectedCoach
      ) {
        console.error('Verification failed:', verifyProfile);
        throw new Error('Failed to verify coach selection. Please try again.');
      }

      console.log('Successfully saved coach_id:', selectedCoach);
      navigation.navigate('VoiceOnboarding', { coachId: selectedCoach });
    } catch (err: any) {
      console.error('Coach selection error:', err);
      setError(err.message || 'Failed to select coach. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // If initial loading, show loading indicator
  if (initialLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <MinimalSpinner size={48} color="#000000" thickness={3} />
          <Text style={{ marginTop: 16, color: '#757575' }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <View style={{ flex: 1, padding: 16 }}>
        {/* Back arrow */}
        <TouchableOpacity
          style={{ position: 'absolute', top: 8, left: 16, zIndex: 10 }}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('OACInfo');
            }
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>←</Text>
        </TouchableOpacity>

        <Text
          style={{
            fontSize: 28,
            fontWeight: 'bold',
            marginTop: 30,
            marginBottom: 24,
            color: '#000000',
          }}>
          Choose your team
        </Text>

        <ScrollView style={{ marginBottom: 24 }} showsVerticalScrollIndicator={false}>
          {COACHES.map((coach) => (
            <View
              key={coach.id}
              style={{
                marginBottom: 16,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: selectedCoach === coach.id ? '#000000' : '#F5F5F5',
                backgroundColor: selectedCoach === coach.id ? '#F5F5F5' : 'white',
                padding: 16,
              }}
            >
              {/* Card row (image + info) */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center' }}
                onPress={() => setSelectedCoach(coach.id)}
              >
                <Image
                  source={
                    coach.id === 'craig'
                      ? require('../../assets/craig.jpg')
                      : coach.id === 'thomas'
                        ? require('../../assets/thomas.jpg')
                        : require('../../assets/dathan.jpg')
                  }
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    marginRight: 16,
                    borderWidth: 1,
                    borderColor: '#F5F5F5',
                  }}
                />
                <View style={{ flex: 1 }}>
                  {/* Region label */}
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: 'bold',
                      color: '#5D5D5D',
                      marginBottom: 4,
                    }}
                  >
                    {coach.id === 'craig'
                      ? 'OAC Oceania'
                      : coach.id === 'thomas'
                        ? 'OAC Europe'
                        : 'OAC Global'}
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      marginBottom: 2,
                      color: '#000000',
                    }}
                  >
                    {coach.name}
                  </Text>
                  <Text
                    style={{
                      color: '#757575',
                      lineHeight: 20,
                    }}
                  >
                    {coach.personalityBlurb}
                  </Text>
                </View>
              </TouchableOpacity>

              {selectedCoach === coach.id && (
                <TouchableOpacity
                  style={{
                    alignSelf: 'stretch',
                    marginTop: 12,
                    paddingVertical: 12,
                    borderRadius: 32,
                    borderWidth: 1,
                    borderColor: '#000000',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() => {
                    if (coach.id === 'craig') {
                      navigation.navigate('OACOceania');
                    } else if (coach.id === 'thomas') {
                      navigation.navigate('OACEurope');
                    } else {
                      navigation.navigate('OACGlobal');
                    }
                  }}
                >
                  <Text style={{ color: '#000000', fontWeight: '500' }}>Learn More</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>

        {error && (
          <Text
            style={{
              color: '#E53935',
              marginBottom: 16,
              textAlign: 'center',
            }}>
            {error}
          </Text>
        )}

        <TouchableOpacity
          style={{
            backgroundColor: '#000000',
            paddingVertical: 16,
            borderRadius: 999,
            alignItems: 'center',
            opacity: selectedCoach ? 1 : 0.5,
          }}
          onPress={handleCoachSelect}
          disabled={!selectedCoach || loading}>
          {loading ? (
            <MinimalSpinner size={20} color="#FFFFFF" thickness={2} />
          ) : (
            <Text style={{ color: 'white', fontWeight: '500', fontSize: 16 }}>
              Join the team
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
