# API Library

This directory contains API clients, configuration, and direct interfaces with external services.

## Organization

- `supabase.ts`: Supabase client configuration and initialization
- `config.ts`: API configuration settings
- `weeklyPlanGenerator.ts`: API functions for generating weekly training plans
- `/plan`: Plan-specific API utilities and generators

## Purpose

The API library provides low-level access to external services and data sources. These modules:

1. Initialize and configure API clients
2. Provide direct interfaces to external services
3. Handle authentication and credentials
4. Implement retry and error handling logic
5. Transform data between API and application formats

## Usage Guidelines

- Do not import these modules directly in UI components
- Access through service layer or hooks to maintain separation of concerns
- Keep authentication and configuration details isolated here
- Document API response formats and error codes
- Implement proper error handling with useful error messages
- Use TypeScript to strongly type API responses and parameters 