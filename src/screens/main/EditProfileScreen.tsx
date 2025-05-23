import React, { useState, useEffect } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, Alert, Platform, SafeAreaView } from 'react-native';
import { Text } from '../../components/ui/StyledText';
import { Screen } from '../../components/ui/Screen';
import { useAuth } from '../../context/AuthContext';
import { fetchProfile, updateProfile } from '../../services/profile/profileService';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MinimalSpinner } from '../../components/ui/MinimalSpinner';
import { Ionicons } from '@expo/vector-icons';

export function EditProfileScreen() {
  const { session } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Personal information fields
  const [email, setEmail] = useState('');
  
  // Running profile fields
  const [nickname, setNickname] = useState('');
  const [goalType, setGoalType] = useState('');
  const [raceDate, setRaceDate] = useState<Date | null>(null);
  const [raceDistance, setRaceDistance] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [trainingFrequency, setTrainingFrequency] = useState('');
  const [currentMileage, setCurrentMileage] = useState('');
  const [injuryHistory, setInjuryHistory] = useState('');
  const [shoeSize, setShoeSize] = useState('');
  const [clothingSize, setClothingSize] = useState('');
  const [scheduleConstraints, setScheduleConstraints] = useState('');
  const [units, setUnits] = useState('km');

  // Load profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (session?.user) {
        try {
          const profileData = await fetchProfile(session.user.id);
          setProfile(profileData);
          
          // Set personal information
          setEmail(session.user.email || '');
          
          // Set running profile fields
          setNickname(profileData?.nickname || '');
          setGoalType(profileData?.goal_type || '');
          
          if (profileData?.race_date) {
            setRaceDate(new Date(profileData.race_date));
          }
          
          setRaceDistance(profileData?.race_distance || '');
          setExperienceLevel(profileData?.experience_level || '');
          setTrainingFrequency(profileData?.current_frequency || '');
          setCurrentMileage(profileData?.current_mileage || '');
          setInjuryHistory(profileData?.injury_history || '');
          setShoeSize(profileData?.shoe_size || '');
          setClothingSize(profileData?.clothing_size || '');
          setScheduleConstraints(profileData?.schedule_constraints || '');
          setUnits(profileData?.units || 'km');
        } catch (error) {
          console.error('Error loading profile:', error);
          Alert.alert('Error', 'Failed to load profile data');
        } finally {
          setLoading(false);
        }
      }
    };
    
    loadProfile();
  }, [session]);

  const handleSave = async () => {
    if (!session?.user) return;
    
    setSaving(true);
    
    try {
      const updates = {
        email,
        nickname,
        goal_type: goalType,
        race_date: raceDate ? raceDate.toISOString().split('T')[0] : null,
        race_distance: raceDistance,
        experience_level: experienceLevel,
        current_frequency: trainingFrequency,
        current_mileage: currentMileage,
        injury_history: injuryHistory,
        shoe_size: shoeSize,
        clothing_size: clothingSize,
        schedule_constraints: scheduleConstraints,
        units
      };
      
      await updateProfile(session.user.id, updates);
      Alert.alert('Success', 'Profile updated successfully');
      navigation.goBack();
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile changes');
    } finally {
      setSaving(false);
    }
  };

  const renderInput = (label: string, value: string, onChangeText: (text: string) => void, placeholder: string = '', isEmail = false) => (
    <View className="mb-8">
      <Text className="text-base text-gray-600 mb-3">{label}</Text>
      <TextInput
        className={`text-lg pb-2 border-b ${isEmail ? 'border-gray-300 text-gray-400' : 'border-gray-400'}`}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        editable={!isEmail}
        autoComplete={isEmail ? 'email' : 'off'}
        keyboardType={isEmail ? 'email-address' : 'default'}
        style={{ fontSize: 18 }}
      />
    </View>
  );

  if (loading) {
    return (
      <Screen style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <MinimalSpinner size={48} color="#000000" thickness={3} />
      </Screen>
    );
  }

  return (
    <Screen style={{ backgroundColor: '#FFFFFF' }}>
      <SafeAreaView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text className="text-lg font-medium">Profile</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView className="flex-1 px-6">
          {/* Avatar Section */}
          <View className="items-center py-8">
            <View className="relative">
              <View className="w-24 h-24 rounded-full bg-purple-200 items-center justify-center">
                <Text className="text-3xl font-medium text-purple-800">
                  {email?.charAt(0) || 'U'}
                </Text>
              </View>
              <TouchableOpacity className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white border border-gray-200 items-center justify-center">
                <Ionicons name="pencil" size={16} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Personal Information */}
          {renderInput('Email', email, setEmail, '', true)}

          {/* Running Profile - Collapsible Section */}
          <View className="mt-8 mb-4">
            <Text className="text-lg font-medium mb-6">Running Profile</Text>
            
            {renderInput('Nickname', nickname, setNickname, 'Your Preferred Running Name')}
            {renderInput('Goal', goalType, setGoalType, 'E.g., Marathon, General Fitness')}
            
            {/* Race Date */}
            <View className="mb-8">
              <Text className="text-base text-gray-600 mb-3">Race Date</Text>
              <TouchableOpacity 
                className="flex-row items-center justify-between pb-2 border-b border-gray-400"
                onPress={() => setShowDatePicker(true)}
              >
                <Text className="text-lg" style={{ fontSize: 18 }}>
                  {raceDate ? raceDate.toLocaleDateString('en-GB') : 'Select Race Date'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
              {showDatePicker && (
                <View className="mt-4">
                  {Platform.OS === 'ios' && (
                    <View className="flex-row justify-end mb-2">
                      <TouchableOpacity 
                        onPress={() => setShowDatePicker(false)} 
                        className="bg-black px-4 py-2 rounded"
                      >
                        <Text className="text-white font-medium">Done</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  <DateTimePicker
                    value={raceDate || new Date()}
                    mode="date"
                    display="spinner"
                    onChange={(event, selectedDate) => {
                      if (Platform.OS === 'android') {
                        setShowDatePicker(false);
                      }
                      if (selectedDate) {
                        setRaceDate(selectedDate);
                      }
                    }}
                    minimumDate={new Date()}
                  />
                </View>
              )}
            </View>
            
            {renderInput('Race Distance', raceDistance, setRaceDistance, 'E.g., 5K, 10K, Marathon')}
            {renderInput('Experience Level', experienceLevel, setExperienceLevel, 'E.g., Beginner, Intermediate, Advanced')}
            {renderInput('Training Frequency', trainingFrequency, setTrainingFrequency, 'E.g., 3 Times Per Week')}
            {renderInput('Current Weekly Mileage', currentMileage, setCurrentMileage, 'E.g., 20 Km/Week')}
            
            {/* Units */}
            <View className="mb-8">
              <Text className="text-base text-gray-600 mb-3">Preferred Units</Text>
              <View className="flex-row bg-gray-100 p-1 rounded-lg">
                <TouchableOpacity
                  className={`flex-1 items-center py-2 px-4 rounded ${units === 'km' ? 'bg-white shadow-sm' : ''}`}
                  onPress={() => setUnits('km')}
                >
                  <Text className={`text-sm ${units === 'km' ? 'font-medium' : ''}`}>
                    Kilometers (km)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 items-center py-2 px-4 rounded ${units === 'miles' ? 'bg-white shadow-sm' : ''}`}
                  onPress={() => setUnits('miles')}
                >
                  <Text className={`text-sm ${units === 'miles' ? 'font-medium' : ''}`}>
                    Miles
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {renderInput('Injury History', injuryHistory, setInjuryHistory, 'Any Past Or Current Injuries')}
            {renderInput('Shoe Size', shoeSize, setShoeSize, 'Your Running Shoe Size')}
            {renderInput('Clothing Size', clothingSize, setClothingSize, 'Your Clothing Size')}
            {renderInput('Schedule Constraints', scheduleConstraints, setScheduleConstraints, 'E.g., Can Only Run Weekends')}
          </View>
        </ScrollView>

        {/* Bottom Button */}
        <View className="px-6 pb-8 pt-4">
          <TouchableOpacity 
            className="bg-black py-4 rounded-full"
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <MinimalSpinner size={20} color="#FFFFFF" thickness={2} />
            ) : (
              <Text className="text-white text-center text-lg font-medium">Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Screen>
  );
} 