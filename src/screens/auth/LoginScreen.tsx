import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../context/AuthContext';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      await signIn(email, password);
      // If sign in is successful, the auth context will redirect to the appropriate screen
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Handle different error cases
      if (error.message.includes('Invalid login')) {
        setError('Invalid email or password');
      } else if (error.message.includes('rate limit')) {
        setError('Too many attempts, please try again later');
      } else {
        setError(error.message || 'An error occurred during login');
      }
      
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <View style={{ 
        flex: 1, 
        padding: 24,
        justifyContent: 'center'
      }}>
        <TouchableOpacity 
          style={{ position: 'absolute', top: 24, left: 24, zIndex: 10 }}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>←</Text>
        </TouchableOpacity>
        
        <Text style={{ 
          fontSize: 28, 
          fontWeight: 'bold', 
          color: 'black', 
          marginBottom: 32 
        }}>
          Sign in
        </Text>

        {error && (
          <View style={{
            backgroundColor: '#FFEBEE',
            padding: 16,
            borderRadius: 6,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: '#FFCDD2'
          }}>
            <Text style={{ color: '#C62828' }}>{error}</Text>
          </View>
        )}

        <View style={{ marginBottom: 16 }}>
          <Text style={{ 
            fontSize: 14, 
            fontWeight: '500', 
            color: '#757575', 
            marginBottom: 8 
          }}>
            Email
          </Text>
          <TextInput
            style={{
              backgroundColor: '#F5F5F5',
              borderRadius: 6,
              padding: 16,
              fontSize: 16,
              color: 'black'
            }}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor="#9E9E9E"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text style={{ 
            fontSize: 14, 
            fontWeight: '500', 
            color: '#757575', 
            marginBottom: 8 
          }}>
            Password
          </Text>
          <TextInput
            style={{
              backgroundColor: '#F5F5F5',
              borderRadius: 6,
              padding: 16,
              fontSize: 16,
              color: 'black'
            }}
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            placeholderTextColor="#9E9E9E"
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={{
            backgroundColor: '#000000',
            paddingVertical: 16,
            borderRadius: 6,
            alignItems: 'center',
            marginBottom: 16
          }}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={{ color: 'white', fontWeight: '500', fontSize: 16 }}>Sign In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={{ alignSelf: 'center', padding: 8 }}
          onPress={() => navigation.navigate('ForgotPassword')}
        >
          <Text style={{ color: '#000000', fontWeight: '500' }}>Forgot password?</Text>
        </TouchableOpacity>
        
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'center',
          marginTop: 24 
        }}>
          <Text style={{ color: '#757575' }}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
            <Text style={{ color: '#000000', fontWeight: '500' }}>Sign up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
} 