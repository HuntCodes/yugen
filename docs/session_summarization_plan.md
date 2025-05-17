# Session Summarization Plan for Token Optimization

## Overview
This document outlines our approach to optimize token usage by summarizing chat sessions instead of maintaining full conversation history. We'll create a hybrid approach that preserves context for specific workout discussions, topic-specific conversations, and general coaching sessions.

## Implementation Details

### 1. Session Definition Framework ✅
We've defined a "session" using a hybrid approach:

- **Workout-specific**: Conversations directly related to a specific workout
- **Topic-specific**: Conversations about a particular running topic within a time frame (e.g., nutrition, injury)
- **General session**: General coaching conversations not tied to a specific workout or topic

### 2. Database Schema ✅
Created a new Supabase table to store session summaries:

```sql
CREATE TABLE session_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  session_id UUID REFERENCES training_sessions(id),
  topic TEXT,
  session_type TEXT NOT NULL CHECK (session_type IN ('workout', 'topic', 'general')),
  summary TEXT NOT NULL,
  note_summary TEXT,
  time_frame TSTZRANGE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster querying by user
CREATE INDEX session_summaries_user_id_idx ON session_summaries(user_id);
```

### 3. Session Identification Algorithm ✅
We've implemented a system to identify session boundaries:

- **Workout-specific**: Identified when conversation includes workout ID or refers to a specific date/workout type
- **Topic-specific**: Identified using NLP to detect when topics change (within 72 hour window)
- **General session**: Default type for conversations that don't fit into above categories

### 4. Summarization Function ✅
Created a service that:
1. Takes the full conversation for a detected session
2. Uses GPT-3.5-turbo to generate a concise summary (~50-100 tokens)
3. Stores the summary in our new table with appropriate metadata

### 5. Session Notes Parser ✅
Implemented a parser that:
1. Extracts key information from workout notes
2. Creates a standardized format for reference
3. Stores parsed notes alongside session summaries

### 6. Context Integration ✅
Modified the chat context to include:
1. Current session details (if applicable)
2. Relevant session summaries based on context
3. Parsed notes for relevant sessions

## Implementation Status

### Completed ✅
1. ✅ Created the `session_summaries` table migration (`/supabase/migrations/20240601000000_add_session_summaries.sql`)
2. ✅ Implemented session detection logic in `identifySessionContext()` function
3. ✅ Created session summarization service (`/src/services/summary/sessionSummaryService.ts`)
4. ✅ Implemented workout notes parser (`/src/services/summary/workoutNoteService.ts`)
5. ✅ Integrated with `useMessageHandling` hook to use summaries instead of full chat history

### Pending Tasks
1. Apply database migration to Supabase instance
2. Test session summarization with various conversation flows
3. Monitor token usage metrics to verify reduction
4. Implement integration with workout notes UI
5. Add error handling for failed summarizations

## Estimated Token Reduction
By summarizing conversations rather than including full history, we expect to reduce token usage by approximately 60-80% in ongoing conversations.

## Integration Points

### Session Summarization
- We consolidate chat history after 10 messages
- Summaries are organized by workout, topic, or general
- Summaries are included in future chats instead of full history

### Workout Notes 
- Notes are summarized when added/updated
- Summaries are attached to workout sessions
- Summaries are included in relevant conversations

### Session Context Management
- Sessions are limited to 3-day windows for topics
- Workout sessions are tied to specific workout IDs
- General sessions are used for miscellaneous coaching

## Next Steps
1. Apply database migration
2. Add session context tracking to TrainingPlanScreen and SessionCard components
3. Create admin dashboard for monitoring token usage
4. Add unit tests for summarization functions
5. Document API for future extension 