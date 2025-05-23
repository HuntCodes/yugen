import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/api/supabase';
import { MinimalSpinner } from '../../components/ui/MinimalSpinner';

type ForgotPasswordScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const navigation = useNavigation<ForgotPasswordScreenNavigationProp>();

  const handleResetPassword = async () => {
    if (!email) {
      setMessage({ text: 'Please enter your email address', type: 'error' });
      return;
    }
    
    setLoading(true);
    setMessage(null);
    
    try {
      const { error } = await supabase.auth.api.resetPasswordForEmail(email);
      
      if (error) throw error;
      
      setMessage({ 
        text: 'Password reset instructions sent to your email', 
        type: 'success' 
      });
    } catch (error: any) {
      console.error('Reset password error:', error);
      setMessage({ 
        text: error.message || 'An error occurred during password reset', 
        type: 'error' 
      });
    } finally {
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
          marginBottom: 16 
        }}>
          Reset password
        </Text>
        
        <Text style={{ 
          color: '#757575', 
          marginBottom: 32,
          fontSize: 16
        }}>
          Enter your email and we'll send you instructions to reset your password.
        </Text>

        {message && (
          <View style={{
            backgroundColor: message.type === 'success' ? '#E8F5E9' : '#FFEBEE',
            padding: 16,
            borderRadius: 6,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: message.type === 'success' ? '#C8E6C9' : '#FFCDD2'
          }}>
            <Text style={{ 
              color: message.type === 'success' ? '#2E7D32' : '#C62828' 
            }}>
              {message.text}
            </Text>
          </View>
        )}

        <View style={{ marginBottom: 24 }}>
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

        <TouchableOpacity
          style={{
            backgroundColor: '#000000',
            paddingVertical: 16,
            borderRadius: 6,
            alignItems: 'center',
            marginBottom: 16
          }}
          onPress={handleResetPassword}
          disabled={loading}
        >
          {loading ? (
            <MinimalSpinner size={20} color="#FFFFFF" thickness={2} />
          ) : (
            <Text style={{ color: 'white', fontWeight: '500', fontSize: 16 }}>
              Send Reset Instructions
            </Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={{ alignItems: 'center', marginTop: 16 }}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={{ color: '#000000', fontWeight: '500' }}>
            Back to Sign In
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
} 