export interface ChatMessage {
  sender: 'coach' | 'user';
  message: string;
}

export interface ChatHistoryOptions {
  userId: string;
  limit?: number;
}

export interface ChatResponse {
  completion: string;
  error?: string;
} 