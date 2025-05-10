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
  private currentSession: VoiceSession | null = null;
  private sessions: Map<string, VoiceSession> = new Map();
  
  /**
   * Start a new voice chat session
   * @param coachId ID of the coach for this session
   * @returns Session ID
   */
  startSession(coachId: string): string {
    // End current session if exists
    if (this.currentSession) {
      this.endSession();
    }
    
    // Create new session
    const sessionId = uuidv4();
    const now = Date.now();
    
    const newSession: VoiceSession = {
      id: sessionId,
      startTime: now,
      messageCount: 0,
      lastActivity: now,
      coachId,
      transcripts: []
    };
    
    // Store session
    this.sessions.set(sessionId, newSession);
    this.currentSession = newSession;
    
    return sessionId;
  }
  
  /**
   * End the current session
   * @returns The ended session or null if no active session
   */
  endSession(): VoiceSession | null {
    if (!this.currentSession) {
      return null;
    }
    
    // Update end time
    this.currentSession.endTime = Date.now();
    
    // Clear current session reference
    const endedSession = { ...this.currentSession };
    this.currentSession = null;
    
    return endedSession;
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
      source
    };
    
    // Add to session
    this.currentSession.transcripts.push(transcript);
    this.currentSession.lastActivity = now;
    this.currentSession.messageCount++;
    
    return transcriptId;
  }
  
  /**
   * Get the current session
   * @returns Current voice session or null if none active
   */
  getCurrentSession(): VoiceSession | null {
    return this.currentSession;
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
    
    return {
      sessionId: this.currentSession.id,
      transcriptCount: this.currentSession.transcripts.length,
      sessionDuration: Date.now() - this.currentSession.startTime
    };
  }
}

// Export singleton instance
export const voiceSessionManager = new VoiceSessionManager(); 