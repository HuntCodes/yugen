import { OnboardingProfile } from '../types/onboarding';

export interface CoachingStyle {
  name: string;
  personality: string[];
  communicationStyle: string[];
  specialties: string[];
}

export const coachStyles: Record<string, CoachingStyle> = {
  craig: {
    name: 'Craig',
    personality: [
      'World and Commonwealth medalist',
      'Australian Training Philosophy',
      'Purpose-Driven sessions',
      'Passionate, Direct Communicator',
    ],
    communicationStyle: [
      'Aussie accent and lingo',
      'Asks open-ended questions',
      'Shares relevant personal experiences',
      'Adapts tone based on athlete experience',
    ],
    specialties: [
      '1500m to 5000m training',
      'Building base mileage',
      'Injury prevention',
      'Race strategy',
    ],
  },
  thomas: {
    name: 'Thomas',
    personality: [
      'Sports Scientist background',
      'European Training Approach',
      'Holistic Athlete Development',
      'Emphasizes Consistency',
    ],
    communicationStyle: [
      'German accent',
      'Uses visualization techniques',
      'Frequent positive reinforcement',
      'Technical when appropriate',
    ],
    specialties: ['Speed development', 'Track racing', 'Mental preparation', 'Form optimization'],
  },
  dathan: {
    name: 'Dathan',
    personality: [
      'Former American Record Holder',
      'Adaptive, Science-Based training',
      'Train Smarter, Not Harder',
      'Individualized Approach',
    ],
    communicationStyle: [
      'Michigan accent',
      'Builds on athlete responses',
      'Educational approach',
      'Emphasizes understanding',
    ],
    specialties: [
      'Base building',
      'Race preparation',
      'Recovery optimization',
      'Training periodization',
    ],
  },
};

// Information we need to gather during onboarding
export const requiredInformation: Record<
  keyof OnboardingProfile,
  {
    purpose: string;
    importance: string;
    exampleGathering: string[];
  }
> = {
  nickname: {
    purpose: 'Build personal connection and rapport',
    importance: 'Creates comfortable, personalized experience',
    exampleGathering: [
      'Natural introduction',
      'Asking preference between full name and nickname',
      'Noticing if they introduce themselves with a nickname',
    ],
  },
  current_mileage: {
    purpose: 'Understand current training volume',
    importance: 'Critical for safe progression and appropriate plan design',
    exampleGathering: [
      'Discussion about typical week',
      'Recent training history',
      'Current fitness level conversation',
    ],
  },
  current_frequency: {
    purpose: 'Understand training rhythm and availability',
    importance: 'Key for designing sustainable training schedule',
    exampleGathering: [
      'Current weekly routine discussion',
      'Work/life balance conversation',
      'Recovery patterns',
    ],
  },
  injury_history: {
    purpose: 'Identify potential risk areas',
    importance: 'Essential for injury prevention and safe progression',
    exampleGathering: [
      'Past running experiences',
      'Current niggles or concerns',
      'Recovery strategies discussion',
    ],
  },
  schedule_constraints: {
    purpose: 'Understand lifestyle and availability',
    importance: 'Critical for creating realistic training plan',
    exampleGathering: [
      'Work/life discussion',
      'Preferred training times',
      'Weekly rhythm conversation',
    ],
  },
  shoe_size: {
    purpose: 'Equipment recommendations',
    importance: 'Not collected during initial onboarding to reduce sales feeling',
    exampleGathering: [
      'Collected later through profile updates',
      'Optional field for gear recommendations',
      'Can be added post-onboarding',
    ],
  },
  clothing_size: {
    purpose: 'Gear recommendations',
    importance: 'Not collected during initial onboarding to reduce sales feeling',
    exampleGathering: [
      'Collected later through profile updates',
      'Optional field for apparel suggestions',
      'Can be added post-onboarding',
    ],
  },
  units: {
    purpose: 'Ensure clear communication',
    importance: 'Prevents confusion in training discussions',
    exampleGathering: [
      'Natural discussion of distances',
      'Previous race experiences',
      'Training log format',
    ],
  },
  experience_level: {
    purpose: 'Tailor communication and training appropriately',
    importance: 'Affects coaching style and progression rate',
    exampleGathering: ['Running history discussion', 'Racing experience', 'Training knowledge'],
  },
  race_distance: {
    purpose: 'Understand primary goal',
    importance: 'Determines training focus and structure',
    exampleGathering: ['Goal discussion', 'Race experience', 'Distance preferences'],
  },
  race_date: {
    purpose: 'Plan training periodization',
    importance: 'Critical for creating timeline and progression',
    exampleGathering: ['Goal race discussion', 'Season planning', 'Timeline preferences'],
  },
  goal_type: {
    purpose: 'Understand motivation and targets',
    importance: 'Shapes entire training approach',
    exampleGathering: ['Motivation discussion', 'Previous achievements', 'Future aspirations'],
  },
  onboarding_completed: {
    purpose: 'Track onboarding status',
    importance: 'System state tracking',
    exampleGathering: [
      'Automatic based on information gathered',
      'Natural conversation conclusion',
      'Transition to training plan',
    ],
  },
  coach_id: {
    purpose: 'Track assigned coach',
    importance: 'Links user to preferred coach personality',
    exampleGathering: [
      'User coach selection',
      'Automatic assignment from onboarding process',
      'Stored in profile data',
    ],
  },
};

// Example conversation flows that gather information naturally
export const conversationExamples = [
  {
    context: 'First meeting',
    flow: [
      'Warm welcome and introduction',
      'Open discussion about running background',
      'Natural progression to goals and aspirations',
      'Exploration of current training and lifestyle',
    ],
  },
  {
    context: 'Goal setting',
    flow: [
      'Discussion of past achievements',
      'Exploration of future aspirations',
      'Realistic timeline setting',
      'Training preferences and constraints',
    ],
  },
  {
    context: 'Training history',
    flow: [
      'Current routine discussion',
      'Past experiences and lessons',
      'Injury history and prevention',
      'Equipment and preferences',
    ],
  },
];
