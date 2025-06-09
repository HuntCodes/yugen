import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
} from 'react-native';

import { MinimalSpinner } from '../../components/ui/MinimalSpinner';
import { Text } from '../../components/ui/StyledText';
import { useAuth } from '../../context/AuthContext';
import type { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { submitUserFeedback } from '../../services/feedback/userFeedbackService';

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
        feedback_text: feedbackText.trim(),
      });

      if (error) {
        Alert.alert('Error', 'Failed to submit feedback. Please try again.');
      } else {
        Alert.alert('Thank you!', 'Your feedback has been submitted successfully.', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
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
        <View className="flex-row items-center justify-between border-b border-gray-100 px-6 py-4">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text className="text-base font-medium">Feedback</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView className="flex-1 px-6">
          {/* Description */}
          <View className="py-6">
            <Text className="mb-2 text-lg font-semibold">Share Your Thoughts</Text>
            <Text className="mb-6 text-sm text-gray-600">
              Help us improve your training experience. Share your thoughts, suggestions, report any
              issues, or let us know what you love about the app.
            </Text>
          </View>

          {/* Feedback Input */}
          <View className="flex-1">
            <Text className="mb-3 text-sm text-gray-600">Your Feedback</Text>

            <View
              className="mb-3 rounded-2xl border-2 border-black bg-white p-4"
              style={{ minHeight: 200 }}>
              <TextInput
                className="flex-1 text-base"
                value={feedbackText}
                onChangeText={setFeedbackText}
                placeholder="Type your feedback here..."
                placeholderTextColor="#bbb"
                multiline
                maxLength={1000}
                style={{
                  textAlignVertical: 'top',
                  fontSize: 16,
                }}
              />
            </View>

            <Text className="mb-6 text-right text-xs text-gray-400">
              {feedbackText.length}/1000 characters
            </Text>
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View className="px-6 pb-8 pt-4">
          <TouchableOpacity
            className={`rounded-full py-4 ${feedbackText.trim() ? 'bg-black' : 'bg-gray-300'}`}
            onPress={handleFeedbackSubmit}
            disabled={!feedbackText.trim() || submittingFeedback}>
            {submittingFeedback ? (
              <MinimalSpinner size={20} color="#FFFFFF" thickness={2} />
            ) : (
              <Text
                className={`text-center font-medium ${feedbackText.trim() ? 'text-white' : 'text-gray-500'}`}>
                Submit Feedback
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}
