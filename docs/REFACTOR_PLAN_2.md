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
  - [ ] Extract `