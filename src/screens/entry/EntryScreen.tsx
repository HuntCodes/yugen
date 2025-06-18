import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, StyleSheet } from 'react-native';
import { Video, ResizeMode } from 'expo-av';

import { RootStackParamList } from '../../navigation/AppNavigator';

type EntryScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Entry'>;

export function EntryScreen() {
  const navigation = useNavigation<EntryScreenNavigationProp>();
  const videoRef = useRef<Video>(null);

  // Ensure video plays whenever this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // When screen gains focus
      videoRef.current?.playAsync()?.catch(() => {});

      // Optional: pause when leaving screen
      return () => {
        videoRef.current?.pauseAsync()?.catch(() => {});
      };
    }, [])
  );

  return (
    <View style={{ flex: 1 }}>
      <Video
        ref={videoRef}
        source={require('../../../assets/intro-video.mp4')}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
      />

      <SafeAreaView style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: 24,
            marginBottom: 60,
          }}>
          <TouchableOpacity
            style={{
              backgroundColor: '#000000',
              width: '100%',
              paddingVertical: 14,
              borderRadius: 32,
              marginBottom: 16,
            }}
            onPress={() => navigation.navigate('SignUp')}>
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: '500', fontSize: 16 }}>
              Create Account
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: 'white',
              width: '100%',
              paddingVertical: 14,
              borderRadius: 32,
              borderWidth: 1,
              borderColor: '#F5F5F5',
            }}
            onPress={() => navigation.navigate('Login')}>
            <Text style={{ color: '#000000', textAlign: 'center', fontWeight: '500', fontSize: 16 }}>
              Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}
