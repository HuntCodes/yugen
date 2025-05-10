Step-by-Step Implementation Plan for Realtime Voice Coaching

1. Prepare Supabase for Dual-Mode Chat
No schema change is needed, but you'll:
Continue storing messages in coach_messages
This allows your existing summary extractor and plan generator to treat voice and text the same.


2. Set Up Client-Side Voice Chat UI
a. Create a new modal for voice chat
    Add a "Voice Chat" button in the onboarding chat that opens a WebRTC mic session

b. Use OpenAI’s Realtime API SDK

Install:
npm install openai

c. Create client connection to Realtime API
import { RealtimeClient } from "openai";

const client = new RealtimeClient({
  apiKey: "sk-...",
  model: "gpt-4o",
  // WebRTC mic settings
  config: {
    audio: {
      input: { mode: "open-mic" }, // keep mic open
      output: "play-through", // stream assistant speech
    },
  },
});

d. Handle mic stream + assistant replies
await client.connect();

client.on("transcript", (data) => {
  // Live transcript of what user is saying
  // You can update local UI here
});

client.on("message", (message) => {
  // Save assistant response to Supabase
  saveMessageToSupabase("assistant", message.text, "voice");
});


3. Connect Voice Messages to Supabase
Create a utility something like this:

function saveMessageToSupabase(
  role: "user" | "assistant",
  content: string,
  source: "voice" | "text"
) {
  return supabase.from("coach_messages").insert([{ role, content, source }]);
}

You’ll use this inside both:
The client.on("message") (assistant speaking)
A custom "transcript" handler that finalizes user input when they stop speaking


4. Use WebRTC with Open Mic Mode
OpenAI's RealtimeClient handles WebRTC audio streaming internally, so you don’t need to manually set up signaling or STUN/TURN servers.

What you do need:
- Ensure permissions for microphone access are granted
- Enable input: { mode: "open-mic" } in the config
This keeps the mic open between back-and-forth messages.

5. Fallback to Text UI Seamlessly
Your current text UI stays untouched.

If voice setup fails (e.g., no mic, user opts out):
try {
  await client.connect();
} catch (e) {
  // fallback to text chat screen
  navigate("/text-chat");
}

You can also add a toggle in settings:
"Use voice chat as default?" → true/false

6. Periodic Extraction Logic (Unchanged)
Before generating next week:
Your backend still pulls coach_messages
Voice messages are already stored
