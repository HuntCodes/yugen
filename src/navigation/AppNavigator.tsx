import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
// import { NavigationContainer } from '@react-navigation/native'; // Removed: No longer needed here
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { EntryScreen } from '../screens/entry/EntryScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { CoachSelect } from '../screens/onboarding/CoachSelect';
import { OnboardingChat } from '../screens/onboarding/OnboardingChat';
import { VoiceOnboarding } from '../screens/onboarding/VoiceOnboarding';
import { TabNavigator } from './TabNavigator';
import { supabase } from '../lib/supabase';
import { ChatMessage } from '../types/chat';
import { Session } from '@supabase/supabase-js';
import { MinimalSpinner } from '../components/ui/MinimalSpinner';

export type RootStackParamList = {
  Entry: undefined;
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  CoachSelect: undefined;
  Onboarding: { coachId?: string } | undefined;
  VoiceOnboarding: { coachId?: string } | undefined;
  MainApp: { onboardingMessages?: ChatMessage[] } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

interface AppNavigatorProps {
  authLoading: boolean;
  session: Session | null;
}

export function AppNavigator({ authLoading, session }: AppNavigatorProps) {
  const loading = authLoading;
  const [profileLoading, setProfileLoading] = useState(!!session);
  const [hasCoach, setHasCoach] = useState<null | boolean>(null);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [currentCoachId, setCurrentCoachId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const fetchProfile = async () => {
      console.log('AppNavigator Effect: session=', session);
      if (session && session.user) {
        console.log('AppNavigator Effect: Fetching profile...');
        setProfileLoading(true);
        setCurrentCoachId(undefined);
        
        try {
          // First, check if a profile exists (using get method to avoid error)
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id);
            
          if (error) {
            console.error('Error in profile query:', error.message);
            setHasCoach(false);
            setOnboardingComplete(null);
            setCurrentCoachId(undefined);
          } else if (!data || data.length === 0) {
            // No profile exists, create one
            console.log('Profile does not exist, creating...');
            
            try {
              // Create a new profile
              const { error: createError } = await supabase
                .from('profiles')
                .insert({
                  id: session.user.id,
                  email: session.user.email,
                  updated_at: new Date().toISOString(),
                });
                
              if (createError) {
                console.error('Failed to create profile:', createError.message);
              } else {
                console.log('Profile created successfully');
              }
              
              // Set default values
              setHasCoach(false);
              setOnboardingComplete(null);
              setCurrentCoachId(undefined);
            } catch (createErr: any) {
              console.error('Exception creating profile:', createErr.message);
              setHasCoach(false);
              setOnboardingComplete(null);
              setCurrentCoachId(undefined);
            }
          } else {
            // Profile exists, use the first result (since we're not using maybeSingle)
            const profile = data[0];
            console.log('Profile found:', profile);
            setHasCoach(!!profile?.coach_id);
            setOnboardingComplete(!!profile?.onboarding_completed);
            setCurrentCoachId(profile?.coach_id);
          }
        } catch (e: any) {
          console.error('Exception in profile fetch/create:', e.message);
          setHasCoach(false);
          setOnboardingComplete(null);
          setCurrentCoachId(undefined);
        } finally {
          setProfileLoading(false);
          console.log('AppNavigator Effect: Profile fetched/created, profileLoading=false');
        }
      } else {
        console.log('AppNavigator Effect: No session, resetting state...');
        setHasCoach(null);
        setOnboardingComplete(null);
        setCurrentCoachId(undefined);
        setProfileLoading(false); 
        console.log('AppNavigator Effect: State reset, profileLoading=false');
      }
    };
    
    fetchProfile();
  }, [session]);

  console.log(`AppNavigator Render: loading=${loading}, profileLoading=${profileLoading}`);

  if (loading || profileLoading) {
    console.log('AppNavigator Render: Showing Loading Indicator');
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <MinimalSpinner size={48} color="#3B82F6" thickness={3} />
      </View>
    );
  }

  console.log(`AppNavigator Render: Loading false, determining initial route... session=${session}, hasCoach=${hasCoach}, onboardingComplete=${onboardingComplete}, currentCoachId=${currentCoachId}`);

  let initialRouteName: keyof RootStackParamList = 'Entry';
  let routeInitialParams: any = undefined;

  if (session) {
    if (hasCoach === null) {
    } else if (hasCoach === false) {
      initialRouteName = 'CoachSelect';
    } else if (onboardingComplete === false) { 
      initialRouteName = 'VoiceOnboarding';
      if (currentCoachId) {
        routeInitialParams = { coachId: currentCoachId };
        console.log(`AppNavigator Render: Setting VoiceOnboarding with coachId: ${currentCoachId}`);
      } else {
        console.warn('AppNavigator Render: hasCoach is true but currentCoachId is not set for VoiceOnboarding. Defaulting in VoiceOnboarding might occur.');
      }
    } else if (onboardingComplete === true) {
      initialRouteName = 'MainApp';
    }
  }
  
  console.log(`AppNavigator Render: Rendering Navigator with initialRouteName=${initialRouteName}`);

  return (
    // <NavigationContainer> // This line and its closing tag are removed
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRouteName}>
        <Stack.Screen name="Entry" component={EntryScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="CoachSelect" component={CoachSelect} />
        <Stack.Screen 
          name="VoiceOnboarding" 
          component={VoiceOnboarding} 
          initialParams={routeInitialParams}
        />
        <Stack.Screen name="Onboarding" component={OnboardingChat} />
        <Stack.Screen name="MainApp" component={TabNavigator} />
      </Stack.Navigator>
    // </NavigationContainer> // This line is removed
  );
} 