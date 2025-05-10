# Refactor Plan 2 - Yugen App

## Overview
This document outlines a systematic plan to refactor the app to improve:
- Code organization and maintainability
- Component reusability
- File size (target: <350 lines per file)
- Separation of concerns
- Type safety
- Performance optimization

## Current State Analysis
Based on the code analysis, the largest files that need refactoring are:

1. `src/lib/utils/trainingUtils.ts` (913 lines)
2. `src/services/onboarding/naturalCoach.ts` (771 lines)
3. `src/screens/main/TrainingPlanScreen.tsx` (539 lines)
4. `src/hooks/chat/usePlanAdjustment.ts` (538 lines)
5. `src/hooks/chat/useMessageHandling.ts` (521 lines)
6. `src/screens/main/ProfileScreen.tsx` (506 lines)
7. `src/screens/main/training/components/SessionCard.tsx` (501 lines)
8. `src/components/chat/VoiceChat.tsx` (478 lines)
9. `src/services/feedback/trainingFeedbackService.ts` (473 lines)
10. `src/lib/api/weeklyPlanGenerator.ts` (455 lines)

## Progress Tracking

### Phase 1: Utils & Services Refactoring
- [x] Refactor `trainingUtils.ts` (913 lines)
  - [x] Create subdirectories in `/lib/utils/training/`
  - [x] Extract `workoutCalculations.ts`
  - [x] Extract `paceConversion.ts`
  - [x] Extract `planAnalysis.ts`
  - [x] Extract `sessionUtils.ts`
  - [x] Create index.ts with barrel exports

- [x] Refactor `naturalCoach.ts` (771 lines) → renamed to `onboardingInterview.ts`
  - [x] Extract `coachPromptBuilder.ts`
  - [x] Extract `responseParser.ts`
  - [x] Extract `onboardingFlow.ts`
  - [x] Create clear interfaces for each module

- [x] Refactor `trainingFeedbackService.ts` (473 lines)
  - [x] Extract `feedbackAnalysis.ts`
  - [x] Extract `feedbackStorage.ts`
  - [x] Extract `feedbackProcessing.ts`

- [x] Refactor `weeklyPlanGenerator.ts` (455 lines)
  - [x] Extract `planTemplates.ts`
  - [x] Extract `planCustomization.ts`
  - [x] Extract `planSuggestions.ts`
  - [x] Extract `planValidation.ts`

### Phase 2: Hook Refactoring
- [x] Refactor `usePlanAdjustment.ts` (538 lines)
  - [x] Extract `useAdjustmentLogic.ts`
  - [x] Extract `useAdjustmentParser.ts`
  - [x] Extract `useAdjustmentStorage.ts`
  - [x] Extract common types to `types.ts`

- [x] Refactor `useMessageHandling.ts` (521 lines)
  - [x] Extract `useMessageFormatting.ts`
  - [x] Extract `useMessageStorage.ts`
  - [x] Extract `useMessageAnalysis.ts`
  - [x] Extract `useMessageProcessing.ts`
  - [x] Extract common types to `useMessageTypes.ts`

### Phase 3: Screen Component Refactoring
- [ ] Refactor `TrainingPlanScreen.tsx` (539 lines)
  - [ ] Extract `PlanHeader.tsx`
  - [ ] Extract `WeekNavigation.tsx`
  - [ ] Extract `PlanSummary.tsx`
  - [ ] Extract `PlanActions.tsx`
  - [ ] Create hook `useTrainingPlanScreen.ts` for business logic

- [ ] Refactor `ProfileScreen.tsx` (506 lines)
  - [ ] Extract `ProfileHeader.tsx`
  - [ ] Extract `ProfileStats.tsx`
  - [ ] Extract `ProfileSettings.tsx`
  - [ ] Extract `ProfileActions.tsx`
  - [ ] Create hook `useProfileScreen.ts` for business logic

- [ ] Refactor `SessionCard.tsx` (501 lines)
  - [ ] Extract `SessionHeader.tsx`
  - [ ] Extract `SessionDetails.tsx`
  - [ ] Extract `SessionControls.tsx`
  - [ ] Create hook `useSessionCard.ts` for business logic

### Phase 4: Code Structure Improvements

#### Component Organization
- [x] Reorganize component structure for better reusability and consistency:
  - [x] Move screen-specific components that could be reused to the main components directory
    - [x] Move `src/screens/onboarding/components/TypeIndicator.tsx` to `src/components/chat/` (as it's similar to the one in main/components)
    - [x] Move `src/screens/onboarding/components/MessageBubble.tsx` to `src/components/chat/`
    - [ ] Consider creating a dedicated `src/components/onboarding/` directory for onboarding-specific UI elements

- [x] Standardize component folder structure:
  - [x] Use a consistent pattern for component organization:
    - `src/components/` - Reusable components shared across the app
    - `src/screens/[section]/components/` - Screen-specific components that are unlikely to be reused elsewhere

#### Duplication Removal
- [x] Identify and consolidate duplicate components:
  - [x] Merge `src/screens/main/components/TypeIndicator.tsx`, `src/screens/onboarding/components/TypeIndicator.tsx`, and `src/components/chat/TypeIndicator.tsx` into a single reusable component
  - [x] Consolidate `MessageList.tsx` and `ChatMessageList.tsx` into a single component with customizable rendering options

#### Utils and Helpers Clean-up
- [x] Clean up utility directories:
  - [x] Consider moving `src/utils/` files to `src/lib/utils/` for consistency
    - [x] Files already duplicated in `src/lib/utils/`, need to remove old `src/utils/` directory
    - [x] Need to update import in `src/lib/api/plan/planSuggestions.ts` to use `src/lib/utils/training` instead of `src/utils/training`
  - [x] Clean up any orphaned or deprecated utils files
    - [x] Remove `src/utils/dateUtils.ts`, `src/utils/trackingUtils.ts`, `src/utils/websocket.js` 
    - [x] Remove `src/utils/index.js` after updating imports

#### Documentation Improvements
- [x] Add or update README files in key directories explaining:
  - [x] The purpose of the directory
  - [x] When to add new files to that directory vs. elsewhere
  - [x] Patterns and conventions to follow
  - [x] Created/updated READMEs for:
    - [x] src/lib/utils/
    - [x] src/lib/utils/training/
    - [x] src/hooks/chat/
    - [x] src/hooks/training/
    - [x] src/services/chat/
    - [x] src/services/plan/
    - [x] src/lib/api/
    - [x] src/navigation/
    - [x] src/context/

#### File Naming Improvements
- [x] Rename generic file names to more descriptive names:
  - [x] Renamed `src/services/onboarding/utils.ts` to `onboardingDataFormatter.ts` to better reflect its purpose
  - [x] Renamed `src/lib/messageUtils.ts` to `src/lib/chatMessagesDb.ts` to clarify its database-centric purpose
  - [x] Removed duplicate `src/lib/utils/messageUtils.ts` to avoid confusion
  - [x] Removed redundant components:
    - [x] Removed `src/components/CoachTypingIndicator.tsx` (consolidated in `TypeIndicator.tsx`)
    - [x] Removed `src/components/ChatBubble.tsx` (consolidated in `chat/ChatBubble.tsx`)
  - [x] Updated all imports to use the new file names