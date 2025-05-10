# Training Hooks

This directory contains custom React hooks specific to training functionality.

## Organization

- `useMileageData.ts`: Manage and process runner mileage data

## When to Add Here

Add hooks here when:
1. They handle training plan state management
2. They process or analyze workout data
3. They interact with training-related UI
4. They need to manipulate or track fitness metrics

## Guidelines

- Keep hooks focused on one training aspect (plans, workouts, metrics)
- Consider breaking large hooks into smaller, more focused ones
- Use Supabase for data persistence when appropriate
- Return well-typed data from all hooks
- Include loading/error states for asynchronous operations 