# Voice Chat Implementation

This directory contains utilities and helpers for the real-time voice chat feature.

## Overview

The voice chat implementation uses OpenAI's Realtime API to enable bi-directional audio communication between the user and their AI coach. This implementation follows a dual-mode approach where both voice and text messages are stored in the same Supabase `coach_messages` table, distinguished by a `source` field.

## Key Components

1. **voiceUtils.ts**
   - Utility functions for voice-related operations
   - Permission handling for microphone access
   - Transcript processing and cleanup

2. **voiceSessionManager.ts**
   - Manages voice chat sessions
   - Tracks transcript and message history
   - Provides metadata for Supabase storage

## Supabase Integration

Voice messages are stored in the `coach_messages` table with:
- `source` field set to "voice"
- `metadata` field containing session information, timestamps, etc.

## WebRTC Configuration

The implementation uses OpenAI's RealtimeClient with:
- Open Mic Mode for continuous conversation
- Audio quality settings for better experience
- Error handling and fallback mechanisms

## Fallback Mechanism

The system gracefully degrades to text chat when:
- Microphone permissions are denied
- WebRTC fails to initialize
- OpenAI API key is missing or invalid
- Network issues prevent voice connection

## Usage

```tsx
import { VoiceChat } from '../../components/chat';
import { useVoiceChat } from '../../hooks/useVoiceChat';

// Check if voice chat is available
const { isVoiceChatAvailable } = useVoiceChat();

// Show voice chat modal
<VoiceChat 
  isVisible={showVoiceModal}
  onClose={() => setShowVoiceModal(false)}
  coachId="dathan"
  apiKey={apiKey}
  onError={(error) => console.error(error)}
/>
```

## Requirements

- OpenAI API key with access to GPT-4o and Realtime API
- Microphone permission granted by the user
- Supabase v1 for database operations 