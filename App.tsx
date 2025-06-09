import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { NavigationContainer } from '@react-navigation/native'; // Restore NavigationContainer
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react'; // Import React and useEffect
import { View, Text, NativeModules, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// REAL SOLUTION: Import RTCAudioSession for proper WebRTC audio management
import { mediaDevices } from 'react-native-webrtc';

import { AuthProvider, useAuth } from './src/context/AuthContext'; // Import useAuth here
import { debugEnvironment } from './src/debug-env'; // Import debug-env.js
import { AppNavigator } from './src/navigation/AppNavigator';
import { generateFreshNotificationContent } from './src/services/notifications/notificationService';

import './global.css';

// Run debug environment setup immediately
debugEnvironment();

// Improved iOS background audio session management
if (Platform.OS === 'ios') {
  console.log('iOS detected: Initializing audio session...');
  
  try {
    if (NativeModules.RTCAudioSession) {
        const { RTCAudioSession } = NativeModules;
      RTCAudioSession.initializeAudioSession();
      console.log('RTCAudioSession initialized successfully');
    } else {
      console.warn('RTCAudioSession module not found. This may affect WebRTC audio quality.');
    }
  } catch (error) {
    console.warn('Error initializing RTCAudioSession:', error);
  }

  // Get audio session and configure it properly for WebRTC
  try {
    const AudioSession = NativeModules.RTCAudioSession;
    if (AudioSession) {
      // Configure for voice chat
      AudioSession.configureAudioSession({
        category: 'playAndRecord',
        mode: 'voiceChat', 
        options: ['allowBluetooth']
      });
    }
  } catch (error) {
    console.warn('Could not configure audio session:', error);
  }
        } else {
  console.log('Android platform detected: Default audio configuration will be used.');
}

// Handle notification content generation
const handleNotificationReceived = async (notification: Notifications.Notification) => {
  const data = notification.request.content.data;
  
  // Check if this is a dynamic notification that needs fresh content
  // BUT NOT if it already has fresh content (to prevent infinite loop)
  if (data?.dynamic === true && !data?.freshContent && !data?.processing) {
    console.log('[App] Received dynamic notification, generating fresh content...');
    
    // Immediately dismiss the original to prevent repeat triggers
    await Notifications.dismissNotificationAsync(notification.request.identifier);
    
    try {
      const freshContent = await generateFreshNotificationContent(data);
      
      if (freshContent) {
        console.log('[App] Fresh notification content generated successfully');
        console.log('[App] Fresh content:', freshContent);
        
        // Schedule the fresh notification as a simple date-based trigger (not calendar)
        // This prevents any recurring trigger issues
        await Notifications.scheduleNotificationAsync({
          content: {
            title: freshContent.title,
            body: freshContent.body,
            data: {
              ...data,
              dynamic: false, // IMPORTANT: Turn off dynamic to prevent infinite loop
              freshContent: true, // Mark as having fresh content
              processing: false, // Clear processing flag
            },
            categoryIdentifier: (data.type as string) || 'default',
            sound: 'default', // Enable sound for the actual notification
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(Date.now() + 5000), // 5 seconds from now - simple date trigger
          },
        });
      } else {
        console.warn('[App] Failed to generate fresh notification content, using fallback');
      }
  } catch (error) {
      console.error('[App] Error generating fresh notification content:', error);
    }
  } else if (data?.freshContent) {
    console.log('[App] Received fresh notification - no further processing needed');
  } else if (data?.processing) {
    console.log('[App] Notification already being processed, ignoring duplicate');
  }
};

// Create a new inner component that uses the auth context
function AppContent() {
  const { loading, session } = useAuth(); // Use context here

  // Add logging inside the consumer
  console.log(`AppContent Render: loading=${loading}, session=`, session);

  // Handle notification responses
  useEffect(() => {
    const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;
      console.log('Notification tapped:', data);

      // Handle different notification types
      if (data?.type === 'morning_motivation') {
        // Navigate to home screen or training plan
        // This would require access to navigation, which we could implement
        // by passing navigation down or using a navigation ref
        console.log('Morning motivation notification tapped');
      } else if (data?.type === 'evening_checkin') {
        console.log('Evening check-in notification tapped');
      }
    };

    // Listen for notification responses
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );

    // Listen for notifications received while app is open
    const receivedSubscription = Notifications.addNotificationReceivedListener(
      handleNotificationReceived
    );

    return () => {
      responseSubscription.remove();
      receivedSubscription.remove();
    };
  }, []);

  // Pass loading and session down as props
  return <AppNavigator authLoading={loading} session={session} />;
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    // Load multiple weights for flexibility
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Add logging to check font loading status
  console.log('Font Loading Status:', { fontsLoaded, fontError });

  if (!fontsLoaded && !fontError) {
    // Return null or a loading component while fonts load
    // Returning null avoids rendering potentially misstyled components
    return null;
  }

  // Log error if font loading fails - useful for debugging
  if (fontError) {
    console.error('Error loading fonts: ', fontError);
    // Optionally return an error message component
    // Return a simple text component for debugging error visibility
    return <Text>Error loading fonts. Check console.</Text>;
  }

  return (
    // Apply className directly to the base component
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer>
            <AppContent />
          </NavigationContainer>
        </AuthProvider>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
