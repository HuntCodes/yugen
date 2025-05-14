export interface TrainingSession {
  id: string;
  week_number: number;
  day_of_week: number; // 1-7, where 1 is Monday and 7 is Sunday
  date: string;
  session_type: string;
  distance: number;
  time: number;
  notes: string;
  status?: 'completed' | 'not_completed' | 'missed' | 'planned' | 'skipped';
  completed_at?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  modified?: boolean;
  post_session_notes?: string;
  suggested_shoe?: string;
  title?: string;
  description?: string;
  scheduled_date?: string;
  phase?: string;
}

export interface OnboardingData {
  goalType: string;
  raceDistance?: string; // e.g., "5k", "10k", "half_marathon", "marathon", "ultra"
  raceDate?: string; // YYYY-MM-DD
  experienceLevel: string; // e.g., "beginner", "intermediate", "advanced"
  current_mileage: string; // Store as string, e.g. "20"
  trainingFrequency: string; // e.g., "3 days per week"
  units: 'km' | 'miles';
  nickname: string;
  trainingPreferences?: string; // Free text for user preferences
  injury_history?: string;
  schedule_constraints?: string;
  shoe_size?: string;
  clothing_size?: string;
  userStartDate?: string; // YYYY-MM-DD, user's local date at time of onboarding
}

export interface PlanUpdate {
  week: number;
  date: string;
  session_type: string;
  new_notes: string;
  new_distance: number;
  new_time: number;
  new_date?: string;
} 