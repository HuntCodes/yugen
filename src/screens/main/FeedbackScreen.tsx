import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Alert, Platform, SafeAreaView, ScrollView } from 'react-native';
import { Text } from '../../components/ui/StyledText';
import { useAuth } from '../../context/AuthContext';
import { submitUserFeedback } from '../../services/feedback/userFeedbackService';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { MinimalSpinner } from '../../components/ui/MinimalSpinner';
import { Ionicons } from '@expo/vector-icons';

export function FeedbackScreen() {
  const { session } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const handleFeedbackSubmit = async () => {
    if (!session?.user || !feedbackText.trim()) return;
    
    setSubmittingFeedback(true);
    
    try {
      const { error } = await submitUserFeedback(session.user.id, {
        feedback_text: feedbackText.trim()
      });
      
      if (error) {
        Alert.alert('Error', 'Failed to submit feedback. Please try again.');
      } else {
        Alert.alert(
          'Thank you!', 
          'Your feedback has been submitted successfully.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <SafeAreaView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text className="text-base font-medium">Feedback</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView className="flex-1 px-6">
          {/* Description */}
          <View className="py-6">
            <Text className="text-lg font-semibold mb-2">Share Your Thoughts</Text>
            <Text className="text-sm text-gray-600 mb-6">
              Help us improve your training experience. Share your thoughts, suggestions, report any issues, or let us know what you love about the app.
            </Text>
          </View>

          {/* Feedback Input */}
          <View className="flex-1">
            <Text className="text-sm text-gray-600 mb-3">Your Feedback</Text>
            
            <View className="bg-white border-2 border-black rounded-2xl p-4 mb-3" style={{ minHeight: 200 }}>
              <TextInput
                className="flex-1 text-base"
                value={feedbackText}
                onChangeText={setFeedbackText}
                placeholder="Type your feedback here..."
                placeholderTextColor="#bbb"
                multiline={true}
                maxLength={1000}
                style={{ 
                  textAlignVertical: 'top',
                  fontSize: 16
                }}
              />
            </View>
            
            <Text className="text-xs text-gray-400 text-right mb-6">
              {feedbackText.length}/1000 characters
            </Text>
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View className="px-6 pb-8 pt-4">
          <TouchableOpacity 
            className={`py-4 rounded-full ${feedbackText.trim() ? 'bg-black' : 'bg-gray-300'}`}
            onPress={handleFeedbackSubmit}
            disabled={!feedbackText.trim() || submittingFeedback}
          >
            {submittingFeedback ? (
              <MinimalSpinner size={20} color="#FFFFFF" thickness={2} />
            ) : (
              <Text className={`text-center font-medium ${feedbackText.trim() ? 'text-white' : 'text-gray-500'}`}>
                Submit Feedback
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
} 