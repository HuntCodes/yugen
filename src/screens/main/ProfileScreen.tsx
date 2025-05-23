import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, ScrollView, Alert, Image, ActivityIndicator, TextInput, Platform } from 'react-native';
import { Text } from '../../components/ui/StyledText';
import { Screen } from '../../components/ui/Screen';
import { useAuth } from '../../context/AuthContext';
import { fetchProfile, updateProfile } from '../../services/profile/profileService';
import { COACHES } from '../../lib/constants/coaches';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
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
  const [isFullProfileVisible, setIsFullProfileVisible] = useState(false); // State for visibility
  // Inline edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editGoalType, setEditGoalType] = useState('');
  const [editRaceDate, setEditRaceDate] = useState<Date | null>(null);
  const [editRaceDistance, setEditRaceDistance] = useState('');
  const [editExperienceLevel, setEditExperienceLevel] = useState('');
  const [editTrainingFrequency, setEditTrainingFrequency] = useState('');
  const [editCurrentMileage, setEditCurrentMileage] = useState('');
  const [editInjuryHistory, setEditInjuryHistory] = useState('');
  const [editShoeSize, setEditShoeSize] = useState('');
  const [editClothingSize, setEditClothingSize] = useState('');
  const [editScheduleConstraints, setEditScheduleConstraints] = useState('');
  const [editUnits, setEditUnits] = useState('km');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

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

  const renderProfileItem = (label: string, value: string | number | null | undefined) => (
    <View className="py-3 border-b border-gray-200">
      <Text className="text-sm text-gray-500 mb-1">{label}</Text>
      <Text className="text-base">{value || 'Not specified'}</Text>
    </View>
  );

  const formatJoinDate = (date: Date | null) => {
    if (!date) return 'this year'; // Fallback text
    return `since ${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
  };
  
  // Format race date nicely
  const formatRaceDate = (dateString: string | null) => {
    if (!dateString) return 'Not specified';
    try {
      const date = new Date(dateString);
      // Add check for invalid date
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return 'Invalid Date Format';
    }
  };

  // Enter edit mode with current profile data
  const enterEditMode = () => {
    setEditNickname(profile?.nickname || '');
    setEditGoalType(profile?.goal_type || '');
    setEditRaceDate(profile?.race_date ? new Date(profile.race_date) : null);
    setEditRaceDistance(profile?.race_distance || '');
    setEditExperienceLevel(profile?.experience_level || '');
    setEditTrainingFrequency(profile?.current_frequency || '');
    setEditCurrentMileage(profile?.current_mileage || '');
    setEditInjuryHistory(profile?.injury_history || '');
    setEditShoeSize(profile?.shoe_size || '');
    setEditClothingSize(profile?.clothing_size || '');
    setEditScheduleConstraints(profile?.schedule_constraints || '');
    setEditUnits(profile?.units || 'km');
    setIsEditing(true);
  };

  // Handle date picker changes
  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setEditRaceDate(selectedDate);
    }
  };

  // Format Date for display
  const formatDisplayDate = (date: Date | null) => {
    if (!date) return 'No race date selected';
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Save profile updates
  const handleSaveProfile = async () => {
    if (!session?.user) return;
    setSavingProfile(true);
    try {
      const updates = {
        nickname: editNickname,
        goal_type: editGoalType,
        race_date: editRaceDate ? editRaceDate.toISOString().split('T')[0] : null,
        race_distance: editRaceDistance,
        experience_level: editExperienceLevel,
        current_frequency: editTrainingFrequency,
        current_mileage: editCurrentMileage,
        injury_history: editInjuryHistory,
        shoe_size: editShoeSize,
        clothing_size: editClothingSize,
        schedule_constraints: editScheduleConstraints,
        units: editUnits,
      };
      await updateProfile(session.user.id, updates);
      const updated = await fetchProfile(session.user.id);
      setProfile(updated);
      Alert.alert('Success', 'Profile updated successfully');
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile changes');
    } finally {
      setSavingProfile(false);
    }
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
      <ScrollView className="px-6">
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
        <View className="p-4 bg-[#FBF7F6] rounded-lg mb-8">
          <Text className="font-bold mb-4">Running Profile</Text>
          
          {/* Collapsed profile summary (show when not expanded) */}
          {!isFullProfileVisible && (
            <>
              {renderProfileItem('Nickname', profile?.nickname)}
              {renderProfileItem('Goal', profile?.goal_type)}
              {renderProfileItem('Race Date', formatRaceDate(profile?.race_date))}
              {renderProfileItem('Race Distance', profile?.race_distance)}
            </>
          )}

          {/* View Full Profile button when collapsed */}
          {!isFullProfileVisible && (
            <TouchableOpacity
              className="bg-[#F0ECEB] py-3 rounded-md mt-4 mb-2"
              onPress={() => setIsFullProfileVisible(true)}
            >
              <Text className="text-center font-medium text-gray-700">View Full Profile</Text>
            </TouchableOpacity>
          )}

          {/* Expanded static details */}
          {isFullProfileVisible && !isEditing && (
            <View>
              {/* Full profile summary now includes these fields */}
              {renderProfileItem('Nickname', profile?.nickname)}
              {renderProfileItem('Goal', profile?.goal_type)}
              {renderProfileItem('Race Date', formatRaceDate(profile?.race_date))}
              {renderProfileItem('Race Distance', profile?.race_distance)}
              {renderProfileItem('Experience Level', profile?.experience_level)}
              {renderProfileItem('Training Frequency', profile?.current_frequency)}
              {renderProfileItem('Current Weekly Mileage', profile?.current_mileage)}
              {renderProfileItem('Preferred Units', profile?.units)}
              {renderProfileItem('Injury History', profile?.injury_history)}
              {renderProfileItem('Shoe Size', profile?.shoe_size)}
              {renderProfileItem('Clothing Size', profile?.clothing_size)}
              {renderProfileItem('Schedule Constraints', profile?.schedule_constraints)}
            </View>
          )}

          {/* Inline editing form */}
          {isFullProfileVisible && isEditing && (
            <View>
              {/* Nickname */}
              <View className="mb-4">
                <Text className="text-sm font-medium mb-1">Nickname</Text>
                <TextInput
                  className="border border-gray-300 rounded-md p-2"
                  value={editNickname}
                  onChangeText={setEditNickname}
                  placeholder="Your preferred name"
                  maxLength={50}
                />
              </View>
              {/* Goal */}
              <View className="mb-4">
                <Text className="text-sm font-medium mb-1">Goal</Text>
                <TextInput
                  className="border border-gray-300 rounded-md p-2"
                  value={editGoalType}
                  onChangeText={setEditGoalType}
                  placeholder="e.g., Marathon, General Fitness"
                  maxLength={150}
                />
              </View>
              {/* Race Date */}
              <View className="mb-4">
                <Text className="text-sm font-medium mb-1">Race Date</Text>
                <TouchableOpacity
                  className="border border-gray-300 rounded-md p-3 flex-row justify-between items-center"
                  onPress={() => setShowDatePicker(!showDatePicker)}
                >
                  <Text className={editRaceDate ? 'text-black' : 'text-gray-500'}>
                    {formatDisplayDate(editRaceDate)}
                  </Text>
                  <Text className="text-blue-500">
                    {showDatePicker ? 'Done' : editRaceDate ? 'Change' : 'Select Date'}
                  </Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={editRaceDate || new Date()}
                    mode="date"
                    display="spinner"
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                  />
                )}
              </View>
              {/* Race Distance */}
              <View className="mb-4">
                <Text className="text-sm font-medium mb-1">Race Distance</Text>
                <TextInput
                  className="border border-gray-300 rounded-md p-2"
                  value={editRaceDistance}
                  onChangeText={setEditRaceDistance}
                  placeholder="e.g., 5K, 10K, Marathon"
                  maxLength={50}
                />
              </View>
              {/* Experience Level */}
              <View className="mb-4">
                <Text className="text-sm font-medium mb-1">Experience Level</Text>
                <TextInput
                  className="border border-gray-300 rounded-md p-2"
                  value={editExperienceLevel}
                  onChangeText={setEditExperienceLevel}
                  placeholder="e.g., Beginner, ex-pro, ran 5 years ago"
                  maxLength={150}
                />
              </View>
              {/* Training Frequency */}
              <View className="mb-4">
                <Text className="text-sm font-medium mb-1">Training Frequency</Text>
                <TextInput
                  className="border border-gray-300 rounded-md p-2"
                  value={editTrainingFrequency}
                  onChangeText={setEditTrainingFrequency}
                  placeholder="e.g., 3 times per week"
                  maxLength={50}
                />
              </View>
              {/* Current Weekly Mileage */}
              <View className="mb-4">
                <Text className="text-sm font-medium mb-1">Current Weekly Mileage</Text>
                <TextInput
                  className="border border-gray-300 rounded-md p-2"
                  value={editCurrentMileage}
                  onChangeText={setEditCurrentMileage}
                  placeholder="e.g., 20 km/week"
                  maxLength={50}
                />
              </View>
              {/* Preferred Units */}
              <View className="mb-4">
                <Text className="text-sm font-medium mb-1">Preferred Units</Text>
                <SegmentedControl
                  segments={[`Kilometers (km)`, `Miles`]}
                  selectedIndex={editUnits === 'km' ? 0 : 1}
                  onChange={index => setEditUnits(index === 0 ? 'km' : 'mi')}
                  containerClassName="border border-gray-300 rounded-md overflow-hidden"
                  segmentClassName="bg-white"
                  activeSegmentClassName="bg-[#F0ECEB]"
                  textClassName="text-gray-700"
                  activeTextClassName="text-gray-700"
                />
              </View>
              {/* Injury History */}
              <View className="mb-4">
                <Text className="text-sm font-medium mb-1">Injury History</Text>
                <TextInput
                  className="border border-gray-300 rounded-md p-2"
                  value={editInjuryHistory}
                  onChangeText={setEditInjuryHistory}
                  placeholder="e.g., sprained ankle last year"
                  maxLength={150}
                />
              </View>
              {/* Shoe Size */}
              <View className="mb-4">
                <Text className="text-sm font-medium mb-1">Shoe Size</Text>
                <TextInput
                  className="border border-gray-300 rounded-md p-2"
                  value={editShoeSize}
                  onChangeText={setEditShoeSize}
                  placeholder="e.g., US 8, EU 40"
                  maxLength={50}
                />
              </View>
              {/* Clothing Size */}
              <View className="mb-4">
                <Text className="text-sm font-medium mb-1">Clothing Size</Text>
                <TextInput
                  className="border border-gray-300 rounded-md p-2"
                  value={editClothingSize}
                  onChangeText={setEditClothingSize}
                  placeholder="e.g., M, L, XL"
                  maxLength={50}
                />
              </View>
              {/* Schedule Constraints */}
              <View className="mb-4">
                <Text className="text-sm font-medium mb-1">Schedule Constraints</Text>
                <TextInput
                  className="border border-gray-300 rounded-md p-2"
                  value={editScheduleConstraints}
                  onChangeText={setEditScheduleConstraints}
                  placeholder="e.g., no runs after 6pm"
                  maxLength={200}
                />
              </View>
            </View>
          )}

          {/* Buttons at bottom of card */}
          {isFullProfileVisible && !isEditing && (
            <View className="mt-4">
              <TouchableOpacity
                className="bg-[#F0ECEB] py-3 rounded-md mb-2"
                onPress={() => setIsFullProfileVisible(false)}
              >
                <Text className="text-center font-medium text-gray-700">Hide Full Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-[#F0ECEB] py-3 rounded-md"
                onPress={enterEditMode}
              >
                <Text className="text-center font-medium text-gray-700">Edit Profile</Text>
              </TouchableOpacity>
            </View>
          )}

          {isFullProfileVisible && isEditing && (
            <View className="mt-4">
              <TouchableOpacity
                className="bg-[#F0ECEB] py-3 rounded-md mb-2"
                onPress={handleSaveProfile}
                disabled={savingProfile}
              >
                <Text className="text-center font-medium text-gray-700">{savingProfile ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="border border-gray-300 py-3 rounded-md"
                onPress={() => setIsEditing(false)}
              >
                <Text className="text-center font-medium">Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        {/* Sign Out button always visible below the profile screen */}
        <View className="pt-4 mb-8">
          <TouchableOpacity
            className="border border-gray-300 py-3 rounded-md"
            onPress={confirmSignOut}
          >
            <Text className="text-center font-medium">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  );
} 