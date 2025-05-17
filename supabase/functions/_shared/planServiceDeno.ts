        // supabase/functions/_shared/planServiceDeno.ts
        import { arqué } from './arquéClient.ts'; // Supabase client for Deno
        import { type ChatCompletionRequestMessage, Configuration, OpenAIApi } from "https://esm.sh/openai@3.2.1";

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
          training_preferences?: string[] | null;
          nickname?: string | null;            // Was display_name
          injury_history?: string | null;
          schedule_constraints?: string | null; // Directly from profiles
        }

        interface OnboardingDataInternal {
          goalType: string;
          raceDate?: string;
          raceDistance?: string;
          experienceLevel: string;
          trainingFrequency: string;
          currentMileage: string;
          units: string;
          trainingPreferences?: string[];
          nickname?: string;
          injuryHistory?: string;
          scheduleConstraints?: string;
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

        // Initialize OpenAI client (similar to feedbackService.ts)
        const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
        let openai: OpenAIApi | null = null;
        if (openAiApiKey) {
          const configuration = new Configuration({
            apiKey: openAiApiKey,
          });
          openai = new OpenAIApi(configuration);
        } else {
          console.warn("[planServiceDeno] OPENAI_API_KEY is not set. AI plan generation will be disabled.");
        }

        // --- Helper: Fetch User Onboarding Data ---
        async function getUserOnboardingDataDeno(arquéClient: any, userId: string): Promise<OnboardingDataInternal | null> {
          console.log(`[planServiceDeno] Fetching onboarding data for user ${userId} from profiles table.`);
          const { data: profileData, error: profileError } = await arquéClient
            .from('profiles')
            .select('goal_type, race_date, race_distance, experience_level, current_frequency, current_mileage, units, training_preferences, nickname, injury_history, schedule_constraints')
            .eq('id', userId)
            .single();

          if (profileError || !profileData) {
            console.error(`[planServiceDeno] Error fetching profile for user ${userId}:`, profileError?.message);
            return null;
          }

          // Cast to UserProfileOnboarding to ensure we only use known fields from profiles
          const p = profileData as UserProfileOnboarding;

          return {
            goalType: p.goal_type || 'General fitness',
            raceDate: p.race_date || undefined,
            raceDistance: p.race_distance || undefined,
            experienceLevel: p.experience_level || 'beginner',
            trainingFrequency: p.current_frequency || '3-4 days per week',
            currentMileage: String(p.current_mileage || '20'), // Ensure string
            units: p.units || 'km',
            trainingPreferences: p.training_preferences || undefined,
            nickname: p.nickname || undefined,
            injuryHistory: p.injury_history || undefined,
            scheduleConstraints: p.schedule_constraints || undefined,
          };
        }

        // --- Helper: Remove Workouts (Conditional based on interaction) ---
        async function removeWorkoutsFromDateDeno(arquéClient: any, userId: string, fromDateUtcString: string): Promise<boolean> {
          console.log(`[planServiceDeno] Removing workouts for user ${userId} from date ${fromDateUtcString}`);
          const { error } = await arquéClient
            .from('training_plans')
            .delete()
            .eq('user_id', userId)
            .gte('date', fromDateUtcString);

          if (error) {
            console.error(`[planServiceDeno] Error removing workouts from ${fromDateUtcString} for user ${userId}:`, error);
            return false;
          }
          console.log(`[planServiceDeno] Successfully removed workouts from ${fromDateUtcString} for user ${userId}`);
          return true;
        }

        // --- Helper: Placeholder for AI Plan Generation Logic ---
        // This function would adapt your existing `generateTrainingPlan` from `src/lib/openai.ts`
        // or a similar AI call to generate a 7-day plan.
        async function generateNewWeekPlanWithAI(
          onboardingData: OnboardingDataInternal,
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
          if (onboardingData.trainingPreferences) prompt += `- Preferences: ${onboardingData.trainingPreferences.join(', ')}\n`;
          if (onboardingData.injuryHistory) prompt += `- Injury History: ${onboardingData.injuryHistory}\n`;
          if (onboardingData.scheduleConstraints) prompt += `- Schedule Constraints: ${onboardingData.scheduleConstraints}\n`;
          if (onboardingData.nickname) prompt += `- Nickname: ${onboardingData.nickname}\n`;

          if (latestFeedbackSummary) {
            prompt += `\nRecent feedback summary: ${latestFeedbackSummary}\n`;
          }
          if (targetMondayDate) {
            prompt += `\nThe plan should be for the week starting Monday, ${targetMondayDate.toISOString().split('T')[0]}.\n`;
          }
          prompt += `\nPlease provide the plan as a JSON array, where each object has: \"day_of_week\" (1 for Monday, ..., 7 for Sunday), \"session_type\" (e.g., \"Easy Run\", \"Tempo Run\", \"Long Run\", \"Rest\", \"Strength Training\"), \"date\" (YYYY-MM-DD format for the specific day of the target week), \"distance\" (in ${onboardingData.units}, null if not applicable), \"time\" (in minutes, null if not applicable), \"notes\" (brief description or instructions, null if none). Ensure dates align with the target week starting ${targetMondayDate ? targetMondayDate.toISOString().split('T')[0] : 'current Monday'}.`;

          console.log("[planServiceDeno] Generating plan with prompt (first 200 chars):", prompt.substring(0,200));

          try {
            const messages: ChatCompletionRequestMessage[] = [
              { role: "system", content: "You are a highly experienced running coach. Generate detailed, personalized 7-day training plans." },
              { role: "user", content: prompt }
            ];

            const completion = await openai.createChatCompletion({
              model: "gpt-4-turbo-preview", // Or your preferred model for plan generation
              messages: messages,
              // response_format: { type: "json_object" }, // If using a model that supports JSON mode and you structure the prompt accordingly
              max_tokens: 1500, // Adjust based on expected plan length
              temperature: 0.5, // Adjust for creativity/consistency
            });

            const content = completion.data.choices[0].message?.content;
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
            return planArray.map((item: any, index: number) => ({
                day_of_week: item.day_of_week || (index + 1),
                session_type: item.session_type || "Generated Workout",
                date: item.date, // Crucial: AI must provide this in YYYY-MM-DD for the target week
                distance: item.distance ? Number(item.distance) : null,
                time: item.time ? Number(item.time) : null,
                notes: item.notes || null,
                week_number: 1, // Or derive based on targetMondayDate for long-term plan tracking
            }));

          } catch (error: any) {
            console.error("[planServiceDeno] Error calling OpenAI for plan generation:", error.response ? error.response.data : error.message);
            throw new Error(`OpenAI plan generation failed: ${error.message}`);
          }
        }

        // --- Main Service Function ---
        export async function generateAndStoreCurrentWeekPlanForUserDeno(
          arquéClient: any,
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

          const mondayString = targetMondayUtcDate.toISOString().split('T')[0];
          const sundayDate = new Date(targetMondayUtcDate);
          sundayDate.setUTCDate(targetMondayUtcDate.getUTCDate() + 6);
          const sundayString = sundayDate.toISOString().split('T')[0];

          // 1. Fetch existing sessions for the target week (Mon-Sun)
          const { data: existingSessions, error: fetchError } = await arquéClient
            .from('training_plans')
            .select('id, date, status, notes, post_session_notes') // Added 'notes' to select, as schema has both
            .eq('user_id', userId)
            .gte('date', mondayString)
            .lte('date', sundayString);

          if (fetchError) {
            console.error(`[planServiceDeno] Error fetching existing sessions for user ${userId}:`, fetchError);
            return false; // Critical error
          }

          let hasInteractedSessionsInTargetWeek = false;
          if (existingSessions) {
            for (const session of existingSessions) {
              // Define "interacted": status is not 'not_completed', or there are notes
              // Adjust this logic based on your 'training_plans' table structure (e.g. column names for notes)
              const sessionNotes = session.notes || session.post_session_notes; // Example if notes can be in either field
              if (session.status !== 'not_completed' || (sessionNotes && String(sessionNotes).trim() !== '')) {
                hasInteractedSessionsInTargetWeek = true;
                break;
              }
            }
          }
          console.log(`[planServiceDeno] User ${userId} hasInteractedSessionsInTargetWeek (${mondayString}-${sundayString}): ${hasInteractedSessionsInTargetWeek}`);

          // 2. Conditional Deletion of workouts
          // The Edge function will call this for the *current* user's week (e.g. Mon June 10 - Sun June 16)
          // If user logs in on Wed June 12, targetMonday is June 10.
          // We need to decide what to clear.
          // Original logic: if interacted in target week, only clear from *today* (server time) onwards.
          // New server-side logic: the function is told the *exact Monday* of the week to plan for.
          // We should clear non-interacted future sessions for that week.
          // And preserve past interacted sessions within that week.

          const todayUtc = new Date();
          todayUtc.setUTCHours(0,0,0,0);
          const todayUtcString = todayUtc.toISOString().split('T')[0];

          if (!hasInteractedSessionsInTargetWeek) {
            // No interactions AT ALL in the target week (Mon-Sun). Safe to clear the whole target week.
            console.log(`[planServiceDeno] No interacted sessions in target week. Removing all sessions from ${mondayString} for user ${userId}`);
            await removeWorkoutsFromDateDeno(arquéClient, userId, mondayString);
          } else {
            // Interactions found within the target week. Only delete future, non-interacted items.
            // This means deleting any session in training_plans from *today* onwards.
            // This is simpler and safer than trying to pick out individual future non-interacted sessions.
            // The subsequent save logic will handle not overwriting past interacted ones.
            console.log(`[planServiceDeno] Interacted sessions found in target week. Removing sessions from ${todayUtcString} (today UTC) onwards for user ${userId}`);
            await removeWorkoutsFromDateDeno(arquéClient, userId, todayUtcString);
          }

          // 3. Generate new 7-day plan (Mon-Sun for the targetMondayUtcDate)
          const newRawSessions = await generateNewWeekPlanWithAI(onboardingData, latestFeedbackSummary, targetMondayUtcDate);
          if (!newRawSessions || newRawSessions.length === 0) {
            console.error(`[planServiceDeno] No new sessions generated by AI for user: ${userId}`);
            // Depending on requirements, this might not be a hard fail if, for instance, deletion occurred
            // and the user just ends up with fewer/no sessions for the week.
            // For now, let's consider it a situation where no new plan is stored, but not a fatal error to block the function.
            return true; // Or false if this should halt everything
          }
          console.log(`[planServiceDeno] Generated ${newRawSessions.length} new raw sessions for user: ${userId}`);

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
                console.log(`[planServiceDeno] Skipping session with date ${rawSession.date} as it's before target Monday ${mondayString}`);
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