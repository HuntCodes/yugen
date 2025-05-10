import { useState, useEffect, useCallback } from 'react';
import { checkMicrophonePermission } from '../lib/voice/voiceUtils';
import { useAuth } from './useAuth';
import { Audio } from 'expo-av';

/**
 * Custom hook for managing voice chat state
 */
export const useVoiceChat = () => {
  const [isVoiceChatAvailable, setIsVoiceChatAvailable] = useState<boolean | null>(null);
  const [isVoiceChatEnabled, setIsVoiceChatEnabled] = useState(false);
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  const [voiceChatError, setVoiceChatError] = useState<string | null>(null);
  const auth = useAuth();
  
  // Check if voice chat is available on this device
  const checkVoiceChatAvailability = useCallback(async () => {
    try {
      // Check for microphone permissions
      const hasPermission = await checkMicrophonePermission();
      
      // We assume the device has a microphone if we have permissions
      // Instead of checking isAvailableAsync which doesn't exist
      
      // Voice chat is available if we have permission
      setIsVoiceChatAvailable(hasPermission);
      
      // Reset error state
      setVoiceChatError(null);
    } catch (err) {
      console.error('Error checking voice chat availability:', err);
      setIsVoiceChatAvailable(false);
      setVoiceChatError('Failed to check voice chat availability');
    }
  }, []);
  
  // Initialize on mount
  useEffect(() => {
    checkVoiceChatAvailability();
  }, [checkVoiceChatAvailability]);
  
  // Toggle voice chat enabled state
  const toggleVoiceChatEnabled = useCallback(() => {
    setIsVoiceChatEnabled(prev => !prev);
  }, []);
  
  // Open voice chat modal
  const openVoiceChat = useCallback(() => {
    if (isVoiceChatAvailable) {
      setShowVoiceChat(true);
    } else {
      setVoiceChatError('Voice chat is not available on this device');
    }
  }, [isVoiceChatAvailable]);
  
  // Close voice chat modal
  const closeVoiceChat = useCallback(() => {
    setShowVoiceChat(false);
  }, []);
  
  return {
    isVoiceChatAvailable,
    isVoiceChatEnabled,
    showVoiceChat,
    voiceChatError,
    toggleVoiceChatEnabled,
    openVoiceChat,
    closeVoiceChat,
    checkVoiceChatAvailability
  };
}; 