# 🏃 Training Plan Upgrade Implementation

This doc outlines the upcoming improvements to the training plan generation system. These changes aim to reduce reliance on brittle structured output, introduce basic periodization logic, and better personalize week-to-week planning using recent training feedback.

## Here is a summary of the current process we use:

Training Plan Creation, Fallbacks, Adjustments, and Weekly Refresh

1. Training Plan Creation

AI-Generated Plan:
When a user completes onboarding or requests a new plan, the app sends their profile and training context to OpenAI, which returns a week-by-week JSON training plan. The plan is parsed, dates are updated, and it's saved to Supabase.

Fallback Plan:
If the AI response is invalid or missing, a robust fallback plan is generated in code, ensuring the user always receives a sensible, progressive plan.

2. Plan Adjustments
User-Initiated Adjustments:
Users can request changes to their plan via chat. The app sends the current plan and user feedback to OpenAI, which returns a specific modification (e.g., change distance, time, or date for a workout). The change is applied and confirmed to the user.

Rejection Handling:
If the user's message indicates they don't want a change, the adjustment is aborted.

3. Ongoing Plan Adaptation

Weekly Plan Generation:

The app can generate new weekly plans, factoring in recent chat summaries, workout completion stats, and user feedback. The AI is prompted to adapt the plan if the user is struggling or excelling.

4. Weekly Plan Refresh for All Users

Automated Refresh Script:

