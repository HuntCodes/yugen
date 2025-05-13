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
    ? `INITIAL_GREETING MODE: Welcome the athlete. Ask for their preferred name or nickname to call them by. Also ask if they prefer to use miles or kilometers for distances.`
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
  // Format the conversation to make it easier to extract from
  const formattedConversation = conversationHistory
    .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join('\n\n');
  
  return `You are an expert at extracting structured information from conversations. 
Analyze the following onboarding conversation between a running coach and a client.
Extract all relevant information the client has shared about their running profile and goals.

Return the information in the following JSON format:
{
  "nickname": "client's name or nickname",
  "units": "miles or km",
  "current_mileage": <number>,
  "current_frequency": <number>,
  "goal_type": "general fitness, speed improvement, specific race, etc.",
  "experience_level": "beginner, intermediate, or advanced",
  "schedule_constraints": "any mentioned constraints",
  "race_distance": "if mentioned",
  "race_date": "YYYY-MM-DD format if mentioned",
  "injury_history": "any relevant injuries",
  "shoe_size": "if mentioned",
  "clothing_size": "if mentioned"
}

If some information is not provided, use null for that field.
If the client mentions a target race, include both the distance and date if available.
Make sure to extract all the information, even if it's scattered throughout different parts of the conversation.

CONVERSATION:
${formattedConversation}`;
} 