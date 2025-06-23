import { Audio } from 'expo-av';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Platform, NativeModules } from 'react-native';
import * as Animatable from 'react-native-animatable';
import InCallManager from 'react-native-incall-manager';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';

import { environment } from '../../config/environment';
import { voiceSessionManager } from '../../lib/voice/voiceSessionManager';
import { supabaseConfig } from '../../lib/config';

interface VoiceCoachingState {
  hasPlayedStartMessage: boolean;
  lastKmSpoken: number;
  hasPlayedEndMessage: boolean;
}

interface RunDetails {
  distance?: number;
  time?: number;
  suggested_location?: string;
  notes?: string;
}

interface TeammateVoiceCoachProps {
  distanceKm: number;
  hasStarted: boolean;
  hasEnded: boolean;
  voiceState: VoiceCoachingState;
  onVoiceStateChange: (newState: VoiceCoachingState) => void;
  runDetails?: RunDetails;
}

// WebRTC constants
const SUPABASE_URL = 'https://tdwtacijcmpfnwlovlxh.supabase.co';
const EPHEMERAL_KEY_ENDPOINT = `${SUPABASE_URL}/functions/v1/ephemeral-key`;
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

// Yared's coaching messages
const COACHING_MESSAGES = {
  start: "Hey! Yared here. I'm excited to run with you today. Let's get after it together!",
  kilometers: [
    "Nice work! You're looking strong out there. Keep that rhythm going.",
    "Great job! You're crushing it. Remember to stay relaxed and breathe easy.",
    "Awesome! You're in a great groove. Trust your training and keep pushing forward.",
    "Fantastic! You're doing amazing. Focus on your form and enjoy the flow.",
    "Incredible work! You're showing real strength. Keep that positive energy going.",
    "Outstanding! You're running like a champion. Stay confident and keep it up.",
    "Brilliant! You're looking smooth and strong. Trust the process and keep going.",
    "Excellent! You're in the zone now. Maintain that focus and rhythm.",
  ],
  end: "What a run! You absolutely crushed that. Take some time to cool down and hydrate. You should be proud of that effort!"
};

interface RTCMessageEvent {
  data: string;
  target: RTCDataChannel;
}

interface RTCPeerConnectionIceEvent {
  candidate: RTCIceCandidate | null;
}

