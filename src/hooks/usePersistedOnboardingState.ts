import AsyncStorage from '@react-native-async-storage/async-storage';

import { OnboardingProfile } from '../types/onboarding';

export interface OnboardingConversationState {
  conversationHistory: { role: 'user' | 'coach'; content: string }[];
  currentMessage: string;
  isComplete: boolean;
  extractedProfile: Partial<OnboardingProfile> | null;
  coachId: string;
  timestamp: string;
}

export function usePersistedOnboardingState(userId: string, coachId: string) {
  const getStorageKey = (key: string) => `onboarding_${userId}_${coachId}_${key}`;

  const saveConversationState = async (
    state: Omit<OnboardingConversationState, 'timestamp' | 'coachId'>
  ) => {
    try {
      const stateWithMetadata: OnboardingConversationState = {
        ...state,
        coachId,
        timestamp: new Date().toISOString(),
      };

      await AsyncStorage.multiSet([
        [
          getStorageKey('conversationHistory'),
          JSON.stringify(stateWithMetadata.conversationHistory),
        ],
        [getStorageKey('currentMessage'), stateWithMetadata.currentMessage],
        [getStorageKey('isComplete'), JSON.stringify(stateWithMetadata.isComplete)],
        [getStorageKey('extractedProfile'), JSON.stringify(stateWithMetadata.extractedProfile)],
        [getStorageKey('coachId'), stateWithMetadata.coachId],
        [getStorageKey('timestamp'), stateWithMetadata.timestamp],
      ]);

      console.log('[ONBOARDING_PERSISTENCE] Conversation state saved');
    } catch (error) {
      console.error('[ONBOARDING_PERSISTENCE] Failed to save onboarding state:', error);
    }
  };

  const loadConversationState = async (): Promise<OnboardingConversationState | null> => {
    try {
      const keys = [
        'conversationHistory',
        'currentMessage',
        'isComplete',
        'extractedProfile',
        'coachId',
        'timestamp',
      ];
      const storageKeys = keys.map((key) => getStorageKey(key));
      const values = await AsyncStorage.multiGet(storageKeys);

      // Convert to key-value pairs for easier access
      const stateMap: Record<string, string | null> = {};
      values.forEach(([fullKey, value], index) => {
        stateMap[keys[index]] = value;
      });

      // Check if we have any saved data
      if (!stateMap.conversationHistory && !stateMap.timestamp) {
        console.log('[ONBOARDING_PERSISTENCE] No saved conversation state found');
        return null;
      }

      // Check if saved state is not too old (7 days max)
      if (stateMap.timestamp) {
        const savedTime = new Date(stateMap.timestamp);
        const daysSince = (Date.now() - savedTime.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > 7) {
          console.log(
            `[ONBOARDING_PERSISTENCE] Saved state is ${daysSince.toFixed(1)} days old, clearing it`
          );
          await clearSavedState();
          return null;
        }
      }

      // Check if coach has changed
      if (stateMap.coachId && stateMap.coachId !== coachId) {
        console.log(
          `[ONBOARDING_PERSISTENCE] Coach changed from ${stateMap.coachId} to ${coachId}, clearing old state`
        );
        await clearSavedState();
        return null;
      }

      // Parse and return state
      const restoredState: OnboardingConversationState = {
        conversationHistory: JSON.parse(stateMap.conversationHistory || '[]'),
        currentMessage: stateMap.currentMessage || '',
        isComplete: JSON.parse(stateMap.isComplete || 'false'),
        extractedProfile: JSON.parse(stateMap.extractedProfile || 'null'),
        coachId: stateMap.coachId || coachId,
        timestamp: stateMap.timestamp || new Date().toISOString(),
      };

      console.log(
        `[ONBOARDING_PERSISTENCE] Restored conversation state with ${restoredState.conversationHistory.length} messages`
      );
      return restoredState;
    } catch (error) {
      console.error('[ONBOARDING_PERSISTENCE] Failed to load onboarding state:', error);
      // Clear potentially corrupted data
      await clearSavedState();
      return null;
    }
  };

  const clearSavedState = async () => {
    try {
      const keys = [
        'conversationHistory',
        'currentMessage',
        'isComplete',
        'extractedProfile',
        'coachId',
        'timestamp',
      ];
      const storageKeys = keys.map((key) => getStorageKey(key));
      await AsyncStorage.multiRemove(storageKeys);
      console.log('[ONBOARDING_PERSISTENCE] Saved conversation state cleared');
    } catch (error) {
      console.error('[ONBOARDING_PERSISTENCE] Failed to clear saved state:', error);
    }
  };

  const hasSavedState = async (): Promise<boolean> => {
    try {
      const timestamp = await AsyncStorage.getItem(getStorageKey('timestamp'));
      return timestamp !== null;
    } catch (error) {
      console.error('[ONBOARDING_PERSISTENCE] Failed to check for saved state:', error);
      return false;
    }
  };

  return {
    saveConversationState,
    loadConversationState,
    clearSavedState,
    hasSavedState,
  };
}
