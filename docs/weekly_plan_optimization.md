# Weekly Training Plan Optimization

## Overview

This document outlines a strategy to improve the training plan system by:
1. Generating training plans one week at a time instead of multiple weeks
2. Incorporating chat_summaries and workout_note_summaries as feedback for future plan generation
3. Creating a shorter feedback loop between user activity and plan adjustments

## Current Implementation

Currently, the training plan generation:
- Creates multiple weeks of training at once
- Uses only the initial onboarding information
- Doesn't systematically incorporate ongoing user feedback
- Doesn't leverage the rich data from session summaries

## Implementation Progress

### ✅ Phase 1: Summary Tables & Services (Completed)

We've successfully implemented the foundation for feedback-informed training:

1. **Data Storage**
   - Created `chat_summaries` table for storing conversation insights
   - Created `workout_note_summaries` table for workout feedback
   - Implemented database indexes and security policies

2. **Summary Services**
   - Created `chatSummaryService.ts` to handle chat summaries
   - Created `workoutNoteService.ts` to handle workout notes
   - Implemented AI-powered summarization using GPT-3.5

3. **Integration with Daily Coaching**
   - Updated `useMessageHandling.ts` to:
     - Use GPT-3.5 for daily chat (more cost-effective)
     - Limit training plan context to 5 upcoming workouts
     - Include relevant chat summaries in coaching context
     - Generate and store summaries after 10 messages

4. **Data Migration**
   - Created migration utilities in `migrationHelper.ts`
   - Implemented verification tools for data integrity

### ✅ Phase 2: Weekly Plan Generation (Completed)

We have successfully implemented the feedback-informed weekly training plan generation:

1. **Weekly Plan Generation**
   - Created `weeklyPlanGenerator.ts` which generates plans until the next Sunday
   - Implemented a system that uses chat summaries and workout notes as input
   - Added functions to analyze workout completion patterns and commonly skipped workouts
   - Updated prompts to reference all relevant feedback when generating plans

2. **Plan Refresh Service**
   - Created `weeklyPlanService.ts` to handle automatic weekly refreshes
   - Added `checkNeedsRefresh()` to determine when a plan should be updated
   - Implemented `refreshWeeklyPlan()` to generate and save new weekly plans
   - Created a script for automatic refreshes (`refreshWeeklyPlans.ts`)

3. **UI Integration**
   - Updated `TrainingPlanScreen.tsx` to:
     - Display next scheduled refresh date
     - Removed manual refresh option to maintain training integrity
     - Show appropriate loading and confirmation dialogs
     - Handle edge cases like outdated plan dates

4. **Full Feedback Loop**
   - Plans now incorporate:
     - Recent chat summaries
     - Workout note summaries
     - Completion statistics
     - Adaptation based on commonly skipped workout types
     - Proper difficulty progression based on user performance

## Results and Benefits

The implementation of weekly plan generation with feedback integration provides:

1. **More Responsive Training**
   - Plans adapt weekly based on user feedback and completion patterns
   - Commonly skipped workouts are modified to be more manageable
   - Progressive overload is applied based on actual performance

2. **Better User Experience**
   - Training feels more personalized and adaptive
   - Users see direct results from their feedback through conversation with the coach
   - UI shows when plans will automatically refresh
   - Changes to training plans happen through coach conversations, not manual refreshes

3. **Improved Plan Compliance**
   - By adapting to user behavior, plan compliance should improve
   - Plans that respond to feedback feel more "coach-like"
   - Making workouts more achievable improves consistency

## Future Enhancements

For future development phases, consider:

1. **Personal Records Tracking**
   - Track personal records and incorporate them into plan generation
   - Celebrate PRs in the UI and through coach messaging

2. **Recovery Detection**
   - Implement advanced detection of recovery needs
   - Add recovery-focused sessions when patterns indicate fatigue

3. **Race-Specific Peaking**
   - Enhance race preparation with specialized taper periods
   - Add race week specificity based on target race

