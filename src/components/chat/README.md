# Chat Components

This directory contains all chat-related components used across the app.

- `ChatBubble.tsx` - Renders chat messages from both user and coach
- `TypeIndicator.tsx` - Shows typing animation when the coach is responding
- `VoiceChat.tsx` - Implements real-time voice chat with the coach using OpenAI's Realtime API

## Voice Chat Setup

The voice chat feature requires:

1. An OpenAI API key with access to GPT-4o and the Realtime API
2. Create a `.env` file in the root directory with:
```
EXPO_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here
```
3. Microphone permissions for both iOS and Android (already configured in app.json)

Voice messages are stored in the same Supabase `coach_messages` table as text messages but include a `source` field to differentiate between `voice` and `text` messages.

### Usage

```tsx
import { VoiceChat } from '../../components/chat';

// In your component:
const [showVoiceChat, setShowVoiceChat] = useState(false);

// To show the voice chat modal:
<VoiceChat 
  isVisible={showVoiceChat} 
  onClose={() => setShowVoiceChat(false)}
  coachId="dathan"
  apiKey={process.env.EXPO_PUBLIC_OPENAI_API_KEY || ''}
/>
``` 