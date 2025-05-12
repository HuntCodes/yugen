import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import Constants from 'expo-constants';
// Import WebRTC correctly
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';

// Import InCallManager conditionally
let InCallManager: any = null;
try {
  // Dynamic import to prevent crashes if module isn't available
  InCallManager = require('react-native-incall-manager').default;
  console.log('InCallManager loaded:', !!InCallManager);
} catch (err) {
  console.warn('Failed to load InCallManager:', err);
}

import { useAuth } from '../../hooks/useAuth';
import { checkMicrophonePermission, processVoiceInput } from '../../lib/voice/voiceUtils';
import { voiceSessionManager } from '../../lib/voice/voiceSessionManager';
// Import the coach styles for the prompts
import { coachStyles } from '../../config/coachingGuidelines';

// Import the saveMessage function
import { saveMessage } from '../../services/chat/chatService';

// Define types for data received from WebRTC
interface TranscriptData {
  text: string;
}

interface MessageData {
  text: string;
}

interface VoiceChatProps {
  isVisible: boolean;
  onClose: () => void;
  coachId: string;
  apiKey: string;
  onError?: (error: string) => void;
  onboardingMode?: boolean;
  onTranscriptComplete?: (userTranscript: string, coachResponse: string, isComplete: boolean) => void;
}

