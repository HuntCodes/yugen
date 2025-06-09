import { v4 as uuidv4 } from 'uuid';

/**
 * Interface for voice session data
 */
interface VoiceSession {
  id: string;
  startTime: number;
  endTime?: number;
  messageCount: number;
  lastActivity: number;
  coachId: string;
  transcripts: VoiceTranscript[];
}

/**
 * Interface for voice transcript data
 */
interface VoiceTranscript {
  id: string;
  text: string;
  timestamp: number;
  isFinal: boolean;
  source: 'user' | 'coach';
}

/**
 * Manages voice chat sessions
 */
class VoiceSessionManager {
  private currentSession: string | null = null;
  private isInitializing = false;
  private activeComponent: 'onboarding' | 'daily' | null = null;
  private sessions: Map<string, VoiceSession> = new Map();

  /**
   * Start a new voice chat session
   * @param coachId ID of the coach for this session
   * @param component The type of session (onboarding or daily)
   * @returns Session ID
   */
  startSession(coachId: string, component: 'onboarding' | 'daily' = 'onboarding'): string {
    // Prevent overlapping sessions
    if (this.currentSession && this.activeComponent) {
      console.warn(
        `[VoiceSessionManager] Attempting to start ${component} session while ${this.activeComponent} session is active. Ending previous session.`
      );
      this.forceEndSession();
    }

    if (this.isInitializing) {
      console.warn('[VoiceSessionManager] Another session is initializing. Waiting...');
      // Could implement a queue here if needed
    }

    this.isInitializing = true;
    const sessionId = `voice_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.currentSession = sessionId;
    this.activeComponent = component;
    this.isInitializing = false;

    console.log(`[VoiceSessionManager] Started ${component} session: ${sessionId}`);

    // Create new session
    const now = Date.now();
    const newSession: VoiceSession = {
      id: sessionId,
      startTime: now,
      messageCount: 0,
      lastActivity: now,
      coachId,
      transcripts: [],
    };

    // Store session
    this.sessions.set(sessionId, newSession);

    return sessionId;
  }

  /**
   * End the current session
   * @returns The ended session or null if no active session
   */
  endSession(): void {
    if (this.currentSession) {
      const sessionId = this.currentSession;
      const component = this.activeComponent;
      console.log(`[VoiceSessionManager] Ending ${component} session: ${sessionId}`);
      
      this.currentSession = null;
      this.activeComponent = null;
      this.isInitializing = false;
    } else {
      console.log('[VoiceSessionManager] No active session to end');
    }
  }

  /**
   * Force end the current session
   */
  forceEndSession(): void {
    console.warn('[VoiceSessionManager] Force ending session');
    this.currentSession = null;
    this.activeComponent = null;
    this.isInitializing = false;
  }

  /**
   * Get the current session
   * @returns Current voice session or null if none active
   */
  getCurrentSession(): string | null {
    return this.currentSession;
  }

  /**
   * Get the active component
   * @returns The active component or null if none active
   */
  getActiveComponent(): 'onboarding' | 'daily' | null {
    return this.activeComponent;
  }

  /**
   * Is the current session active
   * @returns True if session is active, false otherwise
   */
  isSessionActive(): boolean {
    return this.currentSession !== null;
  }

  /**
   * Add a transcript to the current session
   * @param text Transcript text
   * @param source Source of the transcript (user or coach)
   * @param isFinal Whether this is a final transcript
   * @returns The transcript ID
   */
  addTranscript(text: string, source: 'user' | 'coach', isFinal = false): string | null {
    if (!this.currentSession) {
      return null;
    }

    const transcriptId = uuidv4();
    const now = Date.now();

    // Create transcript
    const transcript: VoiceTranscript = {
      id: transcriptId,
      text,
      timestamp: now,
      isFinal,
      source,
    };

    // Add to session
    const session = this.sessions.get(this.currentSession);
    if (session) {
      session.transcripts.push(transcript);
      session.lastActivity = now;
      session.messageCount++;
    }

    return transcriptId;
  }

  /**
   * Get a session by ID
   * @param sessionId Session ID to retrieve
   * @returns The session or null if not found
   */
  getSession(sessionId: string): VoiceSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get metadata about the current session for saving with messages
   * @returns Session metadata object
   */
  getSessionMetadata() {
    if (!this.currentSession) {
      return null;
    }

    const session = this.sessions.get(this.currentSession);
    if (session) {
      return {
        sessionId: session.id,
        transcriptCount: session.transcripts.length,
        sessionDuration: Date.now() - session.startTime,
      };
    }
    return null;
  }

  // Method to verify if a component should be able to start a session
  canStartSession(component: 'onboarding' | 'daily'): boolean {
    if (!this.currentSession) {
      return true;
    }

    if (this.activeComponent === component) {
      console.warn(`[VoiceSessionManager] ${component} session already active`);
      return false;
    }

    console.warn(
      `[VoiceSessionManager] Cannot start ${component} session - ${this.activeComponent} session is active`
    );
    return false;
  }

  /**
   * DEBUG METHOD: Force reset all singleton state
   * Use this in development when hot reloading causes state persistence issues
   */
  debugReset(): void {
    console.warn('[VoiceSessionManager] DEBUG RESET: Force clearing all singleton state');
    this.currentSession = null;
    this.activeComponent = null;
    this.isInitializing = false;
    this.sessions.clear();
    console.log('[VoiceSessionManager] DEBUG RESET: All state cleared');
  }

  /**
   * Get detailed debug info about current state
   */
  getDebugState() {
    return {
      currentSession: this.currentSession,
      activeComponent: this.activeComponent,
      isInitializing: this.isInitializing,
      sessionCount: this.sessions.size,
      isSessionActive: this.isSessionActive()
    };
  }
}

// Export singleton instance
export const voiceSessionManager = new VoiceSessionManager();