4. **Training Analytics**
   - Create a visual dashboard of training progress
   - Show adaptation patterns and improvement over time

## Implementation Details

The implementation creates a complete feedback loop where user conversations and workout summaries inform the next week's training plan:

1. User completes workouts and provides feedback
2. System summarizes workout notes and conversations
3. Weekly plan generator accesses these summaries
4. Generator creates adaptive plans based on patterns and feedback
5. New plan is delivered to the user with appropriate adaptations

## Proposed Changes

### 1. Weekly Plan Generation

Instead of generating multi-week plans upfront, we'll:
- Generate only until the next Sunday (including Sunday) of training at a time
- Refresh the plan automatically each Sunday morning for the new week ahead (in the user's local time).

### 2. Feedback-Informed Training

We'll enhance the plan generation by incorporating:
- Summaries of recent chat conversations (now available in `chat_summaries`)
- Workout note summaries from completed sessions (now available in `workout_note_summaries`)
- Performance trends (completion rates, modifications)
- Detected recovery needs or injury concerns

### 3. Implementation Steps

#### A. Modify Plan Generation API

Update `/src/lib/api/openai.ts` to:
- Access workout_note_summaries and chat_summaries as input (tables and services now ready)
- Generate only a single week of training
- Take recent performance into account
- Include more context-specific adaptations

#### B. UI Integration

Automatically refresh service Sunday morning of the user's local time for the following Monday through Sunday.

### 4. Benefits

This approach will:
- Create more personalized and responsive training plans
- Adapt to the user's actual performance, not just their initial preferences
- Provide timely adjustments based on recent feedback
- Reduce the need for manual plan adjustments
- Improve user satisfaction through more accurate training loads

### 5. Potential Challenges

- Handling of long-term progression (solved by retaining overall progress trajectory)
- Ensuring consistency when training for specific events (solved by maintaining race goal context)
- Balancing short-term adaptations with long-term training principles

## Next Steps

1. Implement the enhanced OpenAI prompt in training plan generation that utilizes our new tables:
   ```typescript
   // In openai.ts:
   // Add code to fetch and include relevant summaries
   const chatSummaries = await getRelevantChatSummaries(userId, null, null, 5);
   const workoutNoteSummaries = await getWorkoutNoteSummariesForUser(userId, 5);
   
   // Include these in the system prompt
   const summariesContext = formatSummariesForContext(chatSummaries, workoutNoteSummaries);
   ```

2. Create the weekly plan refresh service that runs on a schedule

3. Update UI to show plan refresh status and controls

4. Add automatic weekly refresh mechanism

5. Test with various user profiles and feedback scenarios

## SQL of the summaries tables

-- Create chat_summaries table
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

-- Create workout_note_summaries table
CREATE TABLE workout_note_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  workout_id UUID REFERENCES training_plans(id) NOT NULL,
  summary TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX chat_summaries_user_id_idx ON chat_summaries(user_id);
CREATE INDEX chat_summaries_related_workout_id_idx ON chat_summaries(related_workout_id);
CREATE INDEX workout_note_summaries_user_id_idx ON workout_note_summaries(user_id);
CREATE INDEX workout_note_summaries_workout_id_idx ON workout_note_summaries(workout_id);

-- Add RLS policies for security

-- For chat_summaries
ALTER TABLE chat_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_summaries_select_policy ON chat_summaries 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY chat_summaries_insert_policy ON chat_summaries 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY chat_summaries_update_policy ON chat_summaries 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY chat_summaries_delete_policy ON chat_summaries 
  FOR DELETE USING (auth.uid() = user_id);

-- For workout_note_summaries
ALTER TABLE workout_note_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY workout_note_summaries_select_policy ON workout_note_summaries 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY workout_note_summaries_insert_policy ON workout_note_summaries 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY workout_note_summaries_update_policy ON workout_note_summaries 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY workout_note_summaries_delete_policy ON workout_note_summaries 
  FOR DELETE USING (auth.uid() = user_id);