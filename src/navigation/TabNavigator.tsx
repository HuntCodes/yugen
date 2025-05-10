import React from 'react';
import { View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/main/HomeScreen';
import TrainingPlanScreen from '../screens/main/TrainingPlanScreen';
import { GearScreen } from '../screens/main/GearScreen';
import { ProfileNavigator } from './ProfileNavigator';
import { Entypo, MaterialCommunityIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Icon components using Expo vector icons
const HomeIcon = ({ focused }: { focused: boolean }) => (
  <View className="items-center justify-center">
    <Entypo name="home" size={24} color={focused ? '#000' : '#C4C4C4'} />
  </View>
);

const TrainingIcon = ({ focused }: { focused: boolean }) => (
  <View className="items-center justify-center">
    <MaterialCommunityIcons name="view-grid" size={22} color={focused ? '#000' : '#C4C4C4'} />
  </View>
);

const GearIcon = ({ focused }: { focused: boolean }) => (
  <View className="items-center justify-center">
    <FontAwesome5 name="shopping-bag" size={20} color={focused ? '#000' : '#C4C4C4'} />
  </View>
);

const ProfileIcon = ({ focused }: { focused: boolean }) => (
  <View className="items-center justify-center">
    <Ionicons name="person-circle-outline" size={24} color={focused ? '#000' : '#C4C4C4'} />
  </View>
);

export type TabParamList = {
  Home: undefined;
  Training: undefined;
  Gear: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

export function TabNavigator() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator 
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'white',
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          borderTopWidth: 0,
          elevation: 0,
          shadowColor: 'transparent',
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: '#000000',
        tabBarInactiveTintColor: '#9E9E9E',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2
        }
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{
          tabBarIcon: ({ focused }) => <HomeIcon focused={focused} />,
        }}
      />
      <Tab.Screen 
        name="Training" 
        component={TrainingPlanScreen} 
        options={{
          tabBarIcon: ({ focused }) => <TrainingIcon focused={focused} />,
        }}
      />
      <Tab.Screen 
        name="Gear" 
        component={GearScreen} 
        options={{
          tabBarIcon: ({ focused }) => <GearIcon focused={focused} />,
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileNavigator} 
        options={{
          tabBarIcon: ({ focused }) => <ProfileIcon focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
} 