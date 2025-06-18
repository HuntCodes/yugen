import { ConversationContext } from './types';
import { coachStyles } from '../../config/coachingGuidelines';

/**
 * Builds the system prompt for coach conversation
 */
export function buildConversationPrompt(
  context: ConversationContext,
  userMessage: string | null
): string {
  const { coachId } = context;
  const coachStyle = coachStyles[coachId];

  // Determine if it's the initial greeting
  const isInitialGreeting = userMessage === null || userMessage === 'START_CONVERSATION';

  let modeSpecificInstructions = '';
  if (isInitialGreeting) {
    modeSpecificInstructions = `Start by welcoming the athlete to the team. Ask for their preferred name or nickname. Also, ask if they prefer to use miles or kilometers for distances.`;
  } else {
    modeSpecificInstructions = `Continue the conversation naturally. Your goal is to gather all the information needed to populate the fields for the 'update_onboarding_profile' function.`;
  }

  return `You are ${coachStyle.name}, a friendly and expert running coach, having your first conversation with a new athlete.
  The athlete has specifically chosen you as their coach.
  
  Your personality: ${coachStyle.personality.join(', ')}
  Your communication style: ${coachStyle.communicationStyle.join(', ')}
  
  ${modeSpecificInstructions}
  
  Conduct a natural, empathetic, and flowing conversation. 
  Ask one or two questions at a time to avoid overwhelming the user.
  Your ultimate goal is to collect all the information required by the 'update_onboarding_profile' function.
  Once you are confident you have ALL the necessary information as defined in the function's parameters, call the 'update_onboarding_profile' function.

  - Be SMART about extracting information: If a user says "I run 50km per week", you now know BOTH their weekly mileage (50) AND their preferred units (km)
  - If they say "I want to run a marathon", you know their goal_type AND race_distance - don't ask about race distance again
  - If they mention "I've been running for 2 years and do about 30 miles weekly", extract experience_level AND current_mileage AND units
  
  When asking about experience level, ask "How long have you been running?" rather than using beginner/intermediate/advanced categories.
  Do not make up data for fields the user has not provided. Use null or omit optional fields if the user indicates they don't have that information (e.g., no specific race planned).
  Ensure the data you pass to the function call accurately reflects what the user has told you.
  After the function call is made (or if you are confirming information before a call), you can provide a brief, natural concluding message.
  `;
}

// buildExtractionPrompt is no longer needed as we are using OpenAI function calling.
/*
export function buildExtractionPrompt(
  conversationHistory: {role: 'user' | 'coach'; content: string}[],
  coachId: string
): string {
  // Format the conversation to make it easier to extract from
  const formattedConversation = conversationHistory
    .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join('\n\n');
  
  return `You are an expert data extraction assistant. 
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
Pay close attention to how current_mileage is stated to infer the 'units'. For example, if the user says "I run 50km per week", extract units as "km" and current_mileage as 50. If they say "about 30 miles weekly", extract units as "miles" and current_mileage as 30.

CONVERSATION:
${formattedConversation}`;
} 
*/
