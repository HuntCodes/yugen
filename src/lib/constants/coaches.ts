import { Coach } from '../../types/coach';
import { coachStyles } from '../../config/coachingGuidelines';

export const COACHES: Coach[] = [
  {
    id: "craig",
    name: "Craig Mottram",
    vibe: coachStyles.craig.communicationStyle[0],
    philosophy: "Run fast, rest hard. Recovery is key.",
    personalityBlurb: coachStyles.craig.personality.join('. '),
    image: "craig.jpg"
  },
  {
    id: "thomas",
    name: "Thomas Dreissigacker",
    vibe: coachStyles.thomas.communicationStyle[0],
    philosophy: "Every step counts. Form is everything.",
    personalityBlurb: coachStyles.thomas.personality.join('. '),
    image: "thomas.jpg"
  },
  {
    id: "dathan",
    name: "Dathan Ritzenhein",
    vibe: coachStyles.dathan.communicationStyle[0],
    philosophy: "Smart training beats hard training every time.",
    personalityBlurb: coachStyles.dathan.personality.join('. '),
    image: "dathan.jpg"
  }
]; 