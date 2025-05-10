# Navigation Directory

This directory contains navigation configuration for the application.

## Organization

- `AppNavigator.tsx`: Main navigation stack setup with route definitions and navigation logic based on auth state
- `TabNavigator.tsx`: Bottom tab navigation configuration for the main app screens
- `ProfileNavigator.tsx`: Nested navigation for profile-related screens 

## Purpose

The navigation files define the structure and flow of the application, including:

1. Screen routing and navigation paths
2. Authentication-dependent navigation logic
3. Tab and stack navigation hierarchies
4. Transition animations and navigation styling
5. Navigation parameters and types

## Usage Guidelines

- Keep navigation logic separate from screen components
- Define route parameters using TypeScript for type safety
- Use consistent naming conventions for routes
- Avoid deep nesting of navigators when possible
- Document expected route parameters in comments
- Use navigation context hooks for navigation outside of screen components 