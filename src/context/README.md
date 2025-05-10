# Context Directory

This directory contains React Context providers for global state management.

## Organization

- `AuthContext.tsx`: Authentication state provider and consumer hooks for login status and user data

## Purpose

Context providers enable global state management for data needed across multiple components. They:

1. Centralize shared application state
2. Provide consistent APIs for state updates
3. Optimize renders by preventing prop drilling
4. Maintain persistence of important application data
5. Simplify component access to global data

## When to Use Context

Add a new context provider when:
1. Data needs to be accessed by many unrelated components
2. State needs to persist across route changes
3. You need to avoid excessive prop drilling
4. Updates to shared state need to trigger multiple component renders

## Usage Guidelines

- Create specific contexts rather than one large app context
- Include custom hooks for consuming context (e.g., `useAuth()`)
- Keep context providers focused on a single domain of data
- Implement proper TypeScript types for context values and providers
- Consider performance implications of context updates 