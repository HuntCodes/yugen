# Chat Hooks

This directory contains custom React hooks specific to chat functionality.

## Organization

### Message Hooks
- `useMessageHandling.ts`: Entry point for chat message handling (facade)
- `useMessageFormatting.ts`: Format and style chat messages
- `useMessageProcessing.ts`: Process and parse chat messages
- `useMessageAnalysis.ts`: Analyze message content for insights
- `useMessageStorage.ts`: Store and retrieve chat messages
- `useMessageTypes.ts`: Type definitions for message hooks

### Plan Adjustment Hooks
- `usePlanAdjustment.ts`: Entry point for plan adjustment functionality (facade)
- `useAdjustmentLogic.ts`: Core logic for adjusting training plans
- `useAdjustmentParser.ts`: Parse user messages for plan adjustments
- `useAdjustmentStorage.ts`: Store and retrieve plan adjustments

### Other Hooks
- `useSupabaseChat.ts`: Supabase-specific chat functionality

## When to Add Here

Add hooks here when:
1. They handle chat or message-related state
2. They parse or process chat messages
3. They interact with the chat UI or user inputs in messages

## Guidelines

- All hooks should be organized by concern (storage, processing, etc.)
- Use facade hooks as entry points to simplify imports
- Maintain separation between UI logic and business logic
- Keep hook files under 350 lines by splitting functionality 