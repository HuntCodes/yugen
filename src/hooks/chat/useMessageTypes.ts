/**
 * Types for message handling modules
 */

import { WeatherForecast } from '../../services/weather/weatherService';

// Chat state for tracking multi-step interactions
export type ChatState = 'normal' | 'awaiting_plan_confirmation';

// Message type definition to ensure consistency
export interface ChatMessage {
  sender: 'user' | 'coach';
  message: string;
  timestamp?: number; // Added timestamp field for consistency
}

// Base parameters passed to all message handlers
export interface MessageHandlerParams {
  message: string;
  userId: string;
  profile: any;
  trainingPlan: any[];
  weatherData?: WeatherForecast | null;
  onMessageResponse: (message: ChatMessage) => void;
  onPlanAdjusted?: () => void; // Optional callback to signal a successful plan adjustment
}

// Time window for considering messages part of the same session (3 days)
export const SESSION_TIME_WINDOW = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
