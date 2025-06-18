import { useNavigation } from '@react-navigation/native';
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, Dimensions } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Asset } from 'expo-asset';

import { RootStackParamList } from '../../navigation/AppNavigator';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MinimalSpinner } from '../../components/ui/MinimalSpinner';

export type OACOceaniaNav = NativeStackNavigationProp<RootStackParamList, 'OACOceania'>;

export function OACOceaniaScreen() {
  const navigation = useNavigation<OACOceaniaNav>();
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const deviceWidth = Dimensions.get('window').width;

  useEffect(() => {
    (async () => {
      const asset = Asset.fromModule(require('../../../assets/OAC-Oceania.mp4'));
      await asset.downloadAsync();
      setVideoUri(asset.localUri || asset.uri);
    })();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <View style={{ flex: 1, paddingTop: 24, paddingBottom: 24 }}>
        <TouchableOpacity
          style={{ position: 'absolute', top: 24, right: 24, zIndex: 10 }}
          onPress={() => navigation.goBack()}>
          <Text style={{ fontSize: 20, fontWeight: '800' }}>✕</Text>
        </TouchableOpacity>

        <ScrollView contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 24 }} showsVerticalScrollIndicator={false}>
          <Text style={{ fontSize: 32, fontWeight: '600', color: 'black', marginBottom: 24, marginTop: 24 }}>
            Oceania track stars bring the heat.
          </Text>

          {videoUri ? (
            <Video
              source={{ uri: videoUri }}
              style={{ width: deviceWidth, height: 220, alignSelf: 'center', borderRadius: 0, marginBottom: 24 }}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              isLooping
              isMuted
            />
          ) : (
            <View style={{ width: '100%', height: 220, marginBottom: 24, alignItems: 'center', justifyContent: 'center' }}>
              <MinimalSpinner size={32} color="#000000" thickness={2} />
            </View>
          )}

          <Text style={{ fontSize: 16, lineHeight: 24, color: '#333333', marginBottom: 24 }}>
            {`Under the sun-kissed Australian sky, OAC Oceania is where potential meets guidance. Led by four-time Olympian Craig Mottram, our team of ambitious athletes is dedicated to pushing limits and achieving record-breaking wins.`}
          </Text>

          <Text style={{ fontSize: 16, lineHeight: 24, color: '#333333', marginBottom: 24 }}>
            {`Founded in 2023, the team is based at a full-time training facility in Melbourne and part of the On Athletics Club global network. This is where top running talents from the Oceania region team up to eat, sleep and breathe all things track, as they strive for peak performance.`}
          </Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
} 