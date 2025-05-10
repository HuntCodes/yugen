export interface PlanUpdate {
  week: number;
  date: string;
  session_type: string;
  new_notes?: string;
  new_distance?: number;
  new_time?: number;
  new_date?: string;
} 