import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, ActivityIndicator, SafeAreaView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import { COACHES } from '../../lib/constants/coaches';
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
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify the operation succeeded by checking the profile again
      const verifyProfile = await checkProfileExists(user.id);
      
      if (!verifyProfile || !verifyProfile.hasCoach || 
          verifyProfile.profile?.coach_id !== selectedCoach) {
        console.error('Verification failed:', verifyProfile);
        throw new Error('Failed to verify coach selection. Please try again.');
      }
      
      console.log('Successfully saved coach_id:', selectedCoach);
      navigation.navigate('Onboarding', { coachId: selectedCoach });
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
          <ActivityIndicator size="large" color="#000000" />
          <Text style={{ marginTop: 16, color: '#757575' }}>
            Loading...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <View style={{ flex: 1, padding: 16 }}>
        <Text style={{ 
          fontSize: 28, 
          fontWeight: 'bold', 
          marginTop: 16, 
          marginBottom: 24,
          color: '#000000'
        }}>
          Choose your coach
        </Text>

        <ScrollView 
          style={{ marginBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {COACHES.map((coach) => (
            <TouchableOpacity
              key={coach.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                borderRadius: 6,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: selectedCoach === coach.id ? '#000000' : '#F5F5F5',
                backgroundColor: selectedCoach === coach.id ? '#F5F5F5' : 'white'
              }}
              onPress={() => setSelectedCoach(coach.id)}
            >
              <Image
                source={
                  coach.id === 'craig' ? 
                    require('../../assets/craig.jpg') : 
                  coach.id === 'thomas' ? 
                    require('../../assets/thomas.jpg') : 
                    require('../../assets/dathan.jpg')
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
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: 'bold',
                  marginBottom: 4,
                  color: '#000000'
                }}>
                  {coach.name}
                </Text>
                <Text style={{ 
                  color: '#757575',
                  lineHeight: 20
                }}>
                  {coach.personalityBlurb}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {error && (
          <Text style={{ 
            color: '#E53935', 
            marginBottom: 16, 
            textAlign: 'center' 
          }}>
            {error}
          </Text>
        )}

        <TouchableOpacity
          style={{
            backgroundColor: '#000000',
            paddingVertical: 16,
            borderRadius: 6,
            alignItems: 'center',
            opacity: selectedCoach ? 1 : 0.5
          }}
          onPress={handleCoachSelect}
          disabled={!selectedCoach || loading}
        >
          {loading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={{ color: 'white', fontWeight: '500', fontSize: 16 }}>
              Continue with Coach
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
} 