# System-Hosted Game Implementation

## Overview

This document describes the rebuilt system-hosted game logic that operates completely independently from user-hosted games.

## Architecture

### Core Components

1. **SystemGameManager** (`backend/utils/systemGameManager.js`)

   - Centralized management of all system-hosted games
   - Handles game creation, player joining, timers, and cleanup
   - Completely separate from user-hosted game logic

2. **Socket Handlers** (`backend/sockets/gameSockets.js`)

   - Clean separation between system and user-hosted game events
   - System events: `joinSystemGame`, `systemGameUpdated`, `systemGameCountdown`, `systemGameStarted`, `systemGameTimeout`
   - User events: `joinUserGame`, `startUserGame` (preserved existing logic)

3. **Game Controller** (`backend/controller/game.controller.js`)
   - Updated to fetch system and user games separately
   - Maintains backward compatibility

## System Game Flow

### 1. Game Creation

- System automatically creates waiting rooms for bet amounts: `[10, 20, 50, 100]`
- Rooms are created on startup and when games transition to "playing"
- Each bet amount has exactly one waiting room at any time

### 2. Player Joining

- Players join by bet amount (not by specific game ID)
- System finds or creates waiting room for that bet amount
- Timer resets to 30 seconds whenever a new player joins
- Single player timeout starts if only one player in room

### 3. Timer Management

- **30-Second Game Start Timer**: Resets each time a player joins
- **2-Minute Single Player Timeout**: Starts when only one player in room
- Both timers are managed server-side with socket events

### 4. Game Transitions

- **Waiting → Playing**: After 30-second timer expires with 2+ players
- **Auto Room Regeneration**: New waiting room created when game starts
- **Single Player Timeout**: Player refunded and room deleted after 2 minutes

## Socket Events

### System Game Events

- `joinSystemGame` - Join a system game by bet amount
- `joinedSystemGame` - Confirmation of successful join
- `systemGameUpdated` - Player list and game state updates
- `systemGameCountdown` - 30-second countdown updates
- `systemGameStarted` - Game has started, redirect to playing
- `systemGameTimeout` - Single player timeout occurred

### User Game Events (Preserved)

- `joinUserGame` - Join a user-hosted game by game ID
- `joinedUserGameSuccessfully` - Confirmation of successful join
- `userGamePlayersUpdated` - Player list updates
- `startUserGame` - Host starts the game
- `userGameStarted` - Game has started

## Database Schema

Games are differentiated by the `isHosted` field:

- `isHosted: false` - System-hosted games
- `isHosted: true` - User-hosted games

## Configuration

```javascript
export const SYSTEM_BET_AMOUNTS = [10, 20, 50, 100];
export const GAME_START_COUNTDOWN = 30; // seconds
export const SINGLE_PLAYER_TIMEOUT = 120; // 2 minutes
export const MAX_PLAYERS_PER_SYSTEM_GAME = 10;
```

## Frontend Integration

- Lobby shows system games with "🤖 System Game" indicator
- GameRoom handles both system and user-hosted games
- Automatic redirects to playing screen when games start
- Toast notifications for timeouts and refunds

## Testing Scenarios

1. **Multiple Players Joining**: Timer resets each time
2. **Timer Expiring with 2+ Players**: Game starts, new room created
3. **Player Leaving Before Timer**: Room continues, timer unaffected
4. **Single Player Timeout**: Player refunded, room deleted
5. **Server Restart**: System games recreated on startup

## Cleanup & Maintenance

- Orphaned timers cleaned up every minute
- Finished games deleted after 1 hour
- Memory-efficient timer management
- Race condition prevention with locks

## Benefits of New Implementation

1. **Clean Separation**: System and user games completely independent
2. **Reliable Timers**: Server-side management prevents desync
3. **Better UX**: Automatic room regeneration and proper notifications
4. **Maintainable**: Clear code structure and documentation
5. **Scalable**: Easy to add new bet amounts or modify timers

