import { Feather } from '@expo/vector-icons';
import { useNavigation, CommonActions, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState, useCallback } from 'react';
import { View, TouchableOpacity, ScrollView, Alert, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MinimalSpinner } from '../../components/ui/MinimalSpinner';
import { Screen } from '../../components/ui/Screen';
import { Text } from '../../components/ui/StyledText';
import { useAuth } from '../../context/AuthContext';
import { COACHES } from '../../lib/constants/coaches';
import { fetchProfile, updateProfile } from '../../services/profile/profileService';

import type { ProfileStackParamList } from '../../navigation/ProfileNavigator';


import { colors } from '../../styles/colors';
import { Coach } from '../../types/coach';

// Helper function to get coach images (moved outside component for clarity)
function getCoachImage(coachId: string) {
  switch (coachId) {
    case 'craig':
      return require('../../assets/coaches/craig.jpg');
    case 'thomas':
      return require('../../assets/coaches/thomas.jpg');
    case 'dathan':
      return require('../../assets/coaches/dathan.jpg');
    default:
      return require('../../assets/placeholder.png'); // Provide a default placeholder
  }
}

export function ProfileScreen() {
  const { session, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [coach, setCoach] = useState<any>(null);
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const [joinDate, setJoinDate] = useState<Date | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (session?.user) {
        try {
          const profileData = await fetchProfile(session.user.id);
          setProfile(profileData);

          if (profileData?.created_at) {
            setJoinDate(new Date(profileData.created_at));
          } else if (session.user.created_at) {
            setJoinDate(new Date(session.user.created_at));
          } else {
            setJoinDate(new Date());
          }

          if (profileData?.coach_id) {
            const coachData = COACHES.find((c) => c.id === profileData.coach_id);
            setCoach(coachData || null);
          }
        } catch (error) {
          console.error('Error loading profile:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadProfile();
  }, [session]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Entry' as never }],
        })
      );
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const confirmSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', onPress: handleSignOut, style: 'destructive' },
    ]);
  };

  const navigateToEditProfile = () => {
    navigation.navigate('EditProfile');
  };

  const formatJoinDate = (date: Date | null) => {
    if (!date) return 'this year'; // Fallback text
    return `since ${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
  };

  const navigateToFeedback = () => {
    navigation.navigate('Feedback');
  };

  const navigateToNotifications = () => {
    navigation.navigate('Notifications');
  };

  if (loading) {
    return (
      <Screen style={{ backgroundColor: '#FFFFFF' }}>
        <View className="flex-1 items-center justify-center">
          <MinimalSpinner size={48} color="#000000" thickness={3} />
          <Text className="mt-2">Loading profile...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={{ backgroundColor: '#FFFFFF' }}>
      <View className="flex-1 px-6">
        {/* Main Content Area */}
        <View className="flex-1">
          {/* Purple Gradient Banner Wrapper */}
          <View className="mb-8 mt-4 overflow-hidden rounded-lg shadow-sm">
            <LinearGradient
              colors={['#9B7BFF', '#4B2ED2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}>
              <View className="p-6">
                <View className="mb-4 flex-row items-center">
                  <View className="mr-4 h-20 w-20 items-center justify-center rounded-full bg-white/20">
                    <Text className="text-3xl font-bold text-white">
                      {profile?.nickname?.charAt(0) || profile?.email?.charAt(0) || 'J'}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-2xl font-bold text-white">
                      {profile?.nickname || profile?.email?.split('@')[0] || 'User'}
                    </Text>
                    <Text className="text-white/80">{profile?.email || session?.user?.email}</Text>
                  </View>
                </View>
                <Text className="text-white/90">On member {formatJoinDate(joinDate)}</Text>
              </View>
            </LinearGradient>
          </View>

          {coach && (
            <View className="mb-8 rounded-lg bg-[#FBF7F6] p-4">
              <Text className="mb-2 font-bold">Your Coach</Text>
              <View className="flex-row items-center">
                {coach.image ? (
                  <Image
                    source={getCoachImage(coach.id)}
                    className="mr-3 h-12 w-12 rounded-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="mr-3 h-12 w-12 rounded-full bg-gray-300" />
                )}
                <View>
                  <Text className="font-medium">{coach.name}</Text>
                  <Text className="text-sm text-gray-500">{coach.philosophy}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Profile Section */}
          <View className="mb-4 rounded-lg bg-[#FBF7F6]">
            <TouchableOpacity
              className="flex-row items-center justify-between border-b border-gray-200 bg-white p-4"
              onPress={navigateToEditProfile}>
              <Text className="text-base font-semibold">Profile</Text>
              <Text className="text-lg text-gray-400">›</Text>
            </TouchableOpacity>
          </View>

          {/* Notifications Section */}
          <View className="mb-4 rounded-lg bg-[#FBF7F6]">
            <TouchableOpacity
              className="flex-row items-center justify-between border-b border-gray-200 bg-white p-4"
              onPress={navigateToNotifications}>
              <Text className="text-base font-semibold">Notifications</Text>
              <Text className="text-lg text-gray-400">›</Text>
            </TouchableOpacity>
          </View>

          {/* Settings Section */}
          <View className="mb-4 rounded-lg bg-[#FBF7F6]">
            <TouchableOpacity
              className="flex-row items-center justify-between border-b border-gray-200 bg-white p-4"
              onPress={() => {
                // TODO: Navigate to settings screen
                Alert.alert('Settings', 'Settings screen coming soon!');
              }}>
              <Text className="text-base font-semibold">Settings</Text>
              <Text className="text-lg text-gray-400">›</Text>
            </TouchableOpacity>
          </View>

          {/* Feedback Section */}
          <View className="mb-8 rounded-lg bg-[#FBF7F6]">
            <TouchableOpacity
              className="flex-row items-center justify-between bg-white p-4"
              onPress={navigateToFeedback}>
              <Text className="text-base font-semibold">Feedback</Text>
              <Text className="text-lg text-gray-400">›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out button fixed at bottom */}
        <View className="pb-8 pt-4">
          <TouchableOpacity
            className="rounded-full border border-gray-300 py-3"
            onPress={confirmSignOut}>
            <Text className="text-center font-medium">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Screen>
  );
}
