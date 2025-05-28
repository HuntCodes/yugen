import React from 'react';
import { View, Text, TouchableOpacity, Image, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';

type EntryScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Entry'>;

export function EntryScreen() {
  const navigation = useNavigation<EntryScreenNavigationProp>();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ 
          color: '#000000', 
          fontSize: 28, 
          fontWeight: 'bold', 
          textAlign: 'center', 
          marginBottom: 24 
        }}>
          Welcome to the future of endurance training
        </Text>
        
        <Text style={{ 
          color: '#757575', 
          fontSize: 16, 
          textAlign: 'center', 
          marginBottom: 48
        }}>
          Project Yugen: Version 0.1
        </Text>
        
        <TouchableOpacity
          style={{
            backgroundColor: '#000000',
            width: '100%',
            paddingVertical: 14,
            borderRadius: 6,
            marginBottom: 16
          }}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: '500', fontSize: 16 }}>
            Sign In
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            backgroundColor: 'white',
            width: '100%',
            paddingVertical: 14,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: '#F5F5F5'
          }}
          onPress={() => navigation.navigate('SignUp')}
        >
          <Text style={{ color: '#000000', textAlign: 'center', fontWeight: '500', fontSize: 16 }}>
            Create Account
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
} 