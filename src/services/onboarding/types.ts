import { OnboardingProfile } from '../../types/onboarding';

export interface CoachResponse {
  message: string;
  extractedInfo: Record<string, string | null>;
  completionStatus: {
    missingFields: string[];
    complete: boolean;
  };
  isValid: boolean;
  error?: string;
  completionPhraseDetected?: boolean;
}

export interface ConversationContext {
  coachId: string;
  userProfile: Partial<OnboardingProfile>;
  conversationHistory: {
    role: 'user' | 'coach';
    content: string;
  }[];
}

export interface OnboardingResult {
  extractedProfile: Partial<OnboardingProfile>;
  planGenerationSuccess: boolean;
}

export interface ConversationResult {
  message: string;
  isComplete: boolean;
  conversationHistory: {role: 'user' | 'coach'; content: string}[];
} 