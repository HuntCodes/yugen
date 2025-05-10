import { useState } from 'react';
import { PlanUpdate, ChatMessage } from '../chat/types';
import { useAdjustmentParser } from './useAdjustmentParser';
import { useAdjustmentStorage } from './useAdjustmentStorage';

export function useAdjustmentLogic() {
  // State to track the current adjustment request
  const [pendingAdjustment, setPendingAdjustment] = useState<PlanUpdate | null>(null);
  
  // Get parser and storage functions
  const {
    parseAdjustmentMessage,
    generatePlanAdjustment,
    generateConfirmationMessage
  } = useAdjustmentParser();
  
  const {
    applyPlanChangeToSupabase,
    testDatabasePermissions
  } = useAdjustmentStorage();

  /**
   * Handle an incoming message to check if it's related to plan adjustments
   */
  const handleMessage = async (
    message: string,
    userId: string,
    profile: any,
    trainingPlan: any[],
    onMessageResponse: (message: ChatMessage) => void
  ): Promise<boolean> => {
    // Parse the message to determine the type of adjustment
    const parsedMessage = parseAdjustmentMessage(message);
    
    // If there's a pending adjustment, check if this message confirms or rejects it
    if (pendingAdjustment) {
      if (parsedMessage.type === 'confirm') {
        // Apply the pending adjustment
        const success = await applyPlanChangeToSupabase(pendingAdjustment, userId);
        
        if (success) {
          // Send confirmation message
          const confirmationMessage = generateConfirmationMessage(pendingAdjustment);
          onMessageResponse({
            sender: 'coach',
            message: confirmationMessage
          });
        } else {
          // Send error message
          onMessageResponse({
            sender: 'coach',
            message: "I'm sorry, but I couldn't update your training plan. There might be a technical issue. Let me try again later or you can try making a different change."
          });
        }
        
        // Clear the pending adjustment
        setPendingAdjustment(null);
        return true;
      } else if (parsedMessage.type === 'reject') {
        // Clear the pending adjustment and send acknowledgment
        setPendingAdjustment(null);
        onMessageResponse({
          sender: 'coach',
          message: "Alright, I won't make any changes to your training plan. Let me know if you'd like to adjust something else or if you have any questions."
        });
        return true;
      }
    }
    
    // Handle a new adjustment request
    if (parsedMessage.type === 'adjust') {
      // Special case for testing database permissions
      if (message.toLowerCase().includes('test database') || 
          message.toLowerCase().includes('debug database') ||
          message.toLowerCase().includes('permissions test')) {
        await testDatabasePermissions(userId, trainingPlan, onMessageResponse);
        return true;
      }
      
      // Generate plan adjustment
      const adjustment = await generatePlanAdjustment(message, profile, trainingPlan);
      
      if (adjustment) {
        // Store the adjustment and ask for confirmation
        setPendingAdjustment(adjustment);
        
        // Format workout date for display
        const date = new Date(adjustment.date);
        const formattedDate = date.toLocaleDateString('en-US', { 
          weekday: 'long', 
          month: 'long', 
          day: 'numeric' 
        });
        
        let confirmationPrompt = `I'll adjust your ${adjustment.session_type} workout on ${formattedDate} to:
• Distance: ${adjustment.new_distance}km
• Time: ${adjustment.new_time} minutes
• Notes: ${adjustment.new_notes}`;

        // Add date change info if applicable
        if (adjustment.new_date && adjustment.new_date !== adjustment.date) {
          const newDate = new Date(adjustment.new_date);
          const formattedNewDate = newDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
          });
          
          confirmationPrompt = `I'll move your ${adjustment.session_type} workout from ${formattedDate} to ${formattedNewDate}, with these details:
• Distance: ${adjustment.new_distance}km
• Time: ${adjustment.new_time} minutes
• Notes: ${adjustment.new_notes}`;
        }
        
        // Ask for confirmation
        confirmationPrompt += '\n\nDoes this adjustment look good to you?';
        
        onMessageResponse({
          sender: 'coach',
          message: confirmationPrompt
        });
        
        return true;
      } else {
        // Failed to generate an adjustment
        onMessageResponse({
          sender: 'coach',
          message: "I'd like to help adjust your training plan, but I'm having trouble understanding exactly what change you'd like. Could you clarify which workout you want to change and how you'd like it modified?"
        });
        return true;
      }
    }
    
    // Not an adjustment-related message
    return false;
  };

  return {
    handleMessage,
    hasPendingAdjustment: () => pendingAdjustment !== null,
    clearPendingAdjustment: () => setPendingAdjustment(null)
  };
} 