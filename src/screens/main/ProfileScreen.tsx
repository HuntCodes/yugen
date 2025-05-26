import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, ScrollView, Alert, Image, ActivityIndicator } from 'react-native';
import { Text } from '../../components/ui/StyledText';
import { Screen } from '../../components/ui/Screen';
import { useAuth } from '../../context/AuthContext';
import { fetchProfile, updateProfile } from '../../services/profile/profileService';
import { COACHES } from '../../lib/constants/coaches';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { LinearGradient } from 'expo-linear-gradient';
import { MinimalSpinner } from '../../components/ui/MinimalSpinner';

// Helper function to get coach images (moved outside component for clarity)
function getCoachImage(coachId: string) {
  switch(coachId) {
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
            const coachData = COACHES.find(c => c.id === profileData.coach_id);
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
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', onPress: handleSignOut, style: 'destructive' }
      ]
    );
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
          <View className="rounded-lg mt-4 mb-8 overflow-hidden shadow-sm"> 
            <LinearGradient
              colors={['#a587e4', '#38418D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View className="p-6">
                <View className="flex-row items-center mb-4">
                  <View className="w-20 h-20 rounded-full bg-white/20 items-center justify-center mr-4">
                    <Text className="text-white text-3xl font-bold">
                      {profile?.nickname?.charAt(0) || profile?.email?.charAt(0) || 'J'}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-white text-2xl font-bold">{profile?.nickname || profile?.email?.split('@')[0] || 'User'}</Text>
                    <Text className="text-white/80">{profile?.email || session?.user?.email}</Text>
                  </View>
                </View>
                <Text className="text-white/90">On member {formatJoinDate(joinDate)}</Text>
              </View>
            </LinearGradient>
          </View>

          {coach && (
            <View className="p-4 bg-[#FBF7F6] rounded-lg mb-8">
              <Text className="font-bold mb-2">Your Coach</Text>
              <View className="flex-row items-center">
                {coach.image ? (
                  <Image 
                    source={getCoachImage(coach.id)}
                    className="w-12 h-12 rounded-full mr-3"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-12 h-12 rounded-full bg-gray-300 mr-3" />
                )}
                <View>
                  <Text className="font-medium">{coach.name}</Text>
                  <Text className="text-sm text-gray-500">{coach.philosophy}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Profile Section */}
          <View className="bg-[#FBF7F6] rounded-lg mb-4">
            {/* Collapsible Profile Header */}
            <TouchableOpacity
              className="flex-row items-center justify-between p-4 border-b border-gray-200 bg-white"
              onPress={navigateToEditProfile}
            >
              <Text className="font-semibold text-base">Profile</Text>
              <Text className="text-gray-400 text-lg">›</Text>
            </TouchableOpacity>
          </View>

          {/* Settings Section */}
          <View className="bg-[#FBF7F6] rounded-lg mb-4">
            <TouchableOpacity
              className="flex-row items-center justify-between p-4 border-b border-gray-200 bg-white"
              onPress={() => {
                // TODO: Navigate to settings screen
                Alert.alert('Settings', 'Settings screen coming soon!');
              }}
            >
              <Text className="font-semibold text-base">Settings</Text>
              <Text className="text-gray-400 text-lg">›</Text>
            </TouchableOpacity>
          </View>

          {/* Feedback Section */}
          <View className="bg-[#FBF7F6] rounded-lg mb-8">
            <TouchableOpacity
              className="flex-row items-center justify-between p-4 bg-white"
              onPress={navigateToFeedback}
            >
              <Text className="font-semibold text-base">Feedback</Text>
              <Text className="text-gray-400 text-lg">›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out button fixed at bottom */}
        <View className="pb-8 pt-4">
          <TouchableOpacity
            className="border border-gray-300 py-3 rounded-full"
            onPress={confirmSignOut}
          >
            <Text className="text-center font-medium">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Screen>
  );
} 