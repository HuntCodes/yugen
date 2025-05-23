import React from 'react';
import { Text, View, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import { useTrainingOutlook, TrainingOutlookData } from '../../../../hooks/training/useTrainingOutlook';
import { generatePhaseOutlook, WeeklyPhaseOutlook } from '../../../../lib/utils/training/phaseProjection';
import { colors as appColors } from '../../../../styles/colors';
import { Calendar, CalendarUtils, DateData } from 'react-native-calendars';
import { LocalDate, TemporalAdjusters } from '@js-joda/core';
import '@js-joda/locale_en-us'; // Ensure locale data is loaded for formatting
import { MinimalSpinner } from '../../../../components/ui/MinimalSpinner';
// import CustomDayForOutlook from '../../../../screens/main/training/components/CustomDayForOutlook'; // Temporarily remove custom day component

// Define TrainingPhase enum locally as it's not exported from planAnalysis.ts
export enum TrainingPhase {
  Base = "Base",
  Build = "Build",
  Peak = "Peak",
  Taper = "Taper",
  RaceWeek = "Race Week",
  Recovery = "Recovery",
  None = "None",
}

// Define colors for phases
const phaseColors: Record<TrainingPhase, { color: string; textColor: string }> = {
  [TrainingPhase.Base]: { color: '#4CAF50', textColor: appColors.text.light }, // Green
  [TrainingPhase.Build]: { color: '#2196F3', textColor: appColors.text.light }, // Blue
  [TrainingPhase.Peak]: { color: '#FFC107', textColor: appColors.text.primary }, // Amber
  [TrainingPhase.Taper]: { color: '#FF9800', textColor: appColors.text.primary }, // Orange
  [TrainingPhase.RaceWeek]: { color: '#F44336', textColor: appColors.text.light }, // Red
  [TrainingPhase.Recovery]: { color: '#607D8B', textColor: appColors.text.light }, // Blue Grey
  [TrainingPhase.None]: { color: appColors.background, textColor: appColors.text.primary }
};

// Define explanations for each training phase
const phaseExplanations: Record<TrainingPhase, string> = {
  [TrainingPhase.Base]: 'Develop aerobic fitness with steady mileage',
  [TrainingPhase.Build]: 'Increase intensity & volume to boost fitness',
  [TrainingPhase.Peak]: 'Sharpen with race-specific workouts',
  [TrainingPhase.Taper]: 'Reduce load to freshen up before racing',
  [TrainingPhase.RaceWeek]: 'Final preparations before competition',
  [TrainingPhase.Recovery]: 'Active recovery with easy runs and rest ',
  [TrainingPhase.None]: ''
};

// Updated interface for what 'period' marking expects, based on user-provided documentation
interface PeriodMarkingData {
  startingDay?: boolean;
  endingDay?: boolean;
  color?: string; // Color for the period
  textColor?: string; // Optional: text color for the day number within the period
  disabled?: boolean;
  // selected?: boolean; // If you need to mark days as selected independently
}

// Original CustomCalendarMarking - keep for reference or if we revert to custom day
export interface CustomCalendarMarking extends PeriodMarkingData {
  phaseLabel?: TrainingPhase;
  labelTextColor?: string;
  isLabelDay?: boolean;
}

const TrainingOutlookView: React.FC = () => {
  const { outlookData, loading: profileLoading, error: profileError } = useTrainingOutlook();
  const [markedDates, setMarkedDates] = React.useState<Record<string, PeriodMarkingData>>({});
  const [minCalendarDate, setMinCalendarDate] = React.useState<string>('');
  const [maxCalendarDate, setMaxCalendarDate] = React.useState<string>('');
  const [initialCalendarDate, setInitialCalendarDate] = React.useState<string>(
    CalendarUtils.getCalendarDateString(new Date().toISOString())
  );
  const [currentCalendarMonth, setCurrentCalendarMonth] = React.useState<string>(
    CalendarUtils.getCalendarDateString(new Date().toISOString())
  );

  React.useEffect(() => {
    const today = LocalDate.now();
    let newMinCalDateStr: string;
    let newMaxCalDateStr: string;
    let initialViewDateStr = CalendarUtils.getCalendarDateString(today.toString());

    // Max date is always today + 3 months
    newMaxCalDateStr = CalendarUtils.getCalendarDateString(today.plusMonths(3).with(TemporalAdjusters.lastDayOfMonth()).toString());

    if (outlookData && outlookData.planStartDate) {
      const planStartActualDate = LocalDate.parse(outlookData.planStartDate);
      newMinCalDateStr = CalendarUtils.getCalendarDateString(planStartActualDate.withDayOfMonth(1).toString());
      
      const planStartMonthInitial = planStartActualDate.withDayOfMonth(1);
      if (today.isBefore(planStartMonthInitial)) {
        initialViewDateStr = CalendarUtils.getCalendarDateString(planStartMonthInitial.toString());
      }
    } else {
      // Fallback: if no planStartDate, show from today's month
      newMinCalDateStr = CalendarUtils.getCalendarDateString(today.withDayOfMonth(1).toString());
    }

    if (outlookData) {
      const rawOutlook = generatePhaseOutlook(outlookData.raceDate, outlookData.planStartDate, 3);
      const areWeeksContiguous = (week1EndDateStr: string, week2StartDateStr: string): boolean => {
        try {
          const end1 = LocalDate.parse(week1EndDateStr);
          const start2 = LocalDate.parse(week2StartDateStr);
          return end1.plusDays(1).equals(start2);
        } catch (e) {
          console.error("Error parsing dates for contiguity check:", e);
          return false;
        }
      };

      if (rawOutlook.length === 0) {
        setMarkedDates({});
      } else {
        const newMarkedDatesLogic: Record<string, PeriodMarkingData> = {};
        rawOutlook.forEach((week, index) => {
          const weekStartDateLocalDate = LocalDate.parse(week.weekStartDate);
          const weekEndDateLocalDate = LocalDate.parse(week.weekEndDate);
          const currentPhase = week.phase as TrainingPhase;
          const phaseStyle = phaseColors[currentPhase] || phaseColors[TrainingPhase.None];
          
          // Simplified logic: each week is its own band
          // const isTruePhaseStart = (index === 0) || 
          //                          (rawOutlook[index].phase !== rawOutlook[index - 1].phase) || 
          //                          !areWeeksContiguous(rawOutlook[index - 1].weekEndDate, rawOutlook[index].weekStartDate);
          // const isTruePhaseEnd = (index === rawOutlook.length - 1) || 
          //                        (rawOutlook[index].phase !== rawOutlook[index + 1].phase) || 
          //                        !areWeeksContiguous(rawOutlook[index].weekEndDate, rawOutlook[index + 1].weekStartDate);

          let currentDateIter = weekStartDateLocalDate;
          while (!currentDateIter.isAfter(weekEndDateLocalDate)) {
            const dateString = CalendarUtils.getCalendarDateString(currentDateIter.toString());
            
            const periodMarking: PeriodMarkingData = {
              color: phaseStyle.color,
              textColor: phaseStyle.textColor, 
            };

            // Each week segment starts on its weekStartDateLocalDate and ends on its weekEndDateLocalDate
            if (currentDateIter.equals(weekStartDateLocalDate)) {
              periodMarking.startingDay = true;
            }
            if (currentDateIter.equals(weekEndDateLocalDate)) {
              periodMarking.endingDay = true;
            }
            
            newMarkedDatesLogic[dateString] = periodMarking;
            currentDateIter = currentDateIter.plusDays(1);
          }
        });
        setMarkedDates(newMarkedDatesLogic);
      }
    } else {
      setMarkedDates({});
    }

    setMinCalendarDate(newMinCalDateStr);
    setMaxCalendarDate(newMaxCalDateStr);
    setInitialCalendarDate(initialViewDateStr);
    setCurrentCalendarMonth(initialViewDateStr);

  }, [outlookData]);

  if (profileLoading) {
    return <View style={styles.centeredContainer}><MinimalSpinner size={48} color={appColors.text.primary} thickness={3} /></View>;
  }

  if (profileError) {
    return <View style={styles.centeredContainer}><Text style={styles.errorText}>Error loading profile data: {profileError}</Text></View>;
  }

  if (!outlookData) {
    return <View style={styles.centeredContainer}><Text style={styles.infoText}>No profile data available to display outlook.</Text></View>;
  }
  
  return (
    <View style={styles.flexView}>
      <Calendar
        current={initialCalendarDate}
        minDate={minCalendarDate}
        maxDate={maxCalendarDate}
        markingType={'period'} 
        markedDates={markedDates} 
        onMonthChange={(month: DateData) => {
          setCurrentCalendarMonth(CalendarUtils.getCalendarDateString(month.dateString));
        }}
        firstDay={1} 
        // Disable arrow navigation when at min/max dates
        disableArrowLeft={(() => {
          if (!minCalendarDate || !currentCalendarMonth) return false;
          const currentDate = new Date(currentCalendarMonth);
          const minDate = new Date(minCalendarDate);
          // Disable if current month is at or before the minimum month
          return currentDate.getFullYear() <= minDate.getFullYear() && 
                 currentDate.getMonth() <= minDate.getMonth();
        })()}
        disableArrowRight={(() => {
          if (!maxCalendarDate || !currentCalendarMonth) return false;
          const currentDate = new Date(currentCalendarMonth);
          const maxDate = new Date(maxCalendarDate);
          // Disable if current month is at or after the maximum month
          return currentDate.getFullYear() >= maxDate.getFullYear() && 
                 currentDate.getMonth() >= maxDate.getMonth();
        })()}
        // Custom arrow handlers to prevent navigation outside bounds
        onPressArrowLeft={(subtractMonth) => {
          if (!minCalendarDate || !currentCalendarMonth) {
            subtractMonth();
            return;
          }
          const currentDate = new Date(currentCalendarMonth);
          const minDate = new Date(minCalendarDate);
          // Only allow navigation if we're not at the minimum month
          if (currentDate.getFullYear() > minDate.getFullYear() || 
              (currentDate.getFullYear() === minDate.getFullYear() && currentDate.getMonth() > minDate.getMonth())) {
            subtractMonth();
          }
        }}
        onPressArrowRight={(addMonth) => {
          if (!maxCalendarDate || !currentCalendarMonth) {
            addMonth();
            return;
          }
          const currentDate = new Date(currentCalendarMonth);
          const maxDate = new Date(maxCalendarDate);
          // Only allow navigation if we're not at the maximum month
          if (currentDate.getFullYear() < maxDate.getFullYear() || 
              (currentDate.getFullYear() === maxDate.getFullYear() && currentDate.getMonth() < maxDate.getMonth())) {
            addMonth();
          }
        }}
        theme={{
          backgroundColor: appColors.background, 
          calendarBackground: appColors.background, 
          textSectionTitleColor: '#555555',
          textSectionTitleDisabledColor: '#C0C0C0',
          selectedDayBackgroundColor: appColors.secondary,
          selectedDayTextColor: appColors.text.light,
          todayTextColor: '#00adf5',
          dayTextColor: appColors.text.primary, // Default day text color
          // textColor for days within a period is set by markedDates.textColor
          textDisabledColor: appColors.text.disabled,
          dotColor: '#00adf5',
          selectedDotColor: appColors.text.light,
          arrowColor: 'orange',
          disabledArrowColor: '#d9e1e8',
          monthTextColor: appColors.text.primary,
          indicatorColor: 'blue',
          textDayFontWeight: '300',
          textMonthFontWeight: 'bold',
          textDayHeaderFontWeight: '300',
          textDayFontSize: 16,
          textMonthFontSize: 18,
          textDayHeaderFontSize: 14,
        }}
        enableSwipeMonths={true}
        style={styles.calendarStyle}
      />
      <View style={styles.legendOuterContainer}>
        <View style={styles.legendContainer}>
          <Text style={styles.legendTitle}>Training Phases</Text>
          {Object.entries(phaseColors).map(([phaseName, { color, textColor }]) => {
            if (phaseName === TrainingPhase.None) return null;
            let legendItemTextColor = textColor;
            if (textColor === appColors.text.light && appColors.background === '#FFFFFF') {
              legendItemTextColor = appColors.text.primary;
            }
            const explanation = phaseExplanations[phaseName as TrainingPhase];
            return (
              <View key={phaseName} style={styles.legendItem}>
                <View style={[styles.legendColorBox, { backgroundColor: color }]} />
                <View style={styles.legendTextContainer}>
                  <Text style={[styles.legendItemText, { color: legendItemTextColor }]}>
                    <Text style={styles.legendPhaseText}>{phaseName}</Text>
                    <Text style={styles.legendDescriptionText}> - {explanation}</Text>
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  flexView: {
    flex: 1,
    backgroundColor: '#FBF7F6', // Same as TrainingPlanScreen header and legend
    paddingTop: 10,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: appColors.background,
    padding: 16,
  },
  errorText: {
    color: appColors.error, 
    fontSize: 16,
    textAlign: 'center',
  },
  infoText: {
    color: appColors.text.secondary,
    fontSize: 16,
    textAlign: 'center',
  },
  calendarStyle: {
    marginHorizontal: 10, 
  },
  legendOuterContainer: {
    flexShrink: 1, 
    borderTopWidth: 1,
    borderColor: appColors.border, 
    marginTop: 10,
    backgroundColor: '#FBF7F6', // Same as TrainingPlanScreen header
  },
  legendContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  legendTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: appColors.text.primary,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendColorBox: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 10,
    borderWidth: 1, 
    borderColor: appColors.text.disabled, 
  },
  legendTextContainer: {
    flex: 1,
  },
  legendItemText: {
    fontSize: 14,
  },
  legendPhaseText: {
    fontWeight: '600',
  },
  legendDescriptionText: {
    fontWeight: '300',
  },
});

export default TrainingOutlookView; 