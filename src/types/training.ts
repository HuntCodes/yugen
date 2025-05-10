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
  raceDate?: string;
  raceDistance?: string;
  experienceLevel: string;
  trainingFrequency: string;
  trainingPreferences?: string;
  nickname?: string;
  current_mileage?: string;
  injury_history?: string;
  shoe_size?: string;
  clothing_size?: string;
  schedule_constraints?: string;
  units?: string;
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