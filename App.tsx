import React, { useEffect } from 'react'; // Import React and useEffect
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native'; // Restore NavigationContainer
import { AuthProvider, useAuth } from './src/context/AuthContext'; // Import useAuth here
import { AppNavigator } from './src/navigation/AppNavigator';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { View, Text } from 'react-native';
import './global.css';
import { debugEnvironment } from './src/debug-env'; // Import debug-env.js

// Run debug environment setup immediately
debugEnvironment();

// Create a new inner component that uses the auth context
function AppContent() {
  const { loading, session } = useAuth(); // Use context here

  // Add logging inside the consumer
  console.log(`AppContent Render: loading=${loading}, session=`, session);

  // Pass loading and session down as props
  return <AppNavigator authLoading={loading} session={session} />;
}

export default function App() {
  let [fontsLoaded, fontError] = useFonts({
    // Load multiple weights for flexibility
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Add logging to check font loading status
  console.log("Font Loading Status:", { fontsLoaded, fontError });

  if (!fontsLoaded && !fontError) {
    // Return null or a loading component while fonts load
    // Returning null avoids rendering potentially misstyled components
    return null;
  }

  // Log error if font loading fails - useful for debugging
  if (fontError) {
    console.error("Error loading fonts: ", fontError);
    // Optionally return an error message component
    // Return a simple text component for debugging error visibility
    return <Text>Error loading fonts. Check console.</Text>;
  }

  return (
    // Apply className directly to the base component
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        {/* Changed nesting order: NavigationContainer -> AuthProvider */}
        <NavigationContainer>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </NavigationContainer>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
