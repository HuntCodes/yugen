/**
 * Define the structure for plan updates
 */
export interface PlanUpdate {
  week: number;
  date: string;
  session_type: string;
  new_notes: string;
  new_distance: number;
  new_time: number;
  new_date?: string; // Optional field to handle date changes
}

/**
 * Define the structure for chat messages
 */
export interface ChatMessage {
  sender: 'coach' | 'user';
  message: string;
} 