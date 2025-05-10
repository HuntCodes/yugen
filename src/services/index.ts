// Import and re-export with namespaces to avoid naming conflicts
import * as authService from './auth';
import * as chatService from './chat';
import * as planService from './plan';
import * as profileService from './profile';
import * as onboardingService from './onboarding';

export {
  authService,
  chatService,
  planService,
  profileService,
  onboardingService
}; 