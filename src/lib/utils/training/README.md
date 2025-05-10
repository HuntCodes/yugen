# Training Utilities

This directory contains utilities specific to running training plans, workouts, and calculations.

## Organization

- `paceConversion.ts`: Convert between pace formats (min/km, min/mile, etc.)
- `planAnalysis.ts`: Analyze training plans for patterns and statistics
- `planGeneration.ts`: Generate training plans based on user profiles
- `sessionUtils.ts`: Session/workout manipulation and formatting utilities
- `workoutCalculations.ts`: Calculate training metrics (TSS, intensity, etc.)

## When to Add Here

Add utilities here when:
1. They perform training-specific calculations
2. They manipulate or format training plan data
3. They analyze or process workout-related information

## Usage Guidelines

- All functions should accept and return strongly typed data
- Use JSDoc comments to explain fitness or training concepts
- Keep pure calculation functions separate from formatting functions
- Maintain backward compatibility when making updates
- Consider performance when handling large training datasets 