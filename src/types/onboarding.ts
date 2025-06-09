export type ExperienceLevel = string; // How long they've been running (e.g., '6 months', '2 years', 'just started')
export type Units = 'km' | 'miles';

export interface OnboardingProfile {
  nickname: string;
  current_mileage: string;
  current_frequency: string;
  injury_history: string | null;
  shoe_size?: string;
  clothing_size?: string;
  schedule_constraints: string | null;
  units: Units;
  experience_level: ExperienceLevel;
  race_distance: string;
  race_date: string;
  goal_type: string;
  onboarding_completed: boolean;
  coach_id: string;
}

export interface OnboardingQuestion {
  id: string;
  text: string;
  fields: (keyof OnboardingProfile)[];
  nextQuestionId?: string;
  variants?: string[];
  followUps?: string[];
  relatedTopics?: string[];
}

export interface OnboardingState {
  currentQuestionId: string;
  profile: Partial<OnboardingProfile>;
  isComplete: boolean;
}

export interface ChatMessage {
  text: string;
  isUser: boolean;
}
