// Export essential onboarding services and types from this barrel file
export * from './onboardingFlow'; // Contains handleOnboardingConversation
export * from './types';          // Contains ConversationContext, ConversationResult, etc.

// Other files like coachPromptBuilder.ts and responseParser.ts are considered
// internal implementation details of onboardingFlow.ts and are not exported here. 