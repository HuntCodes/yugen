import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  InputAccessoryView,
} from 'react-native';

import { MinimalSpinner } from '../../components/ui/MinimalSpinner';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/AppNavigator';

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

  const DoneButton = () => (
    <View
      style={{
        backgroundColor: '#F8F9FA',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderTopWidth: 1,
        borderTopColor: '#E9ECEF',
        flexDirection: 'row',
        justifyContent: 'flex-end',
      }}>
      <TouchableOpacity
        onPress={() => Keyboard.dismiss()}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 4,
        }}>
        <Text
          style={{
            color: '#007AFF',
            fontSize: 16,
            fontWeight: '600',
          }}>
          Done
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <View
        style={{
          flex: 1,
          padding: 24,
          justifyContent: 'center',
        }}>
        <TouchableOpacity
          style={{ position: 'absolute', top: 24, left: 24, zIndex: 10 }}
          onPress={() => navigation.goBack()}>
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>←</Text>
        </TouchableOpacity>

        <Text
          style={{
            fontSize: 28,
            fontWeight: 'bold',
            color: 'black',
            marginBottom: 32,
          }}>
          Sign in
        </Text>

        {error && (
          <View
            style={{
              backgroundColor: '#FFEBEE',
              padding: 16,
              borderRadius: 6,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: '#FFCDD2',
            }}>
            <Text style={{ color: '#C62828' }}>{error}</Text>
          </View>
        )}

        <View style={{ marginBottom: 16 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '500',
              color: '#757575',
              marginBottom: 8,
            }}>
            Email
          </Text>
          <TextInput
            style={{
              backgroundColor: '#F5F5F5',
              borderRadius: 6,
              padding: 16,
              fontSize: 16,
              color: 'black',
            }}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor="#9E9E9E"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="next"
            onSubmitEditing={() => {
              // Focus will move to password field automatically
            }}
            inputAccessoryViewID="emailDoneButton"
          />
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '500',
              color: '#757575',
              marginBottom: 8,
            }}>
            Password
          </Text>
          <TextInput
            style={{
              backgroundColor: '#F5F5F5',
              borderRadius: 6,
              padding: 16,
              fontSize: 16,
              color: 'black',
            }}
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            placeholderTextColor="#9E9E9E"
            secureTextEntry
            textContentType="password"
            autoComplete="password"
            returnKeyType="done"
            onSubmitEditing={() => {
              Keyboard.dismiss();
              handleLogin();
            }}
            inputAccessoryViewID="passwordDoneButton"
          />
        </View>

        <TouchableOpacity
          style={{
            backgroundColor: '#000000',
            paddingVertical: 16,
            borderRadius: 6,
            alignItems: 'center',
            marginBottom: 16,
          }}
          onPress={handleLogin}
          disabled={loading}>
          {loading ? (
            <MinimalSpinner size={20} color="#FFFFFF" thickness={2} />
          ) : (
            <Text style={{ color: 'white', fontWeight: '500', fontSize: 16 }}>Sign In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={{ alignSelf: 'center', padding: 8 }}
          onPress={() => navigation.navigate('ForgotPassword')}>
          <Text style={{ color: '#000000', fontWeight: '500' }}>Forgot password?</Text>
        </TouchableOpacity>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 24,
          }}>
          <Text style={{ color: '#757575' }}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
            <Text style={{ color: '#000000', fontWeight: '500' }}>Sign up</Text>
          </TouchableOpacity>
        </View>
      </View>

      <InputAccessoryView nativeID="emailDoneButton">
        <DoneButton />
      </InputAccessoryView>

      <InputAccessoryView nativeID="passwordDoneButton">
        <DoneButton />
      </InputAccessoryView>
    </SafeAreaView>
  );
}
