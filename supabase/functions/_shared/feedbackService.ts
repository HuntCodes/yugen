        // supabase/functions/_shared/feedbackService.ts
        import { type ChatCompletionRequestMessage, Configuration, OpenAIApi } from "https://esm.sh/openai@3.2.1";

        // Define proper type for Supabase client (similar to planServiceDeno.ts)
        interface SupabaseQueryBuilder {
          eq: (column: string, value: string) => SupabaseQueryBuilder;
          gte: (column: string, value: string) => SupabaseQueryBuilder;
          lte: (column: string, value: string) => SupabaseQueryBuilder;
          lt: (column: string, value: string) => SupabaseQueryBuilder;
          order: (column: string, options: { ascending: boolean }) => SupabaseQueryBuilder;
          select: (columns: string) => SupabaseQueryBuilder;
          single: () => Promise<{ data: unknown; error: { message?: string } | null }>;
        }

        interface SupabaseInsertBuilder {
          select: () => SupabaseInsertBuilder;
          single: () => Promise<{ data: unknown; error: { message?: string } | null }>;
        }

        interface SupabaseClient {
          from: (table: string) => {
            select: (columns: string) => SupabaseQueryBuilder & Promise<{ data: unknown; error: { message?: string } | null }>;
            insert: (data: unknown[]) => SupabaseInsertBuilder;
          };
        }

        interface TrainingPlanItem {
          date: string;
          session_type?: string;
          notes?: string;
          post_session_notes?: string;
          status?: string;
        }

        interface ChatMessage {
          created_at: string;
          message: string;
          sender: string;
        }

        // --- Type Definitions ---
        interface UserProfile {
          id: string;
          // timezone?: string; // Removed as not in schema image for profiles table
        }

        // Represents a workout note derived from training_plans for feedback purposes
        interface WorkoutNoteForFeedback {
          date: string; // YYYY-MM-DD of the workout
          session_type?: string | null;
          user_notes?: string | null; // Combined from notes and post_session_notes
          status?: string | null;
        }

        // Represents a chat message from coach_messages table
        interface ChatMessageForFeedback {
          created_at: string;
          message_content: string; // from 'message' column
          sender_role: string; // from 'sender' column
        }

        interface ProcessedFeedback {
          user_id: string;
          week_start_date: string; // YYYY-MM-DD, Monday of the feedback week
          feedback_summary: string; // Maps to feedback_summary in user_training_feedback
          raw_data: {
            chat_messages: ChatMessageForFeedback[];
            workout_notes: WorkoutNoteForFeedback[];
          }; // Maps to raw_data (jsonb) in user_training_feedback
        }

        const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
        let openai: OpenAIApi | null = null;
        if (openAiApiKey) {
          const configuration = new Configuration({
            apiKey: openAiApiKey,
          });
          openai = new OpenAIApi(configuration);
        } else {
          console.warn("[feedbackService] OPENAI_API_KEY is not set. OpenAI dependent features will be disabled.");
        }

        // --- Feedback Fetching Logic ---
        // Fetches workout notes from training_plans table for a given week
        async function getWorkoutNotesForWeekDeno(arquéClient: SupabaseClient, userId: string, startDateString: string, endDateString: string): Promise<WorkoutNoteForFeedback[]> {
          console.log(`[feedbackService] Fetching workout notes for user ${userId} from training_plans between ${startDateString} and ${endDateString}`);
          const queryResult = await (arquéClient
            .from('training_plans')
            .select('date, session_type, notes, post_session_notes, status')
            .eq('user_id', userId)
            .gte('date', startDateString) // Assuming date is timestamptz, YYYY-MM-DD will work
            .lte('date', endDateString)   // Assuming date is timestamptz, YYYY-MM-DD will work for end of day
            .order('date', { ascending: true }) as unknown as Promise<{ data: TrainingPlanItem[] | null; error: { message?: string } | null }>);

          const { data, error } = queryResult;
          if (error) {
            console.error('[feedbackService] Error fetching workout notes from training_plans:', error);
            throw new Error(`Failed to fetch workout notes: ${error.message}`);
          }

          const notesForFeedback: WorkoutNoteForFeedback[] = (data || []).map((plan_item: TrainingPlanItem) => {
            let userNotes = '';
            if (plan_item.notes) userNotes += plan_item.notes + ' ';
            if (plan_item.post_session_notes) userNotes += plan_item.post_session_notes;
            return {
              date: new Date(plan_item.date).toISOString().split('T')[0], // Store as YYYY-MM-DD
              session_type: plan_item.session_type,
              user_notes: userNotes.trim() || null,
              status: plan_item.status,
            };
          }).filter(note => note.user_notes); // Only include if there are actual notes

          console.log(`[feedbackService] Fetched ${notesForFeedback.length} workout notes with actual content.`);
          return notesForFeedback;
        }

        async function getChatMessagesForWeekDeno(arquéClient: SupabaseClient, userId: string, startDateISO: string, endDateISO: string): Promise<ChatMessageForFeedback[]> {
          console.log(`[feedbackService] Fetching chat messages for user ${userId} from coach_messages between ${startDateISO} and ${endDateISO}`);
          const queryResult = await (arquéClient
            .from('coach_messages') // Changed from 'chat_messages' to 'coach_messages'
            .select('created_at, message, sender') // Selected schema fields
            .eq('user_id', userId)
            .gte('created_at', startDateISO)
            .lt('created_at', endDateISO)
            .order('created_at', { ascending: true }) as unknown as Promise<{ data: ChatMessage[] | null; error: { message?: string } | null }>);

          const { data, error } = queryResult;
          if (error) {
            console.error('[feedbackService] Error fetching chat messages:', error);
            throw new Error(`Failed to fetch chat messages: ${error.message}`);
          }
          
          const messagesForFeedback: ChatMessageForFeedback[] = (data || []).map((msg: ChatMessage) => ({
            created_at: msg.created_at,
            message_content: msg.message,
            sender_role: msg.sender,
          }));

          console.log(`[feedbackService] Fetched ${messagesForFeedback.length} chat messages.`);
          return messagesForFeedback;
        }

        // --- Feedback Analysis Logic ---
        async function analyzeFeedbackWithOpenAI(
          chatMessages: ChatMessageForFeedback[],
          workoutNotes: WorkoutNoteForFeedback[]
        ): Promise<string> {
          if (!openai) {
            console.warn("[feedbackService] OpenAI client not initialized. Skipping feedback analysis.");
            return "OpenAI analysis skipped due to missing API key or client initialization failure.";
          }

          const promptContent = `Analyze the following user interactions for the past week to understand their workout progress, challenges, and overall sentiment. Provide a concise summary.

Workout Notes:
${workoutNotes.length > 0 ? workoutNotes.map(note => `- Note on ${note.date} (${note.session_type || 'general'}, status: ${note.status || 'unknown'}): "${note.user_notes}"`).join('\n') : 'No workout notes logged.'}

Chat Messages:
${chatMessages.length > 0 ? chatMessages.map(msg => `- ${msg.sender_role} at ${new Date(msg.created_at).toLocaleString()}: "${msg.message_content}"`).join('\n') : 'No chat messages logged.'}

Based on this data, what are the key takeaways for this user's week? Highlight any reported pain, successes, and overall consistency.
Summary:`;

          try {
            const messages: ChatCompletionRequestMessage[] = [
                { role: "system", content: "You are an expert fitness assistant analyzing user's weekly feedback." },
                { role: "user", content: promptContent }
              ];
            const completion = await openai.createChatCompletion({
              model: "gpt-3.5-turbo", messages, max_tokens: 350, temperature: 0.4,
            });
            const summary = completion.data.choices[0].message?.content?.trim();
            if (!summary) {
              console.error("[feedbackService] OpenAI response was empty.");
              return "Failed to generate summary from OpenAI: Empty response.";
            }
            return summary;
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            let detailedError = errorMessage;
            if (error && typeof error === 'object' && 'response' in error) {
              const errorResponse = error as { response?: { data?: { error?: { message?: string } } } };
              if (errorResponse.response?.data?.error) {
                detailedError = errorResponse.response.data.error.message || errorMessage;
              }
            }
            console.error("[feedbackService] Error calling OpenAI for feedback analysis:", detailedError);
            throw new Error(`OpenAI API request failed: ${detailedError}`);
          }
        }

        // --- Feedback Storage Logic ---
        async function storeProcessedFeedback(arquéClient: SupabaseClient, feedbackData: ProcessedFeedback): Promise<ProcessedFeedback> {
          console.log(`[feedbackService] Storing processed feedback for user ${feedbackData.user_id} for week starting ${feedbackData.week_start_date}`);
          // Map to user_training_feedback schema
          const { data, error } = await arquéClient
            .from('user_training_feedback')
            .insert([{
              user_id: feedbackData.user_id,
              week_start_date: feedbackData.week_start_date,
              feedback_summary: feedbackData.feedback_summary,
              raw_data: feedbackData.raw_data, // This is already the correct structure
              // 'prefers' and 'struggling_with' could be populated here if derived from AI summary
            }])
            .select()
            .single();

          if (error) {
            console.error('[feedbackService] Error storing processed feedback:', error);
            throw new Error(`Failed to store processed feedback: ${error.message}`);
          }
          if (!data) {
            console.error('[feedbackService] No data returned after storing processed feedback');
            throw new Error('Failed to store processed feedback: No data returned');
          }
          console.log('[feedbackService] Processed feedback stored successfully.');
          // Return in the ProcessedFeedback structure expected by the calling function (index.ts)
          const storedData = data as { user_id: string; week_start_date: string; feedback_summary: string; raw_data: { chat_messages: ChatMessageForFeedback[]; workout_notes: WorkoutNoteForFeedback[]; } };
          return {
            user_id: storedData.user_id,
            week_start_date: storedData.week_start_date,
            feedback_summary: storedData.feedback_summary,
            raw_data: storedData.raw_data,
          };
        }

        // --- Main Service Function ---
        export async function processUserWeeklyFeedbackDeno(
          arquéClient: SupabaseClient,
          userId: string,
          feedbackWeekStartDate: Date, // Monday of the week for which to process feedback
          feedbackWeekEndDate: Date    // Sunday of the week (inclusive)
        ): Promise<ProcessedFeedback> {
          console.log(`[feedbackService] Starting feedback processing for user ${userId}, week: ${feedbackWeekStartDate.toISOString().split('T')[0]} to ${feedbackWeekEndDate.toISOString().split('T')[0]}`);

          // User profile not strictly needed anymore if timezone is removed from prompt context
          // const { data: userProfileData, error: userProfileError } = await arquéClient
          //   .from('profiles').select('id').eq('id', userId).single();
          // if (userProfileError || !userProfileData) {
          //   console.error(`[feedbackService] Error fetching user profile for ${userId}:`, userProfileError);
          //   throw new Error(`Could not fetch user profile for ${userId}: ${userProfileError?.message || 'Not found'}`);
          // }

          const feedbackWeekStartString = feedbackWeekStartDate.toISOString().split('T')[0];
          const feedbackWeekEndString = feedbackWeekEndDate.toISOString().split('T')[0]; 
          // For chat messages (created_at TIMESTAMPTZ), use full ISO strings for precise range
          const chatMessagesEndDate = new Date(feedbackWeekEndDate);
          chatMessagesEndDate.setDate(chatMessagesEndDate.getDate() + 1); 
          const chatMessagesEndISO = chatMessagesEndDate.toISOString();

          const workoutNotes = await getWorkoutNotesForWeekDeno(arquéClient, userId, feedbackWeekStartString, feedbackWeekEndString);
          const chatMessages = await getChatMessagesForWeekDeno(arquéClient, userId, feedbackWeekStartDate.toISOString(), chatMessagesEndISO);

          let summary = "No new feedback to analyze for this period."; 
          if (workoutNotes.length > 0 || chatMessages.length > 0) {
              if (openai) {
                summary = await analyzeFeedbackWithOpenAI(chatMessages, workoutNotes);
              } else {
                let basicSummary = "User Feedback Summary (OpenAI unavailable):\n";
                if (workoutNotes.length > 0) basicSummary += `  - Logged ${workoutNotes.length} workout note(s).\n`;
                if (chatMessages.length > 0) basicSummary += `  - Had ${chatMessages.length} chat message(s).\n`;
                summary = basicSummary;
              }
          } else {
              summary = "No workout notes or chat messages found for the feedback period.";
          }

          const processedFeedbackData: ProcessedFeedback = {
            user_id: userId,
            week_start_date: feedbackWeekStartString,
            feedback_summary: summary,
            raw_data: {
              chat_messages: chatMessages,
              workout_notes: workoutNotes,
            },
          };

          const storedFeedback = await storeProcessedFeedback(arquéClient, processedFeedbackData);
          console.log(`[feedbackService] Feedback processing complete for user ${userId}`);
          return storedFeedback;
        }

        // Removed unused global declaration for supabaseAdminClient and getSupabaseAdmin function
        // as the client (arquéClient) is now passed as a parameter.