# Token Optimization Implementation

## Overview
This document provides a technical overview of the token optimization implementation for the AI-powered run club app. The goal was to reduce token usage in AI interactions by summarizing session conversations and workout notes instead of maintaining full conversation history.

## Key Components

### 1. Database Schema
We've created two separate tables in Supabase to better organize our data:

#### chat_summaries Table
```sql
CREATE TABLE chat_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  topic TEXT,
  chat_type TEXT NOT NULL CHECK (chat_type IN ('topic', 'general', 'workout')),
  related_workout_id UUID REFERENCES training_plans(id),
  summary TEXT NOT NULL,
  time_frame TSTZRANGE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### workout_note_summaries Table
```sql
CREATE TABLE workout_note_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  workout_id UUID REFERENCES training_plans(id) NOT NULL,
  summary TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

These tables store:
- **Chat summaries**: Condensed summaries of conversation segments
- **Workout note summaries**: Extracted key points from workout notes
- **Session metadata**: Type (workout/topic/general), user ID, time frame, etc.

### 2. Chat Summary Service
- `/src/services/summary/chatSummaryService.ts`

Key functions:
- `createChatSummary`: Generates AI summaries of conversations
- `saveChatSummary`: Stores summaries in the database
- `getRelevantChatSummaries`: Retrieves summaries for context
- `identifyChatContext`: Analyzes conversations to determine chat type/topic

### 3. Workout Note Service
- `/src/services/summary/workoutNoteService.ts`

Key functions:
- `createWorkoutNoteSummary`: Generates concise summaries of workout notes
- `processWorkoutNotes`: Handles note updates and summary generation
- `getWorkoutNoteSummary`: Retrieves summaries for a specific workout

### 4. Message Handling Integration
- `/src/hooks/chat/useMessageHandling.ts`

The message handling hook was updated to:
- Use the new chat summary service
- Generate summaries after 10 messages
- Include summaries in AI context for better continuity
- Use GPT-3.5 Turbo for better cost efficiency

### 5. Migration Utilities
- `/src/services/summary/migrationHelper.ts`

Provides tools to:
- Migrate data from the old session_summaries table
- Verify successful migration
- Handle the transition period

## Benefits of the Implementation

1. **Reduced Token Usage**
   - Summarization condenses long message history
   - Only relevant summaries are included in context
   - Next 5 workouts only in plan context (reduced from 10)
   - Using GPT-3.5 for daily coaching (cheaper than GPT-4)

2. **Improved User Experience**
   - More focused, relevant coaching responses
   - Maintains conversation continuity without token limits
   - Reduced API costs enable more interactions

3. **Enhanced Data Organization**
   - Separated chat and workout note concerns
   - Better schema for different types of data
   - Improved query performance

## Next Steps

1. **Weekly Training Plan Integration**
   - As outlined in `/docs/weekly_plan_optimization.md`
   - Generate plans based on workout summaries and chat feedback
   - Create weekly refresh cycle for more adaptability

2. **Usage Monitoring**
   - Track token usage reductions
   - Monitor summary quality and relevance
   - Adjust summarization frequency if needed

## How to Use

The implementation is transparent to users. The system automatically:
1. Tracks conversations
2. Creates summaries after sufficient messages
3. Summarizes workout notes when added
4. Retrieves relevant summaries for context

No user action is required to benefit from these optimizations 