# Voice Onboarding Implementation

This document explains the implementation of OpenAI's Realtime API for voice-based onboarding in the run coaching app.

## Overview

The voice onboarding flow allows users to speak directly with their AI coach during the onboarding process. Key components:

1. **VoiceOnboarding Screen**: Provides a dedicated UI for voice interaction
2. **VoiceChat Component**: Handles WebRTC communication with OpenAI's Realtime API
3. **Supabase Edge Function**: Securely provides ephemeral keys for OpenAI authentication

## Flow

1. User selects a coach in the CoachSelect screen
2. User is directed to VoiceOnboarding screen showing coach's headshot
3. Voice chat begins automatically if available (or user presses "Talk to your coach")
4. Coach initiates the conversation with a greeting and first question
5. When conversation completes, microphone turns off and Continue button appears
6. User presses Continue to generate training plan and move to the main app

## Technical Details

### Supabase Edge Function

The app doesn't directly use the OpenAI API key. Instead, it requests ephemeral keys from a Supabase Edge Function:

```
${supabaseUrl}/functions/v1/ephemeral-key
```

Parameters:
- `model`: 'gpt-4o-mini-realtime-preview'
- `voice`: 'verse'

### Conversation Completion Detection

The voice chat detects completion when the coach says: "Perfect! I've got all the information I need."
This phrase is explicitly included in the AI instructions and triggers conversation completion.

### Coach Conversation Initiation

The coach begins speaking first by:
1. Setting explicit instructions to start with a greeting
2. Sending a hidden 'START_CONVERSATION' trigger message that gets filtered out

## Troubleshooting

### "Error getting ephemeral key: Network request failed"

Possible causes:
- Environment variables not properly configured (.env file issues)
- Supabase Edge Function unavailable or returning errors
- Network connectivity issues

Solutions:
- Check that .env file contains `EXPO_PUBLIC_SUPABASE_URL`
- Verify Supabase Edge Function deployment and logs
- Test network connectivity and API access

### Voice Chat Not Starting

Possible causes:
- Microphone permission issues
- WebRTC initialization failures
- OpenAI API key issues in the Supabase Edge Function

Solutions:
- Verify microphone permissions are granted
- Check console logs for WebRTC connection errors
- Ensure Supabase Edge Function has valid OpenAI API key with access to Realtime API

### Conversation Not Completing

Possible causes:
- Coach's response doesn't include the exact completion phrase
- WebRTC connection drops during conversation
- Errors in handling completion detection

Solutions:
- Verify AI instructions include the exact completion phrase
- Check for WebRTC connection stability issues
- Review logs for errors in the handleMessage function

## Environment Setup

The voice functionality requires these environment variables:

```
EXPO_PUBLIC_OPENAI_API_KEY=sk-... (for the Supabase Edge Function)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Fallbacks

The system provides fallbacks when voice chat isn't available:
- A "use chat messaging instead" button to switch to text-based onboarding
- Automatic fallback to text chat if voice initialization fails
- Error messaging explaining why voice might be unavailable 