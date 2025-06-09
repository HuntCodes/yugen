import React from 'react';
import { View, Text } from 'react-native';

import { SessionCard } from './SessionCard';
import { TrainingSession } from './types';

interface WeeklyViewProps {
  weekNumber: number;
  sessions: TrainingSession[];
  formatDate: (dateString: string) => string;
  getDayOfWeek: (dateString: string) => string;
  onUpdateSession?: (sessionId: string, updates: Partial<TrainingSession>) => Promise<void>;
}

export function WeeklyView({
  weekNumber,
  sessions,
  formatDate,
  getDayOfWeek,
  onUpdateSession,
}: WeeklyViewProps) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 12, color: '#000000' }}>
        Week {weekNumber}
      </Text>

      {sessions.map((session) => {
        // Only use the explicit modified flag, don't check notes content
        const isModified = Boolean(session.modified);

        // Format date nicely
        const formattedDate = formatDate(session.date);
        const dayOfWeek = getDayOfWeek(session.date);

        return (
          <SessionCard
            key={session.id}
            session={session}
            formattedDate={formattedDate}
            dayOfWeek={dayOfWeek}
            isModified={isModified}
            onUpdateSession={onUpdateSession}
          />
        );
      })}
    </View>
  );
}
