        // supabase/functions/_shared/planServiceDeno.ts
        // import { arqué } from './arquéClient.ts'; // Supabase client for Deno - REMOVED: unused import
        // import { type ChatCompletionRequestMessage, Configuration, OpenAIApi } from "https://esm.sh/openai@3.2.1"; // Old v3 import
        import OpenAI from "https://esm.sh/openai@4.29.2"; // New v4 import (example version, check esm.sh for latest v4)
        import { LocalDate, TemporalAdjusters, ChronoUnit, DayOfWeek } from 'https://esm.sh/@js-joda/core@5.5.2'; // Example: using esm.sh for @js-joda/core
        // Note: You might need to adjust the @js-joda/core version or import method based on your Deno setup.

        // Define proper type for Supabase client
        interface SupabaseQueryBuilder {
          eq: (column: string, value: string) => SupabaseQueryBuilder;
          gte: (column: string, value: string) => SupabaseQueryBuilder;
          lte: (column: string, value: string) => SupabaseQueryBuilder;
          single: () => Promise<{ data: unknown; error: { message?: string } | null }>;
        }

        interface SupabaseDeleteBuilder {
          eq: (column: string, value: string) => SupabaseDeleteBuilder;
          gte: (column: string, value: string) => SupabaseDeleteBuilder;
          lte: (column: string, value: string) => SupabaseDeleteBuilder;
        }

        interface SupabaseDeleteResponse {
          error: { message?: string } | null;
        }

        interface SupabaseClient {
          from: (table: string) => {
            select: (columns: string) => SupabaseQueryBuilder;
            insert: (data: TrainingSessionDeno[]) => Promise<{ error: { message?: string } | null }>;
            delete: () => SupabaseDeleteBuilder;
          };
        }

        interface ErrorWithResponse {
          response?: {
            data?: unknown;
          };
        }

        // --- Type Definitions (consistent with existing app and feedbackService.ts) ---
        interface UserProfileOnboarding {
          // Fields from 'profiles' table relevant for onboarding/plan generation
          goal_type?: string | null;           // Was goal_description
          race_date?: string | null;
          race_distance?: string | null;
          experience_level?: string | null;    // Was running_experience
          current_frequency?: string | null;   // Was training_frequency
          current_mileage?: string | null;     // Was weekly_volume (ensure string for consistency with schema)
          units?: string | null;
          nickname?: string | null;            // Was display_name
          injury_history?: string | null;
          schedule_constraints?: string | null; // Directly from profiles
          created_at: string; // Expect created_at as timestamp string from DB
        }

        interface OnboardingDataInternal {
          goalType: string;
          raceDate?: string | null;
          raceDistance?: string;
          experienceLevel: string;
          trainingFrequency: string;
          currentMileage: string;
          units: string;
          nickname?: string;
          injuryHistory?: string;
          scheduleConstraints?: string;
          planStartDate: string; // Will be derived from created_at (YYYY-MM-DD)
        }

        interface TrainingSessionDeno {
          user_id: string;
          week_number: number;
          day_of_week: number;
          session_type: string;
          date: string; // YYYY-MM-DD (Note: training_plans.date is timestamptz)
          distance?: number | null;
          time?: number | null;
          notes?: string | null;
          status: 'not_completed' | 'completed' | 'skipped' | 'partially_completed'; // Matches your varchar values
          created_at?: string;
          updated_at?: string;
          // Schema also has plan_type, modified, phase - consider if AI should generate these
        }

        interface ExistingSession {
          date: string;
          status: string;
          notes?: string;
          post_session_notes?: string;
        }

        interface AIPlanItem {
          day_of_week?: number;
          session_type?: string;
          date?: string;
          distance?: number;
          time?: number;
          notes?: string;
          week_number?: number;
          phase?: string;
        }

        // Initialize OpenAI client (similar to feedbackService.ts)
        const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
        let openai: OpenAI | null = null; // Changed type to OpenAI (v4)
        if (openAiApiKey) {
          // const configuration = new Configuration({ apiKey: openAiApiKey }); // Old v3 config
          // openai = new OpenAIApi(configuration); // Old v3 client
          openai = new OpenAI({ apiKey: openAiApiKey }); // New v4 client initialization
        } else {
          console.warn("[planServiceDeno] OPENAI_API_KEY is not set. AI plan generation will be disabled.");
        }

        // --- Helper: Fetch User Onboarding Data ---
        async function getUserOnboardingDataDeno(arquéClient: SupabaseClient, userId: string): Promise<OnboardingDataInternal | null> {
          console.log(`[planServiceDeno] Fetching onboarding data for user ${userId} from profiles table.`);
          const { data: profileData, error: profileError } = await arquéClient
            .from('profiles')
            .select('goal_type, race_date, race_distance, experience_level, current_frequency, current_mileage, units, nickname, injury_history, schedule_constraints, created_at') // Fetch created_at
            .eq('id', userId)
            .single();

          if (profileError || !profileData) {
            console.error(`[planServiceDeno] Error fetching profile for user ${userId}:`, profileError?.message);
            return null;
          }

          const p = profileData as UserProfileOnboarding;

          // Convert created_at (timestamp string) to YYYY-MM-DD string for planStartDate
          // Supabase typically returns timestamps in ISO 8601 format e.g., "2023-10-27T10:30:00.123456+00:00"
          const createdAtDate = new Date(p.created_at);
          const planStartDateString = createdAtDate.toISOString().split('T')[0];

          return {
            goalType: p.goal_type || 'General fitness',
            raceDate: p.race_date || null,
            raceDistance: p.race_distance || undefined,
            experienceLevel: p.experience_level || 'beginner',
            trainingFrequency: p.current_frequency || '3-4 days per week',
            currentMileage: String(p.current_mileage || '20'),
            units: p.units || 'km',
            nickname: p.nickname || undefined,
            injuryHistory: p.injury_history || undefined,
            scheduleConstraints: p.schedule_constraints || undefined,
            planStartDate: planStartDateString, // Use formatted created_at
          };
        }

        // --- Helper: Remove Workouts (Conditional based on interaction) ---
        // Renamed and modified to delete only for a specific week
        async function deleteWorkoutsForSpecificWeekDeno(arquéClient: SupabaseClient, userId: string, weekStartUtcString: string, weekEndUtcString: string): Promise<boolean> {
          console.log(`[planServiceDeno] Removing workouts for user ${userId} for week ${weekStartUtcString} to ${weekEndUtcString}`);
          const deleteResponse = await (arquéClient
            .from('training_plans')
            .delete()
            .eq('user_id', userId)
            .gte('date', weekStartUtcString)
            .lte('date', weekEndUtcString) as unknown as Promise<{ error: { message?: string } | null }>); // Type assertion for Supabase response

          const { error } = deleteResponse;
          if (error) {
            console.error(`[planServiceDeno] Error removing workouts for week ${weekStartUtcString}-${weekEndUtcString} for user ${userId}:`, error);
            return false;
          }
          console.log(`[planServiceDeno] Successfully removed workouts for week ${weekStartUtcString}-${weekEndUtcString} for user ${userId}`);
          return true;
        }

        // --- Helper: Placeholder for AI Plan Generation Logic ---
        // This function would adapt your existing `generateTrainingPlan` from `src/lib/openai.ts`
        // or a similar AI call to generate a 7-day plan.
        async function generateNewWeekPlanWithAI(
          onboardingData: OnboardingDataInternal,
          currentPhase: string, // ADDED: current training phase
          weeksSincePlanStart: number, // ADDED: for week_number in sessions
          latestFeedbackSummary?: string,
          targetMondayDate?: Date
        ): Promise<Omit<TrainingSessionDeno, 'user_id' | 'status' | 'created_at' | 'updated_at'>[]> {
          if (!openai) {
            console.warn("[planServiceDeno] OpenAI client not available. Cannot generate AI plan.");
            return [];
          }
          // Align prompt with OnboardingDataInternal fields
          let prompt = `Generate a 7-day training plan (Monday to Sunday) for a user with the following profile:\n`;
          prompt += `- Goal: ${onboardingData.goalType}\n`;
          if (onboardingData.raceDate) prompt += `- Race Date: ${onboardingData.raceDate}\n`;
          if (onboardingData.raceDistance) prompt += `- Race Distance: ${onboardingData.raceDistance}\n`;
          prompt += `- Experience: ${onboardingData.experienceLevel}\n`;
          prompt += `- Training Frequency: ${onboardingData.trainingFrequency}\n`;
          prompt += `- Current Mileage: ${onboardingData.currentMileage} ${onboardingData.units}\n`;
          if (onboardingData.injuryHistory) prompt += `- Injury History: ${onboardingData.injuryHistory}\n`;
          if (onboardingData.scheduleConstraints) prompt += `- Schedule Constraints: ${onboardingData.scheduleConstraints}\n`;
          if (onboardingData.nickname) prompt += `- Nickname: ${onboardingData.nickname}\n`;
          
          prompt += `\nINFO FOR PLAN STRUCTURE:\n`; // Added section for clarity
          prompt += `- Current Training Phase: ${currentPhase}\n`; // ADDED
          prompt += `- Week Number in Plan: ${weeksSincePlanStart + 1}\n`; // ADDED (assuming weeksSincePlanStart is 0-indexed)

          if (latestFeedbackSummary) {
            prompt += `\nRecent feedback summary: ${latestFeedbackSummary}\n`;
          }

          let targetMondayString = 'current Monday';
          if (targetMondayDate) {
            const targetSundayDate = new Date(targetMondayDate);
            targetSundayDate.setUTCDate(targetMondayDate.getUTCDate() + 6);
            targetMondayString = targetMondayDate.toISOString().split('T')[0];
            const targetSundayString = targetSundayDate.toISOString().split('T')[0];
            prompt += `\nThe plan should be for the week starting Monday, ${targetMondayString}, and ending Sunday, ${targetSundayString}.\n`;
          }
          prompt += `\nPlease provide the plan as a JSON array, where each object has: \"day_of_week\" (1 for Monday, ..., 7 for Sunday), \"session_type\" (e.g., \"Easy Run\", \"Tempo Run\", \"Long Run\", \"Rest\", \"Strength Training\"), \"date\" (YYYY-MM-DD format for the specific day of the target week), \"distance\" (in ${onboardingData.units}, null if not applicable), \"time\" (in minutes, null if not applicable), \"notes\" (brief description or instructions, null if none). Ensure dates align with the target week starting ${targetMondayString} and are within this Mon-Sun range. Include a \"phase\": \"${currentPhase}\" and \"week_number\": ${weeksSincePlanStart + 1} in each session object.`;

          console.log("[planServiceDeno] Generating plan with prompt (first 300 chars):", prompt.substring(0,300));

          try {
            // Old v3 ChatCompletionRequestMessage type might not be needed if using v4 direct params
            const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
              { role: "system", content: "You are a highly experienced running coach. Generate detailed, personalized 7-day training plans." },
              { role: "user", content: prompt }
            ];

            // const completion = await openai.createChatCompletion({ // Old v3 call
            //   model: "gpt-4-turbo-preview",
            //   messages: messages,
            //   max_tokens: 1500,
            //   temperature: 0.5,
            // });
            const completion = await openai.chat.completions.create({ // New v4 call
              model: "gpt-4-turbo-preview",
              messages: messages,
              max_tokens: 1500,
              temperature: 0.5,
              // response_format: { type: "json_object" }, // Still an option in v4 if desired
            });

            // const content = completion.data.choices[0].message?.content; // Old v3 access
            const content = completion.choices[0].message?.content; // New v4 access
            if (!content) {
              console.error("[planServiceDeno] OpenAI response was empty.");
              return [];
            }

            // Attempt to parse the JSON from the content.
            // OpenAI might return text before/after the JSON block, so try to extract it.
            const jsonMatch = content.match(/\`\`\`json\n(\[[\s\S]*\])\n\`\`\`/);
            let planArray;
            if (jsonMatch && jsonMatch[1]) {
              planArray = JSON.parse(jsonMatch[1]);
            } else {
              // Fallback: try parsing the whole content if no markdown block found
              try {
                planArray = JSON.parse(content);
              } catch (e) {
                console.error("[planServiceDeno] Failed to parse OpenAI plan response as JSON:", content, e);
                // Potentially try to extract JSON from a less structured response or return error
                return [];
              }
            }
            
            if (!Array.isArray(planArray)) {
                console.error("[planServiceDeno] OpenAI response was not a JSON array:", planArray);
                return [];
            }

            // Validate and map to ensure correct structure, e.g., ensure 'date' field is included for each session.
            // The prompt asks for 'date', so the AI should provide it.
            return planArray
              .filter((item: AIPlanItem) => item.date) // Filter out items without dates
              .map((item: AIPlanItem, index: number) => ({
                day_of_week: item.day_of_week || (index + 1),
                session_type: item.session_type || "Generated Workout",
                date: item.date!, // Use ! since we filtered out undefined dates
                distance: item.distance ? Number(item.distance) : null,
                time: item.time ? Number(item.time) : null,
                notes: item.notes || null,
                week_number: item.week_number || (weeksSincePlanStart + 1), // Use AI's week_number or calculated
                phase: item.phase || currentPhase, // Use AI's phase or calculated currentPhase
              }));

          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error("[planServiceDeno] Raw error object from OpenAI call:", error);
            console.error("[planServiceDeno] Error calling OpenAI for plan generation (error.message):", errorMessage);
            if (error && typeof error === 'object' && 'response' in error) {
              console.error("[planServiceDeno] OpenAI error response data:", (error as ErrorWithResponse).response?.data);
            }
            throw new Error(`OpenAI plan generation failed: ${errorMessage}`);
          }
        }

        // --- Main Service Function ---
        export async function generateAndStoreCurrentWeekPlanForUserDeno(
          arquéClient: SupabaseClient,
          userId: string,
          targetMondayUtcDate: Date, // The specific Monday (UTC) for which to generate the plan
          latestFeedbackSummary?: string // Optional: from feedbackService
        ): Promise<boolean> {
          console.log(`[planServiceDeno] Starting plan generation for user ${userId}, target week starting ${targetMondayUtcDate.toISOString().split('T')[0]}`);

          const onboardingData = await getUserOnboardingDataDeno(arquéClient, userId);
          if (!onboardingData) {
            console.error(`[planServiceDeno] Failed to get onboarding data for user ${userId}. Cannot generate plan.`);
            return false;
          }

          // Calculate current training phase and weeksSincePlanStart
          // planStartDate will now always be populated from created_at
          const planStartDateForPhaseCalc = new Date(onboardingData.planStartDate + 'T00:00:00Z'); 

          // Ensure targetMondayUtcDate is treated as UTC for phase calculation
          // We need to be careful with timezones. targetMondayUtcDate IS already a UTC date object.
          const currentPhase = getTrainingPhaseDeno(onboardingData.raceDate, targetMondayUtcDate, planStartDateForPhaseCalc);
          
          // Calculate weeksSincePlanStart relative to targetMondayUtcDate
          const diffTime = Math.abs(targetMondayUtcDate.getTime() - planStartDateForPhaseCalc.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const weeksSincePlanStart = Math.floor(diffDays / 7);

          console.log(`[planServiceDeno] Plan Start Date (from created_at): ${onboardingData.planStartDate}, Target Monday: ${targetMondayUtcDate.toISOString().split('T')[0]}, Current Phase: ${currentPhase}, Weeks Since Plan Start: ${weeksSincePlanStart}`);

          // Calculate the end of the week (Sunday) for deletion range
          const targetSundayUtcDate = new Date(targetMondayUtcDate);
          targetSundayUtcDate.setUTCDate(targetMondayUtcDate.getUTCDate() + 6);
          const targetMondayString = targetMondayUtcDate.toISOString().split('T')[0];
          const targetSundayString = targetSundayUtcDate.toISOString().split('T')[0];

          // Delete existing workouts for the target week ONLY
          const deleteSuccess = await deleteWorkoutsForSpecificWeekDeno(arquéClient, userId, targetMondayString, targetSundayString);
          if (!deleteSuccess) {
            console.error(`[planServiceDeno] Failed to delete existing workouts for week ${targetMondayString}. Aborting plan generation.`);
            // Depending on desired behavior, you might choose to proceed or return false.
            // For now, returning false if deletion fails to prevent potential duplicates or partial overwrites.
            return false; 
          }

          // Generate new plan using AI
          const newRawSessions = await generateNewWeekPlanWithAI(
            onboardingData,
            currentPhase, // Pass calculated phase
            weeksSincePlanStart, // Pass weeks since start
            latestFeedbackSummary,
            targetMondayUtcDate
          );
          if (!newRawSessions || newRawSessions.length === 0) {
            console.error(`[planServiceDeno] No new sessions generated by AI for user: ${userId}`);
            // Depending on requirements, this might not be a hard fail if, for instance, deletion occurred
            // and the user just ends up with fewer/no sessions for the week.
            // For now, let's consider it a situation where no new plan is stored, but not a fatal error to block the function.
            return true; // Or false if this should halt everything
          }
          console.log(`[planServiceDeno] Generated ${newRawSessions.length} new raw sessions for user: ${userId}`);

          // Define variables that were missing
          const todayUtc = new Date();
          todayUtc.setUTCHours(0, 0, 0, 0);
          
          // For now, we'll assume there are no existing sessions to check against
          // In a real implementation, you'd fetch existing sessions first
          const existingSessions: ExistingSession[] = [];
          const hasInteractedSessionsInTargetWeek = false;

          // 4. Prepare and Save New Sessions (Careful Merge/Insert)
          const sessionsToInsert: TrainingSessionDeno[] = [];
          const nowISO = new Date().toISOString();

          for (const rawSession of newRawSessions) {
            if (!rawSession.date) {
                console.warn(`[planServiceDeno] Skipping session due to missing date from AI:`, rawSession);
                continue;
            }
            const newSessionDate = new Date(rawSession.date + 'T00:00:00.000Z'); // Ensure UTC context for comparison

            // Check if this new session is for a past day within the target week
            // AND if that week had interactions.
            if (newSessionDate < todayUtc && hasInteractedSessionsInTargetWeek) {
              const existingInteractedPastSession = existingSessions?.find(es => {
                const esDate = new Date(es.date + 'T00:00:00.000Z');
                const esNotes = es.notes || es.post_session_notes;
                return esDate.getTime() === newSessionDate.getTime() && 
                       (es.status !== 'not_completed' || (esNotes && String(esNotes).trim() !== ''));
              });

              if (existingInteractedPastSession) {
                console.log(`[planServiceDeno] Skipping save for newly generated past session on ${rawSession.date} as an interacted session already exists for user ${userId}`);
                continue; // Skip inserting this new past session, prioritize existing interacted one
              }
            }

            // If the date of the new session is before the target Monday (e.g. AI hallucinated), skip it.
            if (newSessionDate < targetMondayUtcDate) {
                console.log(`[planServiceDeno] Skipping session with date ${rawSession.date} as it's before target Monday ${targetMondayString}`);
                continue;
            }

            sessionsToInsert.push({
              ...rawSession,
              user_id: userId,
              status: 'not_completed',
              created_at: nowISO,
              updated_at: nowISO,
            });
          }

          if (sessionsToInsert.length > 0) {
            console.log(`[planServiceDeno] Attempting to insert ${sessionsToInsert.length} new plan sessions for user ${userId}`);
            const { error: insertError } = await arquéClient
              .from('training_plans')
              .insert(sessionsToInsert);

            if (insertError) {
              console.error(`[planServiceDeno] Error inserting new weekly plan sessions for user ${userId}:`, insertError);
              return false;
            }
            console.log(`[planServiceDeno] Successfully inserted ${sessionsToInsert.length} new plan sessions for user ${userId}`);
          } else {
            console.log(`[planServiceDeno] No new sessions needed to be inserted for user ${userId} (e.g., all were past, interacted days, or AI returned none).`);
          }
          
          return true;
        }

        // --- Phase Calculation Logic (Mirrored from planAnalysis.ts) ---

        // Helper to get the Monday of the week for a given JS Date (Deno version)
        function getMondayOfWeekDeno(date: Date): LocalDate {
          // JS Date month is 0-indexed, LocalDate month is 1-indexed
          const jsJodaDate = LocalDate.of(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
          return jsJodaDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        }

        // Helper to calculate full weeks between two Mondays (Deno version)
        function calculateFullWeeksBetweenMondaysDeno(date1Monday: LocalDate, date2Monday: LocalDate): number {
          if (date1Monday.isAfter(date2Monday)) return 0;
          return ChronoUnit.WEEKS.between(date1Monday, date2Monday);
        }

        // Main phase calculation function (Deno version)
        function getTrainingPhaseDeno(
          raceDateString?: string | null,
          currentDateForPhase: Date = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())),
          planStartDateJs?: Date | null
        ): string {
          const today = new Date(currentDateForPhase.valueOf()); // Clone to avoid modifying original
          // Ensure time components are zeroed out for consistent day-based comparisons, using UTC for Deno functions
          today.setUTCHours(0, 0, 0, 0);
          const currentWeekMonday = getMondayOfWeekDeno(today);

          const actualPlanStartDate = planStartDateJs ? new Date(planStartDateJs.valueOf()) : new Date(today.valueOf());
          actualPlanStartDate.setUTCHours(0, 0, 0, 0);
          const planStartMonday = getMondayOfWeekDeno(actualPlanStartDate);

          const basePeriodEndDateGlobal = planStartMonday.plusDays(13);

          if (raceDateString && raceDateString !== 'None') {
            const raceDayLd = LocalDate.parse(raceDateString);
            if (currentWeekMonday.isAfter(raceDayLd)) {
              const daysPastRaceStartOfWeek = ChronoUnit.DAYS.between(raceDayLd, currentWeekMonday);
              if (daysPastRaceStartOfWeek < 0) { 
                // This condition means current week is before race date, which shouldn't happen in this branch
                // Keep empty for now but could add logic if needed
              } else if (daysPastRaceStartOfWeek <= 6) { 
                return "Recovery";
              } else if (daysPastRaceStartOfWeek <= 13) { 
                return "Recovery";
              } else if (daysPastRaceStartOfWeek <= 20) { 
                return "Base";
              } else if (daysPastRaceStartOfWeek <= 27) { 
                return "Base";
              }
            }
          }

          if (raceDateString && raceDateString !== 'None') {
            const raceDayLd = LocalDate.parse(raceDateString);
            const daysTillRaceForPrimaryLogic = ChronoUnit.DAYS.between(currentWeekMonday, raceDayLd);

            if (daysTillRaceForPrimaryLogic >= -27) {
              const raceWeekMonday = raceDayLd.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
              const taperWeekMonday = raceWeekMonday.minusWeeks(1);
              const peakWeekMonday = taperWeekMonday.minusWeeks(1);

              if (currentWeekMonday.isEqual(raceDayLd.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))) && daysTillRaceForPrimaryLogic >=0) {
                return "Race Week";
              }
              if (currentWeekMonday.isEqual(taperWeekMonday)) {
                return "Taper";
              }
              if (currentWeekMonday.isEqual(peakWeekMonday)) {
                return "Peak";
              }

              if (currentWeekMonday.isBefore(peakWeekMonday)) {
                if (currentWeekMonday.isBefore(basePeriodEndDateGlobal.plusDays(1)) && 
                    (currentWeekMonday.isEqual(planStartMonday) || currentWeekMonday.isAfter(planStartMonday))) {
                  return "Base";
                }
                const weeksFromPeakToCurrent = calculateFullWeeksBetweenMondaysDeno(currentWeekMonday, peakWeekMonday.minusDays(1));
                const cyclePositionReversed = weeksFromPeakToCurrent % 4;
                if (cyclePositionReversed === 0) return "Base"; 
                if (cyclePositionReversed === 1) return "Build";
                if (cyclePositionReversed === 2) return "Build";
                if (cyclePositionReversed === 3) return "Build";
              }
            }
          }

          if (currentWeekMonday.isBefore(basePeriodEndDateGlobal.plusDays(1)) && 
              (currentWeekMonday.isEqual(planStartMonday) || currentWeekMonday.isAfter(planStartMonday))) {
            return "Base";
          }

          const weeksSincePlanStartForCycle = calculateFullWeeksBetweenMondaysDeno(planStartMonday, currentWeekMonday);
          const adjustedWeeksForCycle = weeksSincePlanStartForCycle - 2;
          if (adjustedWeeksForCycle < 0) {
              return "Base"; 
          }
          const cyclePositionForward = adjustedWeeksForCycle % 4;
          if (cyclePositionForward < 3) return "Build";
          return "Base";
        }