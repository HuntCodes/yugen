export interface ChatMessage {
  sender: 'coach' | 'user';
  message: string;
  timestamp?: number;
}

export interface ChatHistoryOptions {
  userId: string;
  limit?: number;
}

export interface ChatResponse {
  completion: string;
  error?: string;
} 