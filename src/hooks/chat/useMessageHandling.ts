/**
 * @deprecated This file has been refactored. Please use the following modules instead:
 * - useMessageProcessing: Main hook that coordinates the message handling workflow
 * - useMessageFormatting: Functions for formatting messages and prompts
 * - useMessageStorage: Functions for storing messages and summaries
 * - useMessageAnalysis: Functions for analyzing message content and generating responses
 */

import { useMessageProcessing } from './useMessageProcessing';
export { ChatMessage, ChatState } from './useMessageTypes';

export function useMessageHandling() {
  return useMessageProcessing();
}
