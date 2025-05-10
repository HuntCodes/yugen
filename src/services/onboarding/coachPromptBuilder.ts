import { coachStyles, requiredInformation } from '../../config/coachingGuidelines';
import { ConversationContext } from './types';
import { formatField } from './onboardingDataFormatter';

/**
 * Builds the system prompt for coach conversation
 */
export function buildConversationPrompt(
  context: ConversationContext,
  userMessage: string | null
): string {
  const { coachId, userProfile } = context;
  
  // Get coach-specific data
  const coachStyle = coachStyles[coachId];
  
  // Identify missing fields
  const allRequiredFields = Object.keys(requiredInformation).filter(key => key !== 'onboarding_completed');
  
  // Calculate missing fields based on current context
  const missingFields = allRequiredFields.filter(key => {
    // Skip race fields if user has explicitly indicated no races
    if ((key === 'race_distance' || key === 'race_date') && 
        (userProfile.race_distance === null || 
         userProfile.race_date === null)) {
      return false;
    }
    return !userProfile[key as keyof typeof userProfile];
  });

  // Handle special case for initial greeting
  const isInitialGreeting = userMessage === null || userMessage === "START_CONVERSATION";
  
  // Build system prompt
  return `You are ${coachStyle.name}, a running coach having your first conversation with a new athlete.
  
  PERSONALITY: ${coachStyle.personality.join(', ')}
  COMMUNICATION STYLE: ${coachStyle.communicationStyle.join(', ')}
  
  MODE: ${isInitialGreeting ? 'INITIAL_GREETING' : 'INFORMATION_GATHERING'}
  
  ${isInitialGreeting
    ? `INITIAL_GREETING MODE: Welcome the athlete, ask for their name and whether they use miles or kilometers.`
    : `INFORMATION_GATHERING MODE:
  Known Information:
  ${Object.entries(userProfile)
    .filter(([key, value]) => {
      if ((key === 'race_distance' || key === 'race_date') && value === null) return true;
      return value && key !== 'onboarding_completed' && key !== 'id' && key !== 'coach_id';
    })
    .map(([key, value]) => `- ${formatField(key)}: ${value ?? 'None'}`)
    .join('\n')}
  
  You need to collect these remaining fields:
  ${missingFields.map(field => `- ${formatField(field)}`).join('\n')}
  `}
  
  Conduct a natural, friendly conversation to collect ALL required information.
  ASK ONE OR TWO QUESTIONS AT A TIME - do not overwhelm the user.
  When you have collected ALL required information, end by saying "Perfect! I've got all the information I need."
  `;
}

/**
 * Builds the system prompt for extracting information from conversation
 */
export function buildExtractionPrompt(
  conversationHistory: {role: 'user' | 'coach'; content: string}[],
  coachId: string
): string {
  // Get coach-specific data
  const coachStyle = coachStyles[coachId];
  
  // Filter to just the user messages to focus on their responses
  const userMessages = conversationHistory
    .filter(msg => msg.role === 'user')
    .map(msg => msg.content)
    .join('\n\n');

  return `You are an AI assistant helping extract structured information from a conversation with a user about their running profile.
  
  The conversation is with ${coachStyle.name}, a running coach.
  
  Extract the following information in JSON format:
  - name: The user's name
  - units: Whether they use "km" or "miles"
  - current_mileage: How much they currently run per week
  - current_frequency: How many days per week they run
  - goal: Their running goal
  - experience_level: Their running experience (beginner, intermediate, advanced)
  - schedule_constraints: Any constraints on their schedule
  - race_distance: Target race distance (null if no race)
  - race_date: Target race date (null if no race)
  
  USER CONVERSATION TRANSCRIPT:
  ${userMessages}
  
  Format your response as a JSON object with the extracted fields.
  If you cannot determine a value, use null.
  If the user explicitly states they have no upcoming race, set both race_distance and race_date to null.`;
} 