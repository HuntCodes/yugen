import { coachStyles } from '../../config/coachingGuidelines';
import { Coach } from '../../types/coach';

export const COACHES: Coach[] = [
  {
    id: 'craig',
    name: 'Craig Mottram',
    vibe: coachStyles.craig.communicationStyle[0],
    philosophy: 'Run like you stole something.',
    personalityBlurb: coachStyles.craig.personality.join('. '),
    image: 'Craig_Avatar.png',
  },
  {
    id: 'thomas',
    name: 'Thomas Dreissigacker',
    vibe: coachStyles.thomas.communicationStyle[0],
    philosophy: 'Every step counts. Form is everything.',
    personalityBlurb: coachStyles.thomas.personality.join('. '),
    image: 'thomas.jpg',
  },
  {
    id: 'dathan',
    name: 'Dathan Ritzenhein',
    vibe: coachStyles.dathan.communicationStyle[0],
    philosophy: 'Smart training beats hard training every time.',
    personalityBlurb: coachStyles.dathan.personality.join('. '),
    image: 'Dathan_Avatar.png',
    avatarVideos: {
      listening: require('../../../assets/avatars/Dathan_Listening_Loop_Final.mp4'),
      talking: require('../../../assets/avatars/Dathan_Talking_Loop_Final.mp4'),
      waving: require('../../../assets/avatars/Dathan_Wave_Loop_Final.mp4'),
    },
  },
];
