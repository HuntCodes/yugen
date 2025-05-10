# Chat Services

This directory contains services that manage chat interactions with AI coaches.

## Organization

- `chatService.ts`: Core service for managing chat conversations with AI coaches
  - Handles message processing, sending, and retrieval
  - Integrates with OpenAI for coach responses
  - Manages conversation context and history

## Purpose

The chat services provide a separation layer between UI components and the underlying data/API interactions for chat functionality. They:

1. Abstract API calls to OpenAI
2. Handle persistence of chat messages
3. Manage conversation context windows
4. Format messages for display
5. Process user intents from messages

## Usage Guidelines

- Use these services from hooks rather than directly in components
- Keep business logic (parsing, analysis) in the services
- UI-specific transformations should be in hooks or components
- Error handling should be implemented at the service level
- Cache responses when appropriate for performance 