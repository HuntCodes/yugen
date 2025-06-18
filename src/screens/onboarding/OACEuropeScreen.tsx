import { useNavigation } from '@react-navigation/native';
import React, { useState, useEffect } from 'react';
import { Text, TouchableOpacity, SafeAreaView, View, ScrollView, Dimensions } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Video, ResizeMode } from 'expo-av';
import { Asset } from 'expo-asset';
import { MinimalSpinner } from '../../components/ui/MinimalSpinner';

export type OACEuropeNav = NativeStackNavigationProp<RootStackParamList, 'OACEurope'>;

export function OACEuropeScreen() {
  const navigation = useNavigation<OACEuropeNav>();
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const deviceWidth = Dimensions.get('window').width;

  useEffect(() => {
    (async () => {
      const asset = Asset.fromModule(require('../../../assets/OAC-Europe.mp4'));
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
            Shaping Europe's fastest future.
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
            {`OAC Europe has been the launchpad for Europe's rising stars and top performers since 2022.`}
          </Text>

          <Text style={{ fontSize: 16, lineHeight: 24, color: '#333333', marginBottom: 24 }}>
            {`We're seeking out the continent's best talent, offering a professional training environment and a clear path to the global stage. Under the guidance of Thomas Dreissigacker and Vincent Guyot, athletes go beyond training – they rethink what's possible.`}
          </Text>

          <Text style={{ fontSize: 16, lineHeight: 24, color: '#333333' }}>
            {`True to On's Swiss roots, we kick off summers at high-altitude surrounded by the Alps in St. Moritz, before transitioning into winter training in South Africa and Spain.`}
          </Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
} 