import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { Screen } from '../../components/ui/Screen';
import { useAuth } from '../../context/AuthContext';
import { fetchProfile, updateProfile } from '../../services/profile/profileService';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { MinimalSpinner } from '../../components/ui/MinimalSpinner';

export function EditProfileScreen() {
  const { session } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Form fields
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
          
          // Set form fields from profile data
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

  const renderInput = (label: string, value: string, onChangeText: (text: string) => void, placeholder: string = '', maxLength?: number) => (
    <View className="mb-4">
      <Text className="text-sm font-medium mb-1">{label}</Text>
      <TextInput
        className="border border-gray-300 rounded-md p-2"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        maxLength={maxLength}
      />
    </View>
  );

  const formatDisplayDate = (date: Date | null) => {
    if (!date) return 'No race date selected';
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setRaceDate(selectedDate);
    }
  };

  if (loading) {
    return (
      <Screen style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <MinimalSpinner size={48} color="#000000" thickness={3} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView className="p-4">
        <Text className="text-2xl font-bold mb-6">Edit Running Profile</Text>
        
        {renderInput('Nickname', nickname, setNickname, 'Your preferred name', 50)}
        
        {renderInput('Goal', goalType, setGoalType, 'e.g., Marathon, General Fitness', 150)}
        
        <View className="mb-4">
          <Text className="text-sm font-medium mb-1">Race Date</Text>
          <TouchableOpacity 
            className="border border-gray-300 rounded-md p-3 flex-row justify-between items-center"
            onPress={() => setShowDatePicker(true)}
          >
            <Text className={raceDate ? 'text-black' : 'text-gray-500'}>{formatDisplayDate(raceDate)}</Text>
            <Text className="text-blue-500">{raceDate ? 'Change' : 'Select Date'}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <View>
              {Platform.OS === 'ios' && (
                <View className="flex-row justify-end mt-2">
                  <TouchableOpacity 
                    onPress={() => setShowDatePicker(false)} 
                    className="bg-blue-500 px-4 py-1 rounded"
                  >
                    <Text className="text-white font-medium">Done</Text>
                  </TouchableOpacity>
                </View>
              )}
              <DateTimePicker
                value={raceDate || new Date()}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                minimumDate={new Date()}
              />
            </View>
          )}
        </View>
        
        {renderInput('Race Distance', raceDistance, setRaceDistance, 'e.g., 5K, 10K, Marathon', 50)}
        
        {renderInput(
          'Experience Level',
          experienceLevel,
          setExperienceLevel,
          'e.g., Beginner, ex-pro, ran 5 years ago',
          150
        )}
        
        {renderInput('Training Frequency', trainingFrequency, setTrainingFrequency, 'e.g., 3 times per week', 50)}
        
        {renderInput('Current Weekly Mileage', currentMileage, setCurrentMileage, 'e.g., 20 km/week', 50)}
        
        <View className="mb-4">
          <Text className="text-sm font-medium mb-1">Preferred Units</Text>
          <SegmentedControl
            segments={['Kilometers (km)', 'Miles']}
            selectedIndex={units === 'km' ? 0 : 1}
            onChange={(index: number) => setUnits(index === 0 ? 'km' : 'miles')}
            containerClassName="bg-gray-200 p-1 rounded-lg"
            segmentClassName="py-1 px-2 rounded"
            activeSegmentClassName="bg-white shadow-sm"
            textClassName="text-sm"
            activeTextClassName="font-medium"
          />
        </View>
        
        {renderInput('Injury History', injuryHistory, setInjuryHistory, 'Any past or current injuries', 250)}
        
        {renderInput('Shoe Size', shoeSize, setShoeSize, 'Your shoe size', 10)}
        
        {renderInput('Clothing Size', clothingSize, setClothingSize, 'Your clothing size', 20)}
        
        {renderInput('Schedule Constraints', scheduleConstraints, setScheduleConstraints, 'e.g., Can only run weekends', 250)}
        
        <View className="mt-6 mb-6 flex-row">
          <TouchableOpacity 
            className="flex-1 bg-gray-200 py-3 rounded-md mr-2"
            onPress={() => navigation.goBack()}
            disabled={saving}
          >
            <Text className="text-center font-medium text-gray-700">Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="flex-1 bg-black py-3 rounded-md ml-2"
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <MinimalSpinner size={20} color="#FFFFFF" thickness={2} />
            ) : (
              <Text className="text-white text-center font-medium">Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  );
} 