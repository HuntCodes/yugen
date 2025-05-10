# Plan Services

This directory contains services that manage training plan operations.

## Organization

- `planService.ts`: Core service for managing training plans
  - CRUD operations for training plans
  - Plan adjustment and modifications
  - Plan status tracking
  
- `weeklyPlanService.ts`: Service specific to weekly training plans
  - Weekly plan generation
  - Weekly plan updates and progression
  - Week-specific operations and analysis

## Purpose

The plan services provide a separation layer between UI components and the underlying data operations for training plans. They:

1. Handle persistence of training plans in Supabase
2. Generate and update training plans
3. Process user adjustments to plans
4. Track plan completion and progress
5. Synchronize plan data across devices

## Usage Guidelines

- Access these services through hooks rather than directly in components
- Keep plan generation logic separate from plan storage logic
- Include error handling for all database operations
- Use typed returns for all service functions
- Cache plan data when appropriate for better performance
- Implement logging for significant plan changes 