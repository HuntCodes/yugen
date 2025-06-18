import { useNavigation } from '@react-navigation/native';
import React, { useState, useEffect } from 'react';
import { Text, TouchableOpacity, SafeAreaView, View, ScrollView, Dimensions } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Asset } from 'expo-asset';
import { MinimalSpinner } from '../../components/ui/MinimalSpinner';

export type OACGlobalNav = NativeStackNavigationProp<RootStackParamList, 'OACGlobal'>;

export function OACGlobalScreen() {
  const navigation = useNavigation<OACGlobalNav>();
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const deviceWidth = Dimensions.get('window').width;

  useEffect(() => {
    (async () => {
      const asset = Asset.fromModule(require('../../../assets/OAC-Global.mp4'));
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
            Our global dream team. Built to win.
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
            {`In 2020, we didn't just build a team. We built a movement. We searched the globe to welcome the best and brightest talent, and now our OAC global team, made up of a diverse group of middle and long-distance runners, is on a quest to be the best.`}
          </Text>

          <Text style={{ fontSize: 16, lineHeight: 24, color: '#333333', marginBottom: 24 }}>
            {`The On Athletics Club, or OAC for short, is based at a full-time training facility in Boulder, Colorado. Led by three-time U.S. Olympian and running legend Dathan Ritzenhein, alongside coach Kelsey Quinn, our athletes are training hard ahead of a new season of challenges, world stage events and chasing their dreams.`}
          </Text>

          <Text style={{ fontSize: 16, lineHeight: 24, color: '#333333' }}>
            {`At OAC, it's not just about winning – it's about camaraderie, shared pursuit, and the belief that running is better together.`}
          </Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
} 