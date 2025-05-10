# Onboarding Service

This directory contains the services for the onboarding flow.

## Overview

The onboarding service manages the conversational interview process between the AI coach and the new user. It handles:

1. Natural conversation flow with the user
2. Information extraction from conversations
3. Structured profile creation
4. Conversation state management

## File Structure

- `onboardingInterview.ts` - Main entry point (renamed from naturalCoach.ts)
- `onboardingFlow.ts` - Core conversation flow logic
- `coachPromptBuilder.ts` - Creates prompts for the AI model
- `responseParser.ts` - Parses and processes AI responses
- `onboardingDataFormatter.ts` - Data formatting and normalization utilities
- `types.ts` - TypeScript interfaces and types

## Usage

```typescript
// Import the service
import { onboardingService } from '../services';

// Start a conversation
const result = await onboardingService.handleOnboardingConversation(
  userMessage,
  context
);

// Get coach response with extracted data
const response = await onboardingService.getCoachResponse(
  userMessage,
  context
);

// Process a completed transcript
const profile = await onboardingService.processOnboardingTranscript(
  conversationHistory,
  coachId
);
```

## Refactoring Notes

This module was refactored from the original `naturalCoach.ts` (771 lines) into smaller, more focused files based on the single responsibility principle. The refactoring greatly improves:

- Code organization and maintainability
- Separation of concerns
- Type safety
- Testability

The name was changed from `naturalCoach` to `onboardingInterview` to better reflect its purpose in the application. 