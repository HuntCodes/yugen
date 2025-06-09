// Import and re-export with namespaces to avoid naming conflicts
import * as authService from './auth';
import * as chatService from './chat';
import * as notificationService from './notifications';
import * as onboardingService from './onboarding';
import * as planService from './plan';
import * as profileService from './profile';

export {
  authService,
  chatService,
  planService,
  profileService,
  onboardingService,
  notificationService,
};
