export interface Coach {
  id: string;
  name: string;
  vibe: string;
  philosophy: string;
  personalityBlurb: string;
  image: string;
  avatarVideos?: {
    listening?: any;
    talking?: any;
    waving?: any;
  };
}

export interface CoachProps {
  coachId: string;
  coachName: string;
  imageMap?: Record<string, any>;
}

export interface CoachSelectOptions {
  coaches: Coach[];
  onSelect: (coach: Coach) => void;
}
