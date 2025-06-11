import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

import { arqué } from '../_shared/arquéClient.ts'; // Use your Deno Supabase client
import { corsHeaders } from '../_shared/cors.ts';
import { processUserWeeklyFeedbackDeno } from '../_shared/feedbackService.ts';
import { generateAndStoreCurrentWeekPlanForUserDeno } from '../_shared/planServiceDeno.ts';

console.log('[fn_request_weekly_plan_update] Function initializing...');

// Helper to get Monday of a given date (all dates in UTC)
function getMondayUtc(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // Sunday = 0, Monday = 1, ...
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // Adjust if Sunday, else target Monday
  return new Date(d.setUTCDate(diff));
}

serve(async (req: Request) => {
  console.log(`[fn_request_weekly_plan_update] Request received: ${req.method}`);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 0. Parse request body for client's local date and location
    let clientLocalDateString: string | null = null;
    let latitude: number | null = null;
    let longitude: number | null = null;
    try {
      const body = await req.json();
      clientLocalDateString = body.clientLocalDateString;
      latitude = typeof body.latitude === 'number' ? body.latitude : null;
      longitude = typeof body.longitude === 'number' ? body.longitude : null;
      if (!clientLocalDateString || !/^\d{4}-\d{2}-\d{2}$/.test(clientLocalDateString)) {
        throw new Error(
          'Invalid or missing clientLocalDateString in request body. Expected YYYY-MM-DD.'
        );
      }
      // latitude & longitude are optional. If one is provided ensure both numbers else set to null
      if ((latitude !== null && longitude === null) || (latitude === null && longitude !== null)) {
        console.warn('[fn_request_weekly_plan_update] Incomplete location provided; ignoring.');
        latitude = null;
        longitude = null;
      }
    } catch (e) {
      console.warn(
        '[fn_request_weekly_plan_update] Could not parse JSON body or missing clientLocalDateString:',
        e instanceof Error ? e.message : e
      );
      // Fallback: use server's current UTC date if client date not provided or invalid
      // This maintains functionality but might not align perfectly with user's local week start
      const now = new Date();
      clientLocalDateString = now.toISOString().split('T')[0];
      latitude = null;
      longitude = null;
      console.warn(
        `[fn_request_weekly_plan_update] Defaulting to server UTC date for plan calculations: ${clientLocalDateString}`
      );
    }
    console.log(
      `[fn_request_weekly_plan_update] Using client/server date for calculations: ${clientLocalDateString}`
    );
    console.log('[fn_request_weekly_plan_update] Received location:', latitude, longitude);

    // 1. Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[fn_request_weekly_plan_update] Missing Authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Authorization header' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }
    const {
      data: { user },
      error: userError,
    } = await arqué.auth.getUser(authHeader.replace('Bearer ', ''));

    if (userError) {
      console.error('[fn_request_weekly_plan_update] Auth error:', userError.message);
      return new Response(
        JSON.stringify({ success: false, error: `Authentication error: ${userError.message}` }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }
    if (!user) {
      console.error('[fn_request_weekly_plan_update] User not authenticated');
      return new Response(JSON.stringify({ success: false, error: 'User not authenticated' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    const userId = user.id;
    console.log(`[fn_request_weekly_plan_update] Authenticated user: ${userId}`);

    // 2. Determine Target Dates
    // The clientLocalDateString is the user's local "today" when they determined a plan is needed.
    // We need a plan for the week (Mon-Sun) that this local "today" belongs to.
    const clientDateUtc = new Date(clientLocalDateString + 'T00:00:00.000Z'); // Treat as UTC to avoid timezone shifts here

    const targetPlanMondayUtcDate = getMondayUtc(clientDateUtc);
    console.log(
      `[fn_request_weekly_plan_update] Target plan week starts (UTC Monday): ${targetPlanMondayUtcDate.toISOString().split('T')[0]}`
    );

    // Feedback week is the full week *prior* to the target plan week.
    const feedbackWeekStartDateUtc = new Date(targetPlanMondayUtcDate);
    feedbackWeekStartDateUtc.setUTCDate(targetPlanMondayUtcDate.getUTCDate() - 7);

    const feedbackWeekEndDateUtc = new Date(feedbackWeekStartDateUtc);
    feedbackWeekEndDateUtc.setUTCDate(feedbackWeekStartDateUtc.getUTCDate() + 6);

    console.log(
      `[fn_request_weekly_plan_update] Feedback processing for week (UTC): ${feedbackWeekStartDateUtc.toISOString().split('T')[0]} to ${feedbackWeekEndDateUtc.toISOString().split('T')[0]}`
    );

    // 3. Process User Feedback for the PREVIOUS week
    let feedbackSummary: string | undefined = undefined;
    try {
      console.log(
        `[fn_request_weekly_plan_update] Calling processUserWeeklyFeedbackDeno for user: ${userId}`