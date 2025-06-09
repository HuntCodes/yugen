export interface TrainingSession {
  id: string;
  week_number: number;
  day_of_week: number; // 1-7, where 1 is Monday and 7 is Sunday
  session_type: string;
  date: string;
  distance: number;
  distance_unit?: string;
  time: number;
  notes: string;
  status: 'completed' | 'skipped' | 'missed' | 'planned' | 'not_completed';
  modified?: boolean;
  post_session_notes?: string;
  suggested_shoe?: string;
  suggested_location?: string; // AI-suggested training location
  title?: string;
  description?: string;
  scheduled_date?: string;
}

export type SessionStatus = 'completed' | 'missed' | 'planned' | 'not_completed' | 'skipped';
