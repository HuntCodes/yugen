import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, Dimensions } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Asset } from 'expo-asset';
import { MinimalSpinner } from '../../components/ui/MinimalSpinner';

import { RootStackParamList } from '../../navigation/AppNavigator';

export type OACInfoScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'OACInfo'
>;

export function OACInfoScreen() {
  const navigation = useNavigation<OACInfoScreenNavigationProp>();
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const deviceWidth = Dimensions.get('window').width;

  useEffect(() => {
    (async () => {
      const asset = Asset.fromModule(require('../../../assets/intro-video.mp4'));
      await asset.downloadAsync();
      setVideoUri(asset.localUri || asset.uri);
    })();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <View style={{ flex: 1, paddingTop: 24, paddingBottom: 24 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 24 }} showsVerticalScrollIndicator={false}>
          <Text
            style={{
              fontSize: 32,
              fontWeight: '600',
              color: 'black',
              marginBottom: 24,
              marginTop: 24,
            }}
          >
            The power of running together
          </Text>

          {videoUri ? (
            <Video
              source={{ uri: videoUri }}
              style={{ width: deviceWidth, height: 220, alignSelf:'center', marginBottom: 24 }}
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

          <Text style={{ fontSize: 16, color: '#333333', lineHeight: 24, marginBottom: 24 }}>
            {`It all started with a question: What if we brought the world's best runners together to chase something bigger?`}
          </Text>

          <Text style={{ fontSize: 16, color: '#333333', lineHeight: 24, marginBottom: 24 }}>
            What began as a bold dream has grown into a global family of middle and long-distance runners. Today, the On Athletics Club (OAC) spans three teams: OAC Global in Colorado, USA; OAC Europe in St. Moritz, Switzerland; and OAC Oceania in Melbourne, Australia. Each team nurtures a unique community, united by their striving spirit and love for the run.
          </Text>

          <Text style={{ fontSize: 16, color: '#333333', lineHeight: 24, marginBottom: 24 }}>
            {`The results speak for themselves: Olympic medals, World Championships, and records shattered. But what sets OAC apart is the fire in their hearts. This isn't just about winning – it's about the pursuit, the community, and the passion that connects them all.`}
          </Text>

          <Text style={{ fontSize: 16, color: '#333333', lineHeight: 24 }}>
            {`Now is your chance to join the OAC.`}
          </Text>

          <TouchableOpacity
            style={{
              backgroundColor: '#000000',
              width: '100%',
              paddingVertical: 16,
              borderRadius: 32,
              alignItems: 'center',
              marginTop: 32,
            }}
            onPress={() => navigation.navigate('CoachSelect')}
          >
            <Text style={{ color: 'white', fontWeight: '500', fontSize: 16 }}>Choose your team</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
} 