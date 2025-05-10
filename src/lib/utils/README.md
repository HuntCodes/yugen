# Utils Directory

This directory contains utility functions organized by domain.

## Organization

- `dateUtils.ts`: Date formatting and manipulation utilities
- `messageUtils.ts`: Message parsing and formatting utilities
- `trackingUtils.ts`: Analytics and event tracking utilities
- `websocket.ts`: WebSocket client implementation for real-time features
- `/training/`: Running training-specific utilities and calculations

## When to Add Here

Add utility functions here when:
1. They provide reusable helper functions used across multiple components
2. They don't have UI dependencies
3. They handle generic tasks like formatting, parsing, or calculations

Domain-specific utilities should be grouped in subdirectories (like `/training`).

## Usage Guidelines

- Keep functions small and focused on a single responsibility
- Always write TypeScript and include JSDoc comments
- Export all functions as named exports
- Create an index.ts barrel file when adding new subdirectories 