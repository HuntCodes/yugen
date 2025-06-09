import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { EditProfileScreen } from '../screens/main/EditProfileScreen';
import { FeedbackScreen } from '../screens/main/FeedbackScreen';
import { ProfileScreen } from '../screens/main/ProfileScreen';
import NotificationScreen from '../screens/main/NotificationScreen';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  EditProfile: undefined;
  Feedback: undefined;
  Notifications: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="ProfileMain"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Feedback" component={FeedbackScreen} />
      <Stack.Screen name="Notifications" component={NotificationScreen} />
    </Stack.Navigator>
  );
}