const TeammateVoiceCoach: React.FC<TeammateVoiceCoachProps> = ({
  distanceKm,
  hasStarted,
  hasEnded,
  voiceState,
  onVoiceStateChange,
  runDetails,
}) => {
  // State for WebRTC connection
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for WebRTC
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<any | null>(null);
  const ttsPlayerRef = useRef<Audio.Sound | null>(null);
  const ephemeralKeyRef = useRef<string | null>(null);
  const cleanupScheduledRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioStreamRef = useRef<MediaStream | null>(null);
  const isResponseActiveRef = useRef(false);

  // Initialize WebRTC connection
  const initializeWebRTC = useCallback(async () => {
    try {
      // Check if we can start a session
      if (!voiceSessionManager.canStartSession('daily')) {
        console.log('[TeammateVoiceCoach] Another voice session is active, skipping initialization');
        return;
      }

      console.log('[TeammateVoiceCoach] Initializing WebRTC connection...');
      console.log('[TeammateVoiceCoach] Supabase URL:', SUPABASE_URL);
      console.log('[TeammateVoiceCoach] Supabase anon key:', supabaseConfig.anonKey ? 'Present' : 'Missing');
      setIsLoading(true);
      setError(null);

      // Configure audio session for WebRTC
      try {
        InCallManager.stop();
                 await new Promise<void>(resolve => setTimeout(resolve, 100));
        InCallManager.setForceSpeakerphoneOn(true);
        
        const { RTCAudioSession } = NativeModules;
        if (RTCAudioSession && Platform.OS === 'ios') {
          try {
            await RTCAudioSession.setActive(true);
            console.log('[TeammateVoiceCoach] RTCAudioSession is actively managing audio session');
          } catch (sessionError) {
            console.log('[TeammateVoiceCoach] RTCAudioSession activation handled automatically');
          }
        }
      } catch (audioError) {
        console.warn('[TeammateVoiceCoach] Audio configuration warning:', audioError);
      }

      // Get ephemeral key (configuration will be done via session.update after connection)
      console.log('[TeammateVoiceCoach] Fetching ephemeral key from:', EPHEMERAL_KEY_ENDPOINT);
      const requestBody = {
        model: 'gpt-4o-realtime-preview',
        voice: 'verse',
      };
      console.log('[TeammateVoiceCoach] Request body:', requestBody);
      
      const response = await fetch(EPHEMERAL_KEY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          apikey: supabaseConfig.anonKey,
          Authorization: `Bearer ${supabaseConfig.anonKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[TeammateVoiceCoach] Ephemeral key request failed:', response.status, errorText);
        throw new Error(`Failed to get ephemeral key: ${response.status}`);
      }

      const data = await response.json();
      console.log('[TeammateVoiceCoach] Ephemeral key response:', data);
      
      const key = data.client_secret?.value;
      if (!key) {
        throw new Error('No ephemeral key received from response');
      }
      
      ephemeralKeyRef.current = key;

      // Start voice session
      const sessionId = voiceSessionManager.startSession('yared', 'daily');
      console.log('[TeammateVoiceCoach] Started voice session:', sessionId);

      // Set up WebRTC connection
      const configuration = { iceServers: ICE_SERVERS };
      const pc = new RTCPeerConnection(configuration);
      peerConnectionRef.current = pc;

      // Get local media stream for audio (required for WebRTC, but we'll mute it)
      console.log('[TeammateVoiceCoach] Getting user media...');
      const stream = await mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } as any,
        video: false,
      });
      console.log('[TeammateVoiceCoach] Got local media stream');

      // Immediately disable all audio tracks since we don't want user input
      stream.getAudioTracks().forEach(track => {
        track.enabled = false;
        console.log('[TeammateVoiceCoach] Disabled audio track for output-only mode');
      });

      localStreamRef.current = stream;

      // Add tracks from local stream to peer connection
      stream.getTracks().forEach((track) => {
        if (pc) {
          pc.addTrack(track, stream);
          console.log('[TeammateVoiceCoach] Added track to peer connection:', track.kind);
        }
      });

      // Create data channel
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      // Set up data channel handlers
      // @ts-ignore - Using onopen instead of addEventListener for compatibility
      dc.onopen = async () => {
        console.log('[TeammateVoiceCoach] Data channel opened');
        setIsConnected(true);
        setIsLoading(false);
        
        // Configure AI for teammate coaching
        if (dc.readyState === 'open') {
          await configureTeammateAI(dc);
        }
      };

      // @ts-ignore - Using onmessage instead of addEventListener for compatibility
      dc.onmessage = (event: RTCMessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          handleWebRTCMessage(data);
        } catch (e) {
          console.error('[TeammateVoiceCoach] Error parsing WebRTC message:', e);
        }
      };

      // @ts-ignore - Using onerror instead of addEventListener for compatibility
      dc.onerror = (error: any) => {
        console.error('[TeammateVoiceCoach] Data channel error:', error);
        setError('Connection error occurred');
      };

      // @ts-ignore - Using onclose instead of addEventListener for compatibility
      dc.onclose = () => {
        console.log('[TeammateVoiceCoach] Data channel closed');
        setIsConnected(false);
      };

      // Set up peer connection handlers
      // @ts-ignore - Using onicecandidate instead of addEventListener for compatibility
      pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate) {
          console.log('[TeammateVoiceCoach] ICE candidate generated');
        }
      };

      // @ts-ignore - Using onconnectionstatechange instead of addEventListener for compatibility
      pc.onconnectionstatechange = () => {
        console.log('[TeammateVoiceCoach] Connection state:', pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setError('Connection lost');
          cleanup();
        }
      };

      // @ts-ignore - Handle remote audio tracks for speaker output
      pc.ontrack = (event: any) => {
        console.log(`[TeammateVoiceCoach] Received track: ${event.track.kind}`);
        if (event.track.kind === 'audio') {
          console.log('[TeammateVoiceCoach] Audio track received - setting up for automatic playback');
          
          // Create MediaStream with the received audio track
          const audioStream = new MediaStream([event.track]);
          remoteAudioStreamRef.current = audioStream;
          
          console.log('[TeammateVoiceCoach] Remote audio stream created and stored');

          // Force speaker output using InCallManager
          InCallManager.setForceSpeakerphoneOn(true);
          console.log('[TeammateVoiceCoach] Speaker mode configured through InCallManager');

          // Additional speaker mode reinforcement after a delay
          setTimeout(() => {
            console.log('[TeammateVoiceCoach] Re-applying speaker mode after delay');
            InCallManager.setForceSpeakerphoneOn(true);
          }, 500);
        }
      };

      // Create offer and set up connection
      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);

      // Connect to OpenAI Realtime API - Updated to match DailyVoiceChat implementation
      console.log('[TeammateVoiceCoach] Sending SDP offer to OpenAI...');
      const sdpResponse = await fetch(
        'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ephemeralKeyRef.current}`,
            'Content-Type': 'application/sdp',
          },
          body: pc.localDescription?.sdp,
        }
      );

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text().catch(() => '');
        console.error(
          `[TeammateVoiceCoach] API response error: ${sdpResponse.status} - ${errorText}`
        );
        throw new Error(
          `Failed to send SDP: ${sdpResponse.status}${errorText ? ' - ' + errorText : ''}`
        );
      }

      // Get the answer SDP from OpenAI
      console.log('[TeammateVoiceCoach] Received SDP answer from OpenAI');
      const answerSdp = await sdpResponse.text();

      // Set the remote description with the answer from OpenAI
      console.log('[TeammateVoiceCoach] Setting remote description...');
      const answer = new RTCSessionDescription({
        type: 'answer',
        sdp: answerSdp,
      });

      await pc.setRemoteDescription(answer);
      console.log('[TeammateVoiceCoach] Set remote description');

      console.log('[TeammateVoiceCoach] WebRTC connection established');

    } catch (error) {
      console.error('[TeammateVoiceCoach] WebRTC initialization failed:', error);
      setError(error instanceof Error ? error.message : 'Connection failed');
      setIsLoading(false);
      cleanup();
    }
  }, []);

  // Configure AI for teammate coaching
  const configureTeammateAI = useCallback(async (dc: any) => {
    if (dc && dc.readyState === 'open') {
      // Build comprehensive Yared Nuguse coaching instructions
      const fullInstructions = `You are Yared Nuguse, the professional middle-distance runner and Olympic medalist from the USA. You're running alongside the user as their training partner and motivational coach during their workout.

## Your Identity:
- Professional middle-distance runner, Olympic 1500m medalist, sponsored by On.

## Your Role During This Run:
- You are literally running alongside them as their teammate
- Provide encouraging, authentic coaching based on your professional experience
- Share brief insights from your elite running career when relevant
- Keep messages SHORT and energetic (1-2 sentences max) since they're actively running
- Match the intensity and energy of someone running alongside them
- Be supportive but authentic to your competitive nature

## Voice Characteristics:
- Speak with confidence and energy, like you're actually running
- Use a pace that matches someone running (slightly breathless but clear)
- Be encouraging but not overly enthusiastic - you're a professional athlete
- Sound like you're genuinely running with them, not just talking at them
- Keep it conversational and natural, like a training partner would

## Key Guidelines:
- ALWAYS keep responses very brief (1-2 sentences max)
- Focus on encouragement, pacing, form, or mindset
- Occasionally reference your professional experience when it helps
- Be authentic to your personality as an elite athlete
- Remember you're running WITH them, not just coaching from the sidelines

Respond naturally and authentically as Yared Nuguse would during a training run.`;

      // Send the comprehensive instructions update - configured for OUTPUT-ONLY mode
      const sessionUpdateEvent = {
        type: 'session.update',
        session: {
          instructions: fullInstructions,
          input_audio_transcription: null, // DISABLE user input transcription completely
          turn_detection: null, // DISABLE turn detection - we don't want user input
          tools: [],
          tool_choice: 'none',
          temperature: 0.8,
          voice: 'verse',
          modalities: ['audio', 'text'], // Valid combination per OpenAI docs
        },
      };

      dc.send(JSON.stringify(sessionUpdateEvent));
      console.log('[TeammateVoiceCoach] Comprehensive AI configuration sent for OUTPUT-ONLY mode');
      
      // Log the instructions being sent for debugging
      console.log('[TeammateVoiceCoach] Instructions sent to AI:');
      console.log('=====================================');
      console.log(fullInstructions);
      console.log('=====================================');
    }
  }, []);

  // Handle WebRTC messages
  const handleWebRTCMessage = useCallback((data: any) => {
    if (data.type === 'error') {
      console.error('[TeammateVoiceCoach] API error:', data.error);
      setError(`API error: ${data.error?.message || 'Unknown error'}`);
    } else if (data.type === 'session.created' || data.type === 'session.updated') {
      console.log('[TeammateVoiceCoach] Session ready:', data.type);
    } else if (data.type === 'response.audio.delta') {
      // Handle audio chunks - this is the real audio from OpenAI
      if (data.delta) {
        // Audio is now handled automatically via WebRTC ontrack
        console.log('[TeammateVoiceCoach] Received audio delta - playing via WebRTC');
      }
    } else if (data.type === 'response.audio.done') {
      console.log('[TeammateVoiceCoach] Audio response completed');
      setIsSpeaking(false);
      isResponseActiveRef.current = false;
    } else if (data.type === 'response.created') {
      console.log('[TeammateVoiceCoach] Response started');
      setIsSpeaking(true);
      isResponseActiveRef.current = true;
    } else if (data.type === 'response.done') {
      console.log('[TeammateVoiceCoach] Response completed');
      setIsSpeaking(false);
      isResponseActiveRef.current = false;
    }
  }, []);

  // Play TTS audio
  const playTTSAudio = useCallback(async (base64Audio: string) => {
    try {
      if (ttsPlayerRef.current) {
        await ttsPlayerRef.current.unloadAsync();
      }

      console.log('[TeammateVoiceCoach] Playing audio chunk...');
      InCallManager.setForceSpeakerphoneOn(true);

      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/pcm;base64,${base64Audio}` },
        {
          shouldPlay: true,
          volume: 0.8,
          progressUpdateIntervalMillis: 100,
        }
      );
      ttsPlayerRef.current = sound;

      await sound.playAsync();
    } catch (error) {
      console.error('[TeammateVoiceCoach] TTS playback error:', error);
    }
  }, []);

  // Send message to AI
  const sendMessage = useCallback((message: string) => {
    if (dataChannelRef.current?.readyState === 'open' && !isResponseActiveRef.current) {
      const event = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: message,
            },
          ],
        },
      };

      dataChannelRef.current.send(JSON.stringify(event));
      
      // Trigger response
      const responseEvent = { type: 'response.create' };
      dataChannelRef.current.send(JSON.stringify(responseEvent));
      
      console.log('[TeammateVoiceCoach] Sent message to AI:', message);
      isResponseActiveRef.current = true;
    } else if (isResponseActiveRef.current) {
      console.log('[TeammateVoiceCoach] Skipping message - response already active:', message);
    }
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (cleanupScheduledRef.current) return;
    cleanupScheduledRef.current = true;

    console.log('[TeammateVoiceCoach] Performing cleanup...');

    try {
      // Stop TTS
      if (ttsPlayerRef.current) {
        ttsPlayerRef.current.unloadAsync().catch(console.warn);
        ttsPlayerRef.current = null;
      }

      // Stop local media stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('[TeammateVoiceCoach] Stopped media track:', track.kind);
        });
        localStreamRef.current = null;
      }

      // Clean up remote audio stream
      if (remoteAudioStreamRef.current) {
        remoteAudioStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('[TeammateVoiceCoach] Stopped remote audio track:', track.kind);
        });
        remoteAudioStreamRef.current = null;
      }

      // Close data channel
      if (dataChannelRef.current) {
        dataChannelRef.current.close();
        dataChannelRef.current = null;
      }

      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      // End voice session
      voiceSessionManager.endSession();

      // Reset audio
      InCallManager.stop();

    } catch (error) {
      console.warn('[TeammateVoiceCoach] Cleanup error:', error);
    } finally {
      setIsConnected(false);
      setIsSpeaking(false);
      setIsLoading(false);
      cleanupScheduledRef.current = false;
    }
  }, []);

  // Initialize connection when component mounts
  useEffect(() => {
    initializeWebRTC();
    return cleanup;
  }, [initializeWebRTC, cleanup]);

  // Handle coaching triggers
  useEffect(() => {
    if (!isConnected || !hasStarted) return;

    // Start message (2 seconds after run begins)
    if (!voiceState.hasPlayedStartMessage) {
      setTimeout(() => {
        if (hasStarted && !hasEnded) {
          // Build dynamic introduction message with run details
          let intro = "Introduce yourself as Yared Nuguse and say hello to the user. Tell them you're wearing the cloudmonster's today, and that you'll be with them for the whole run.";

          if (runDetails?.distance) {
            intro += ` We're running ${runDetails.distance} kilometers today.`;
          }
          if (runDetails?.time) {
            intro += ` It should take about ${runDetails.time} minutes.`;
          }
          if (runDetails?.suggested_location) {
            intro += ` We'll be in ${runDetails.suggested_location}.`;
          }
          if (runDetails?.notes) {
            intro += ` Note: ${runDetails.notes}.`;
          }

          intro += " Be calm but excited.";

          sendMessage(intro);
          onVoiceStateChange({
            ...voiceState,
            hasPlayedStartMessage: true,
          });
        }
      }, 1000);
    }

    // Kilometer messages
    const currentKm = Math.floor(distanceKm);
    if (currentKm > voiceState.lastKmSpoken && currentKm > 0 && !hasEnded) {
      const kmMessage = `I just finished ${currentKm} kilometer${currentKm > 1 ? 's' : ''}!`;
      sendMessage(kmMessage);
      onVoiceStateChange({
        ...voiceState,
        lastKmSpoken: currentKm,
      });
    }

    // End message
    if (hasEnded && !voiceState.hasPlayedEndMessage && isConnected) {
      setTimeout(() => {
        sendMessage("I just finished my run! Give me a single phrase to finish, just a few words.");
        onVoiceStateChange({
          ...voiceState,
          hasPlayedEndMessage: true,
        });
        
        // Cleanup after end message
        setTimeout(cleanup, 5000);
      }, 1000);
    }
  }, [distanceKm, hasStarted, hasEnded, voiceState, isConnected, sendMessage, onVoiceStateChange, cleanup, runDetails]);

  // Previously rendered a status bar overlay with speaking/connecting info.
  // The UI overlay has been removed per design update, but audio/webRTC logic remains functional.

  return null;
};

export default TeammateVoiceCoach; 