There is a script (scripts/refreshWeeklyPlans.ts) designed to be run by a cron job (e.g., every Sunday).
This script calls refreshAllUserPlans, which:
Fetches all users.
For each user, checks if their plan needs a refresh (e.g., it's Sunday or they have no future workouts).
If needed, removes future workouts and generates a new weekly plan using the latest user data and feedback.
Tracks and logs the number of successful, failed, and skipped refreshes.

Criteria for Refresh:
A user's plan is refreshed if it's Sunday (the designated refresh day) or if they have no future workouts scheduled.

The refresh process ensures users always have an up-to-date plan, even if they miss workouts or their context changes.

5. Error Handling & Edge Cases

No Plan Found:

If no plan exists for a user, a fallback plan is generated.

Parsing Failures:
If the AI returns an invalid plan, the fallback is used.

Date Corrections:
All plans are checked to ensure dates are current and not in the past.

Key Files Involved
src/lib/openai.ts, src/lib/api/weeklyPlanGenerator.ts: AI plan generation and fallback logic.
src/lib/utils/trainingUtils.ts: Fallback plan generation.
src/services/plan/planService.ts, src/services/plan/weeklyPlanService.ts: Plan fetching, saving, and weekly refresh logic.
src/hooks/chat/usePlanAdjustment.ts: Handles user-initiated plan adjustments.
scripts/refreshWeeklyPlans.ts: Script to refresh plans for all users (for cron/scheduled jobs).

In summary:
Your system not only creates and adapts personalized training plans (with robust fallbacks and user-driven adjustments), but also includes an automated process to refresh weekly plans for all users who need it. This ensures every user always has a current, relevant training plan, even if their circumstances or engagement change.
Let me know if you want a visual flow or more detail on any part!

---

## ✅ Summary of Changes

1. **Manual Phase Logic (Periodization)**
2. **Text-Based Training Plan Form (AI parses less, dev parses more)**
3. **Chat Summary + Training Notes Extraction Before Weekly Generation**

---

## 1. 🧱 Manual Phase Logic (Periodization)

We will manually define training phases based on the user's race date. Each generated week will now be labeled with a phase:

- **Base** (maintaining current volume in first week of the plan)
- **Build** (increasing volume 5% per week, up to a max of 160kms per week)
- **Peak** (starts on the 3rd monday before the taper)
- **Taper** (starts on the 2nd monday before the race)
- **Race Week** (starts on the monday before the race)
- **Recovery** (after 3 weeeks of build, a recovery week is needed 70% of highest peak mileage, also after a race)
- **Injured** (Instruct user to listen to medical advice)

### Implementation Plan:

- Add a new `getTrainingPhase(raceDate, currentDate)` utility in `lib/utils/trainingUtils.ts`
- Use this when generating each week to:
  - Label the current week with a `phase` string (e.g., `phase: "Build"`)
  - Modify the plan prompt to inform the AI:
    > "This is a [Build] phase. Continue progressing intensity, especially for Tuesday sessions. Maintain weekly volume."

COMPLETED. Summary of changes:
1. Added a comprehensive getTrainingPhase function in trainingUtils.ts that:
    - Determines training phases based on race date proximity (if available)
    - Implements a cyclical pattern (Base → 3 weeks Build → Recovery) when no race is scheduled
    - Handles race-specific phases (Build → Peak → Taper → Race Week → Recovery)
    - Accounts for plan start date to calculate appropriate cycles
2. Added the phase property to the TrainingSession interface in types/training.ts
3. Updated openai.ts (initial plan generation) to:
    - Calculate and include the appropriate training phase
    - Add phase-specific guidance in the prompt
    - Ensure all sessions include the phase property
    - Add phase to fallback plans
4. Updated weeklyPlanGenerator.ts (weekly plan generation) to:
    - Track plan start date from user profile
    - Calculate the current phase in the training cycle
    - Include phase-specific guidance in prompts
    - Ensure all generated sessions include the phase property

---

## 2. 📝 Text-Based Weekly Plan Form (AI Fills, We Parse)

Instead of relying on structured JSON (often flaky), we will give GPT a **plain text form** to fill out. We'll parse this on our end.

### Plan Prompt Format:

```
Please fill out this weekly training plan for [UserName] for [Week 6].

Week Number: [6]
Phase: [Build]

Monday:
- Type: [Easy Run]
- Distance: [8 km]
- Time: [40 minutes]
- Notes: [Run on soft surfaces if possible]

Tuesday:
- Type: [Intervals]
- Distance: [10 km incl. 5x800m at 5K pace]
- Time: [50 min]
- Notes: [Take 90 sec jog rest]

...

Sunday:
- Type: [Long Run]
- Distance: [16 km]
- Time: [~80 min]
- Notes: [Easy effort, trail preferred]
```

### Parser Implementation:

- Add a utility function `parseTextPlanToSessions()` in `lib/utils/trainingUtils.ts`
- This converts the plan text into session objects with:
  - `date`, `type`, `distance`, `time`, `notes`, `week_number`, `phase`

### Benefits:

- Improves reliability
- Easier to debug
- Human-readable for dev & test

COMPLETED. Summary of changes:
1. Added a comprehensive `parseTextPlanToSessions` function in trainingUtils.ts that:
   - Extracts week number and phase from text headers
   - Parses sessions for each day of the week
   - Handles various formats for distance and time values
   - Converts text fields to properly typed TrainingSession objects
2. Updated openai.ts (initial plan generation) to:
   - Use text-based form instead of JSON in the prompt
   - Parse the AI response using our new parser function
   - Improved fallback handling for parsing errors
3. Updated weeklyPlanGenerator.ts (weekly plan generation) to:
   - Use the same text-based form approach
   - Add plan start date awareness for week numbering
   - Parse responses with the new utility function
   - Improved error handling and fallbacks

---

## 3. 💬 Chat Summary + Training Notes Extraction

Right before each weekly plan is generated (e.g., every Sunday morning), extract key behavior from the user's:

- Chat logs
- Completed workout notes
- Feedback messages

### Categories to Extract:

- `prefers`: Types of sessions the user enjoys, consistent behaviors
- `struggling_with`: Sessions skipped, complained about, frequently adjusted
- `feedback_summary`: Brief user feedback ("Long run was too long", "Felt great")

### Prompt:

```
Extract the following based on the user's chat and recent training notes.

Prefers:
- [Intervals on Tuesday]
- [Easy pace long runs]

Struggling With:
- [Tempo workouts]
- [Back-to-back hard days]

Feedback Summary:
The user felt strong but found the long run too intense.
```

### Storage:

- Store extracted feedback in a new `user_training_feedback` table.
- Pass this as context when generating the next week's plan.

### Example Usage in Prompt:

```
User prefers doing intervals on Tuesday and long runs on Sunday. They've struggled with tempo runs and back-to-back hard efforts. Keep this in mind when designing the week.
```

COMPLETED. Summary of changes:
1. Created a comprehensive trainingFeedbackService.ts that:
   - Defines the TrainingFeedback interface with prefers, struggling_with, and feedback_summary fields
   - Extracts training data from chat messages, completed workouts, and skipped sessions
   - Processes this data using OpenAI to generate structured feedback insights
   - Stores the feedback in the user_training_feedback table for future reference
2. Updated the weeklyPlanGenerator.ts file to:
   - Import and use the getLatestTrainingFeedback function
   - Format the training feedback for use in the prompt
   - Include user preferences in the runner profile section
   - Add struggling areas as a subsection of workout patterns
   - Include a feedback summary section with recent insights
3. Enhanced the weekly plan refresh process to:
   - Process training feedback before generating new plans
   - Use a consistent date window for feedback processing
   - Properly handle the feedback data in the plan generation context
4. Updated the refreshWeeklyPlans.ts script to:
   - Process training feedback for all users as a separate step
   - Provide detailed logging of the feedback processing results
   - Track and report both feedback and plan refresh success states

---

## 📁 File Locations for Implementation

| Feature                           | File(s) To Update                                   |
| --------------------------------- | --------------------------------------------------- |
| Phase logic                       | `lib/utils/trainingUtils.ts`, optionally Supabase   |
| Text plan form prompt             | `lib/openai.ts` or `lib/api/weeklyPlanGenerator.ts` |
| Plan parser                       | `lib/utils/trainingUtils.ts`                        |
| Summary extraction prompt         | `lib/openai.ts`, new prompt builder                 |
| Feedback storage                  | `services/user/userService.ts`, Supabase schema     |
| Weekly plan gen context injection | `lib/api/weeklyPlanGenerator.ts`                    |

---

## ✅ MVP Goal

These changes should:

- Increase reliability of plan generation
- Add logical progression based on the race calendar
- Make the AI more personalized using simple preference data

No advanced reasoning or user modeling needed (yet).