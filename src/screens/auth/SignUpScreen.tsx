import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, SafeAreaView, Keyboard, KeyboardAvoidingView, Platform, InputAccessoryView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../context/AuthContext';
import { MinimalSpinner } from '../../components/ui/MinimalSpinner';

type SignUpScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SignUp'>;

export function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation<SignUpScreenNavigationProp>();
  const { signUp } = useAuth();

  const handleSignUp = async () => {
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      await signUp(email, password);
      // Auth context will handle navigation after successful sign-up
    } catch (error: any) {
      console.error('Sign up error:', error);
      
      if (error.message.includes('email')) {
        setError('Invalid email format or email already in use');
      } else if (error.message.includes('password')) {
        setError('Password is too weak. Use at least 8 characters with letters and numbers');
      } else {
        setError(error.message || 'An error occurred during sign up');
      }
      
      setLoading(false);
    }
  };

  const DoneButton = () => (
    <View style={{
      backgroundColor: '#F8F9FA',
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderTopWidth: 1,
      borderTopColor: '#E9ECEF',
      flexDirection: 'row',
      justifyContent: 'flex-end'
    }}>
      <TouchableOpacity
        onPress={() => Keyboard.dismiss()}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 4
        }}
      >
        <Text style={{ 
          color: '#007AFF', 
          fontSize: 16, 
          fontWeight: '600' 
        }}>
          Done
        </Text>
      </TouchableOpacity>
    </View>
  );

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
          Create account
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
            placeholder="Create a password"
            placeholderTextColor="#9E9E9E"
            secureTextEntry
            textContentType="newPassword"
            autoComplete="password-new"
            returnKeyType="done"
            onSubmitEditing={() => {
              Keyboard.dismiss();
              handleSignUp();
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
            marginBottom: 16
          }}
          onPress={handleSignUp}
          disabled={loading}
        >
          {loading ? (
            <MinimalSpinner size={20} color="#FFFFFF" thickness={2} />
          ) : (
            <Text style={{ color: 'white', fontWeight: '500', fontSize: 16 }}>Create Account</Text>
          )}
        </TouchableOpacity>
        
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'center',
          marginTop: 24 
        }}>
          <Text style={{ color: '#757575' }}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={{ color: '#000000', fontWeight: '500' }}>Sign in</Text>
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