const VoiceChat = ({ isVisible, onClose, coachId, apiKey, onError, onboardingMode = false, onTranscriptComplete }: VoiceChatProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [responseText, setResponseText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [dataChannel, setDataChannel] = useState<any>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioOutput, setAudioOutput] = useState<MediaStream | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ephemeralKey, setEphemeralKey] = useState<string | null>(null);
  const [conversationComplete, setConversationComplete] = useState(false);
  const [inCallManagerInitialized, setInCallManagerInitialized] = useState(false);
  
  const auth = useAuth();
  const userId = auth.session?.user?.id;

  // Configure audio to use speaker
  useEffect(() => {
    const configureAudio = async () => {
      try {
        // Configure expo-av audio mode
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          interruptionModeIOS: 1, // Do not mix with other apps' audio
          interruptionModeAndroid: 1, // Do not mix with other apps' audio
          playThroughEarpieceAndroid: false, // Use speaker, not earpiece
          shouldDuckAndroid: true,
        });
        
        // Force audio through speaker using native methods if available
        if (Platform.OS === 'android') {
          // For Android, we can use the expo-av setting (already set above)
          console.log('Using expo-av to force speaker on Android');
        } else {
          console.log('Trying alternative speaker methods for iOS');
        }
        
        // If InCallManager is properly loaded, use it as a fallback
        if (InCallManager && typeof InCallManager.start === 'function' && !inCallManagerInitialized) {
          try {
            console.log('Initializing InCallManager');
            InCallManager.start({
              media: 'audio', 
              ringback: '', 
              auto: true, 
            });
            
            if (typeof InCallManager.setForceSpeakerphoneOn === 'function') {
              InCallManager.setForceSpeakerphoneOn(true);
              setInCallManagerInitialized(true);
              console.log('Audio mode configured for speaker output with InCallManager');
            } else {
              console.warn('InCallManager.setForceSpeakerphoneOn is not a function');
            }
          } catch (inCallErr) {
            console.error('Error with InCallManager methods:', inCallErr);
          }
        } else {
          console.warn('InCallManager not properly loaded or initialized already');
          console.log('InCallManager availability:', {
            loaded: !!InCallManager,
            hasStartMethod: InCallManager && typeof InCallManager.start === 'function',
            alreadyInitialized: inCallManagerInitialized
          });
        }
      } catch (err) {
        console.error('Failed to configure audio mode:', err);
      }
    };

    if (isVisible) {
      configureAudio();
    }

    return () => {
      // Reset audio mode when component unmounts
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
        interruptionModeIOS: 1, // Do not mix with other apps' audio
        interruptionModeAndroid: 1, // Do not mix with other apps' audio
        playThroughEarpieceAndroid: true, // Reset to default
        shouldDuckAndroid: true,
      }).catch(err => console.error('Failed to reset audio mode:', err));
      
      // Stop InCallManager with null check
      try {
        if (InCallManager && typeof InCallManager.stop === 'function' && inCallManagerInitialized) {
          console.log('Stopping InCallManager');
          InCallManager.stop();
          setInCallManagerInitialized(false);
        }
      } catch (err) {
        console.error('Error stopping InCallManager:', err);
      }
    };
  }, [isVisible, inCallManagerInitialized]);

  // Update error state and notify parent component
  const setErrorWithNotification = (errorMessage: string) => {
    setError(errorMessage);
    if (onError) {
      onError(errorMessage);
    }
  };

  // Check microphone permissions when the component mounts
  useEffect(() => {
    if (isVisible) {
      checkMicrophonePermissions();
    }
  }, [isVisible]);

  // Check and request microphone permissions
  const checkMicrophonePermissions = async () => {
    try {
      const permissionGranted = await checkMicrophonePermission();
      setHasPermission(permissionGranted);
      
      if (!permissionGranted) {
        setErrorWithNotification('Microphone permission is required for voice chat.');
      } else {
        // Permissions granted, get ephemeral key
        getEphemeralKey();
      }
    } catch (err) {
      console.error('Error checking permissions:', err);
      setErrorWithNotification('Failed to check microphone permissions.');
    }
  };

  // Get an ephemeral key from OpenAI to use for WebRTC connection
  const getEphemeralKey = async () => {
    try {
      setIsConnecting(true);
      
      // Use direct Supabase URL instead of environment variables
      const supabaseUrl = "https://tdwtacijcmpfnwlovlxh.supabase.co";
      
      console.log('Using direct Supabase URL for ephemeral key request:', supabaseUrl);
      
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }
      
      console.log('Requesting ephemeral key from edge function...');
      
      // Add timeout to the fetch for better error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${supabaseUrl}/functions/v1/ephemeral-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini-realtime-preview-2024-12-17',
          voice: 'verse' // Updated from alloy to verse
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Failed to get ephemeral key: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Received response:', data ? 'Got data' : 'No data');
      
      const key = data.client_secret?.value;
      
      if (!key) {
        throw new Error('No ephemeral key received from OpenAI');
      }
      
      console.log('Successfully obtained ephemeral key');
      setEphemeralKey(key);
      
      // Initialize WebRTC with the ephemeral key
      initializeWebRTC(key);
    } catch (err) {
      console.error('Error getting ephemeral key:', err);
      setErrorWithNotification(`Failed to initialize OpenAI voice session: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsConnecting(false);
    }
  };

  // Initialize WebRTC connection with OpenAI
  const initializeWebRTC = async (ephemeralKey: string) => {
    try {
      // Create a session ID for tracking conversation
      const newSessionId = voiceSessionManager.startSession(coachId);
      setSessionId(newSessionId);
      
      // Set up WebRTC connection
      const configuration = { 
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      };
      
      // Create peer connection
      const pc = new RTCPeerConnection(configuration);
      setPeerConnection(pc);
      
      // Create data channel for sending/receiving events
      const dc = pc.createDataChannel('oai-events');
      setDataChannel(dc);
      
      // Set up event handlers for the data channel
      // Use direct property assignment for event handlers
      // @ts-ignore - WebRTC TypeScript definitions don't match exactly
      dc.onopen = () => {
        console.log('Data channel opened');
        
        // Update the session with instructions once connected
        if (dc.readyState === 'open') {
          configureAIInstructions(dc);
        }
      };
      
      // @ts-ignore - WebRTC TypeScript definitions don't match exactly
      dc.onmessage = (event: any) => {
        try {
          const message = JSON.parse(event.data);
          console.log('Received data channel message:', message);
          
          // Handle different types of messages
          if (message.type === 'transcript') {
            handleTranscript(message);
          } else if (message.type === 'message') {
            handleMessage(message);
          }
        } catch (err) {
          console.error('Error parsing data channel message:', err);
        }
      };
      
      // Handle ICE candidates
      // @ts-ignore - WebRTC TypeScript definitions don't match exactly
      pc.onicecandidate = (event: any) => {
        if (event.candidate) {
          console.log('ICE candidate:', event.candidate);
        }
      };
      
      // Handle connection state changes
      // @ts-ignore - WebRTC TypeScript definitions don't match exactly
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setIsConnecting(false);
          setIsListening(true);
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setErrorWithNotification('Connection failed or disconnected');
          setIsConnecting(false);
          setIsListening(false);
        }
      };
      
      // Handle incoming audio tracks
      // @ts-ignore - WebRTC TypeScript definitions don't match exactly
      pc.ontrack = (event: any) => {
        console.log('Received track:', event.track.kind);
        if (event.track.kind === 'audio') {
          // Create a new MediaStream with the received audio track
          const audioStream = new MediaStream([event.track]);
          setAudioOutput(audioStream);
          
          console.log('Audio output stream created');
          
          // On iOS and Android, this MediaStream is automatically routed to the
          // phone's audio output. Due to WebRTC implementation in React Native,
          // the audio will be played through the active audio output (speaker if we set the
          // audio mode with playThroughEarpieceAndroid: false)
        }
      };
      
      // Get access to the microphone
      const userMedia = await mediaDevices.getUserMedia({
        audio: true,
        video: false
      });
      
      setStream(userMedia);
      
      // Add local audio track to the peer connection
      userMedia.getTracks().forEach(track => {
        pc.addTrack(track, userMedia);
      });
      
      // Create and set local description (offer)
      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);
      
      // Send the offer to OpenAI's realtime API
      const sdpResponse = await fetch(`https://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp'
        },
        body: pc.localDescription?.sdp
      });
      
      if (!sdpResponse.ok) {
        throw new Error(`Failed to send SDP: ${sdpResponse.status}`);
      }
      
      // Get the answer SDP from OpenAI
      const answerSdp = await sdpResponse.text();
      
      // Set the remote description with the answer from OpenAI
      const answer = new RTCSessionDescription({
        type: 'answer',
        sdp: answerSdp
      });
      
      await pc.setRemoteDescription(answer);
      
      console.log('WebRTC connection established');
      setIsConnecting(false);
      setIsListening(true);
      
    } catch (err) {
      console.error('WebRTC setup error:', err);
      setErrorWithNotification(`Failed to set up voice chat: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsConnecting(false);
      
      // Check if error is related to API access or model availability
      if (err instanceof Error && 
          (err.message.includes('API') || 
           err.message.includes('key') || 
           err.message.includes('model'))) {
        setFallbackMode(true);
      }
    }
  };

  // Configure AI with appropriate instructions based on coach style and mode
  const configureAIInstructions = (dc: any) => {
    try {
      // Get coach-specific data
      const coachStyle = coachStyles[coachId];
      
      // Generate a prompt similar to what we use in onboardingInterview.ts
      let instructions = '';
      
      if (onboardingMode) {
        instructions = `You are ${coachStyle.name}, a running coach having your first conversation with a new athlete.
  
PERSONALITY: ${coachStyle.personality.join(', ')}
COMMUNICATION STYLE: ${coachStyle.communicationStyle.join(', ')}

MODE: INFORMATION_GATHERING

Start the conversation by warmly greeting the user and introducing yourself. Immediately ask your first question to get started.

Conduct a natural, friendly conversation to collect the following information:
- name
- weekly mileage (km or miles)
- how often they run (days per week)
- any past injuries
- shoe size
- clothing size
- schedule constraints
- preferred unit system (km or miles)
- running experience level
- target race distance (if any)
- upcoming race date (if any)
- running goals

ASK ONE OR TWO QUESTIONS AT A TIME - do not overwhelm the user.
Keep your responses concise and conversational.
When you have collected ALL required information, end by saying "Perfect! I've got all the information I need."
Your final message MUST include the exact phrase "Perfect! I've got all the information I need." for the system to recognize completion.`;
      } else {
        instructions = `You are ${coachStyle.name}, a running coach chatting with an athlete.
  
PERSONALITY: ${coachStyle.personality.join(', ')}
COMMUNICATION STYLE: ${coachStyle.communicationStyle.join(', ')}

Start the conversation with a greeting and introduce yourself.

Keep your responses concise and direct. Answer questions about running, training, and fitness.
Provide specific, actionable advice tailored to the athlete's needs.`;
      }
        
      const event = {
        type: 'session.update',
        session: {
          instructions: instructions
        }
      };
      
      dc.send(JSON.stringify(event));
      console.log('AI instructions configured');
      
      // Send an initial message to trigger the coach to start speaking first
      setTimeout(() => {
        if (dc.readyState === 'open') {
          // Use the correct event type for creating a conversation item
          const startEvent = {
            type: 'conversation.item.create',
            item: {
              role: 'user',
              type: 'message',
              content: [
                {
                  type: 'input_text',
                  text: 'START_CONVERSATION' // This is a hidden trigger, not shown to the user
                }
              ]
            }
          };
          
          dc.send(JSON.stringify(startEvent));
          console.log('Sent initial message to trigger coach greeting');
        }
      }, 1000);
    } catch (err) {
      console.error('Error configuring AI instructions:', err);
    }
  };

  // Helper function to save messages to Supabase
  const saveMessageToSupabase = async (
    sender: 'coach' | 'user',
    message: string,
    source: string,
    userId: string,
    metadata?: any
  ) => {
    try {
      await saveMessage({
        sender,
        message,
        timestamp: new Date().toISOString()
      }, userId);
    } catch (err) {
      console.error('Error saving message to Supabase:', err);
    }
  };

  // Handle transcript messages
  const handleTranscript = (message: any) => {
    if (message.text) {
      const processedText = processVoiceInput(message.text);
      setTranscript(processedText);
      
      // Track transcript in session
      if (sessionId) {
        voiceSessionManager.addTranscript(processedText, 'user', false);
      }
    }
  };

  // Handle complete messages from the assistant
  const handleMessage = (message: any) => {
    if (message.text) {
      // Filter out responses to the START_CONVERSATION trigger
      // Check if the message is a direct response to our hidden trigger
      if (message.text.includes('START_CONVERSATION')) {
        console.log('Filtering out response to START_CONVERSATION trigger');
        return; // Skip this message completely
      }
      
      const messageText = message.text.trim();
      
      if (!messageText) {
        return; // Skip empty messages
      }

      setResponseText(messageText);
      
      // Track coach response
      if (sessionId) {
        voiceSessionManager.addTranscript(messageText, 'coach', true);
      }
      
      // Save to Supabase
      if (userId) {
        const metadata = voiceSessionManager.getSessionMetadata();
        saveMessageToSupabase(
          "coach", 
          messageText, 
          "voice", 
          userId, 
          metadata ? {
            sessionId: metadata.sessionId,
            transcriptTimestamp: Date.now()
          } : undefined
        );
      }
      
      // Check if conversation is complete by looking for the completion phrase
      const completionPhrase = "Perfect! I've got all the information I need";
      const isComplete = messageText.includes(completionPhrase);
      
      console.log('[VOICE_COMPLETION] Checking for completion phrase:', { 
        isComplete, 
        messageTextSnippet: messageText.substring(0, 50) + '...' 
      });
      
      if (isComplete && !conversationComplete) {
        console.log('[VOICE_COMPLETION] Conversation complete detected! Will trigger onboarding completion.');
        setConversationComplete(true);
        
        // Add a brief delay before closing to let the user hear the complete message
        setTimeout(() => {
          // Stop microphone before closing modal
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
          }
          
          console.log('[VOICE_COMPLETION] Closing modal and notifying parent');
          
          // If in onboarding mode, pass the transcript to the onboarding system
          if (onboardingMode && onTranscriptComplete && transcript) {
            onTranscriptComplete(transcript, messageText, true);
          }
          
          // Close the modal after notifying parent component
          handleCloseModal();
        }, 2500);
      } else if (!isComplete && onboardingMode && onTranscriptComplete && transcript) {
        // Still pass intermediate messages for conversation history
        onTranscriptComplete(transcript, messageText, false);
        
        // Reset transcript after sending to parent
        setTranscript('');
      }
    }
  };

  // Clean up when component unmounts or modal closes
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, []);

  const cleanupResources = useCallback(() => {
    console.log('Cleaning up voice chat resources');
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    if (audioOutput) {
      audioOutput.getTracks().forEach(track => track.stop());
      setAudioOutput(null);
    }
    
    if (dataChannel) {
      dataChannel.close();
      setDataChannel(null);
    }
    
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    
    if (sessionId) {
      voiceSessionManager.endSession();
      setSessionId(null);
    }
    
    // Stop InCallManager when cleaning up with null check
    try {
      if (InCallManager && typeof InCallManager.stop === 'function' && inCallManagerInitialized) {
        console.log('Stopping InCallManager in cleanup');
        InCallManager.stop();
        setInCallManagerInitialized(false);
      }
    } catch (err) {
      console.error('Error stopping InCallManager in cleanup:', err);
    }
    
    // Reset state
    setTranscript('');
    setResponseText('');
    setConversationComplete(false);
  }, [stream, audioOutput, dataChannel, peerConnection, sessionId, inCallManagerInitialized]);

  const handleCloseModal = useCallback(() => {
    console.log('Closing voice chat modal');
    cleanupResources();
    onClose();
  }, [cleanupResources, onClose]);
  
  const reconnect = () => {
    cleanupResources();
    setError(null);
    setIsConnecting(false);
    setIsListening(false);
    checkMicrophonePermissions(); // Start the connection process again
  };

  // Handle fallback to text chat
  const handleFallbackToText = () => {
    setFallbackMode(false);
    onClose();
  };

  // Effect to handle auto-closing when conversation is complete
  useEffect(() => {
    if (conversationComplete && onboardingMode) {
      console.log('Conversation complete state changed to true');
    }
  }, [conversationComplete, onboardingMode]);

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleCloseModal}
    >
      <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
        <View className="w-4/5 bg-white rounded-xl p-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold">Voice Coach</Text>
            <TouchableOpacity onPress={handleCloseModal}>
              <FontAwesome name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          {error ? (
            <View className="items-center justify-center py-4">
              <Text className="text-red-500 mb-3">{error}</Text>
              <View className="flex-row">
                <TouchableOpacity 
                  className="bg-blue-500 px-4 py-2 rounded-lg mr-2" 
                  onPress={fallbackMode ? handleFallbackToText : onClose}
                >
                  <Text className="text-white font-semibold">
                    {fallbackMode ? "Use Text Chat" : "Switch to Text"}
                  </Text>
                </TouchableOpacity>
                
                {!fallbackMode && (
                  <TouchableOpacity 
                    className="bg-green-500 px-4 py-2 rounded-lg" 
                    onPress={reconnect}
                  >
                    <Text className="text-white font-semibold">Retry</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <>
              <View className="items-center justify-center my-4">
                {isConnecting ? (
                  <>
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text className="mt-2 text-gray-600">Connecting to voice service...</Text>
                  </>
                ) : isListening ? (
                  <>
                    <View className="w-20 h-20 rounded-full bg-blue-500 justify-center items-center">
                      <FontAwesome name="microphone" size={40} color="#fff" />
                    </View>
                    <Text className="mt-4 text-center text-gray-700">
                      {transcript ? "I'm listening..." : "Speak to your coach"}
                    </Text>
                    {conversationComplete && (
                      <Text className="mt-2 text-green-600 font-bold">
                        Onboarding complete!
                      </Text>
                    )}
                  </>
                ) : null}
              </View>

              {transcript ? (
                <View className="my-2 p-3 bg-gray-100 rounded-lg">
                  <Text className="font-bold mb-1">You said:</Text>
                  <Text>{transcript}</Text>
                </View>
              ) : null}

              {responseText ? (
                <View className="my-2 p-3 bg-blue-100 rounded-lg">
                  <Text className="font-bold mb-1">Coach:</Text>
                  <Text>{responseText}</Text>
                </View>
              ) : null}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default VoiceChat; 