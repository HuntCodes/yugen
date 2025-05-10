import React, { useRef, createRef } from 'react';
import { View, ScrollView, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Text } from '../../../../components/ui/StyledText';
import { TrainingSession } from './types';

// Define SessionLayout type here or import if shared
type SessionLayout = { y: number; height: number };

export interface SessionListProps {
  sessions: TrainingSession[];
  formatDate: (dateString: string) => string;
  getDayOfWeek: (dateString: string) => string;
  sessionLayoutsRef: React.MutableRefObject<Record<string, SessionLayout>>;
  scrollViewRef: React.RefObject<ScrollView | null>;
  children: (
    session: TrainingSession, 
    formattedDate: string, 
    dayOfWeek: string, 
    isModified: boolean
  ) => React.ReactNode;
}

export const SessionList: React.FC<SessionListProps> = ({ 
  sessions, 
  formatDate, 
  getDayOfWeek,
  sessionLayoutsRef,
  scrollViewRef,
  children
}) => {
  // Store refs for each session view dynamically - MOVED BEFORE early return
  const sessionViewRefs = useRef<Record<string, React.RefObject<View | null>>>({});
  
  if (!sessions || sessions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No training sessions found.</Text>
      </View>
    );
  }

  // Initialize refs for new sessions
  sessions.forEach(session => {
    if (!sessionViewRefs.current[session.id]) {
      // Ensure refs are created only once per session ID for the component's lifetime
      sessionViewRefs.current[session.id] = createRef<View | null>();
    }
  });

  // Group sessions by week
  const sessionsByWeek: { [key: number]: TrainingSession[] } = {};
  sessions.forEach(session => {
    const weekNum = session.week_number || 1;
    if (!sessionsByWeek[weekNum]) {
      sessionsByWeek[weekNum] = [];
    }
    sessionsByWeek[weekNum].push(session);
  });

  // Callback for onLayout - Triggers measureLayout
  const handleLayout = (sessionId: string) => {
    const node = sessionViewRefs.current[sessionId]?.current;
    const scrollViewNode = scrollViewRef.current;

    // Need both the specific session view ref and the scrollview ref
    if (node && scrollViewNode) {
      // Measure the position of the session view relative to the ScrollView's inner container
      node.measureLayout(
        // Ensure you're measuring against the correct node.
        // For ScrollView, it's usually the direct child or using findNodeHandle if needed.
        // getInnerViewNode() is common but might need adjustment based on ScrollView implementation.
        // Let's assume scrollViewNode is the correct handle or direct parent for measureLayout.
        scrollViewNode as any, // Cast might be needed depending on exact types
        (x, y, width, height) => {
          // console.log(`[AutoScroll Debug] Measured Layout for ${sessionId}: y=${y}, height=${height}`);
          // Store the CORRECT y-coordinate relative to the scroll view
          sessionLayoutsRef.current[sessionId] = { y, height };
        },
        () => {
          console.error(`[AutoScroll Debug] Failed to measure layout for ${sessionId}`);
        }
      );
    } else {
       // console.warn(`[AutoScroll Debug] Ref not ready for measurement: node=${!!node}, scrollViewNode=${!!scrollViewNode}`);
    }
  };

  return (
    <View style={styles.container}>
      {Object.keys(sessionsByWeek).map(weekKey => {
        const weekNum = parseInt(weekKey, 10);
        const weekSessions = sessionsByWeek[weekNum];
        
        return (
          <View key={`week-${weekNum}`} style={styles.weekContainer}>
            <Text style={styles.weekHeader}>Week {weekNum}</Text>
            {weekSessions.map(session => {
              const formattedDate = formatDate(session.date);
              const dayOfWeek = getDayOfWeek(session.date);
              const isModified = !!session.modified;
              
              return (
                // Attach the specific ref and use onLayout to trigger measure
                <View
                  ref={sessionViewRefs.current[session.id]} // Attach the specific ref
                  key={session.id}
                  style={styles.sessionContainer}
                  // onLayout is now just a trigger to perform the measurement
                  onLayout={() => handleLayout(session.id)}
                >
                  {children(session, formattedDate, dayOfWeek, isModified)}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  weekContainer: {
    marginBottom: 20,
    paddingHorizontal: 24,
  },
  weekHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  sessionContainer: {
    marginBottom: 12,
  },
}); 