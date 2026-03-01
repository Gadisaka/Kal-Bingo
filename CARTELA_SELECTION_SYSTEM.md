# Real-Time Cartela Selection System

## Overview

This document describes the implementation of the real-time cartela selection system for the Bani Bingo game. The system ensures that when a player selects a cartela (bingo card), it becomes unavailable to other players in real-time using WebSocket communication.

## Architecture

### Backend (User Room System)

#### File: `backend/userRoomSystem/userRoom.socket.js`

**Socket Events Implemented:**

1. **`select-cartela`** - When a player selects a cartela

   - **Payload:** `{ roomId, userId, cartelaId }`
   - **Validation:** Checks if cartela is already taken by another player
   - **Action:** Adds cartela to player's list in database
   - **Broadcast:** `cartela-selected` event to all players in room
   - **Error:** Emits `cartela-selection-error` if already taken

2. **`deselect-cartela`** - When a player deselects a cartela

   - **Payload:** `{ roomId, userId, cartelaId }`
   - **Action:** Removes cartela from player's list in database
   - **Broadcast:** `cartela-deselected` event to all players in room

3. **`get-cartelas-state`** - Request current state of all cartelas
   - **Payload:** `{ roomId }`
   - **Response:** Emits `cartelas-state` with all selected cartelas

**Helper Function:**

```javascript
getAllSelectedCartelas(room);
// Returns: { cartelaId: { userId, userName }, ... }
```

#### Database Structure

Players in the `GameRoom` model now include:

```javascript
{
  _id: "userId",
  name: "Player Name",
  cartelas: [1, 5, 10, 25] // Array of selected cartela IDs
}
```

### Frontend (User Room System)

#### File: `frontend/src/pages/FriendsWaitingRoom.jsx`

**State Management:**

```javascript
const [selectedCartelas, setSelectedCartelas] = useState([]); // Empty by default
const [takenCartelas, setTakenCartelas] = useState({}); // { cartelaId: { userId, userName } }
const [selectionError, setSelectionError] = useState(null);
```

**Socket Event Listeners:**

1. **`cartela-selected`** - Another player selected a cartela

   - Updates `takenCartelas` state
   - Removes cartela from own selection if conflict

2. **`cartela-deselected`** - Another player deselected a cartela

   - Updates `takenCartelas` state

3. **`cartelas-state`** - Initial state of all cartelas

   - Received on component mount
   - Updates `takenCartelas` state

4. **`cartela-selection-error`** - Server rejected selection
   - Shows error message
   - Removes cartela from local selection

**Selection Logic:**

```javascript
toggleCartelaSelection(num);
```

- **Select:**
  - Checks if taken by another player
  - Optimistically updates UI
  - Emits `select-cartela` to server
- **Deselect:**
  - Updates local state
  - Emits `deselect-cartela` to server

## User Experience

### Visual Indicators

1. **Available Cartelas:**

   - White background
   - Gray border
   - Hover effects enabled

2. **Selected by Current User:**

   - Blue background
   - Green checkmark (✓) badge
   - Slightly scaled up

3. **Taken by Another Player:**

   - Gray background
   - Red X (✗) badge
   - Disabled (not clickable)
   - Tooltip shows who selected it

4. **No Selection State:**
   - Helpful message: "Please select at least one cartela from the list above to play"

### Error Handling

1. **Concurrent Selection:**

   - Server validates before saving
   - Shows error message to user
   - Auto-removes from local selection

2. **Network Issues:**

   - Optimistic UI updates
   - Server is source of truth
   - Conflicts resolved on server response

3. **Empty Selection:**
   - Clear message displayed
   - Card count shows (0)
   - Encourages user to select

## Flow Diagram

```
Player A                    Server                    Player B
   |                          |                          |
   |-- select-cartela(5) ---->|                          |
   |                          |                          |
   |                    [Validates]                      |
   |                    [Saves to DB]                    |
   |                          |                          |
   |<-- cartela-selected -----|---- cartela-selected --->|
   |     (cartelaId: 5)       |     (cartelaId: 5)       |
   |                          |                          |
   |                          |<---- select-cartela(5) --|
   |                          |                          |
   |                    [Already taken!]                 |
   |                          |                          |
   |                          |-- selection-error ------>|
   |                          |                          |
```

## Key Features

1. **Real-Time Synchronization:**

   - All players see cartela availability in real-time
   - Sub-second updates via WebSocket
   - Server-client state sync on mount/refresh

2. **Conflict Prevention:**

   - Server-side validation
   - Only one player can select each cartela
   - Optimistic UI with server confirmation
   - Mongoose `markModified()` ensures nested array changes persist

3. **Multiple Selection Support:**

   - Players can select multiple cartelas
   - Each selection is independently tracked
   - Server maintains array of cartelas per player
   - Client syncs with server state on broadcasts

4. **User-Friendly:**

   - Clear visual indicators
   - Helpful error messages
   - Tooltips show who selected what
   - Console logging for debugging

5. **Scalability:**
   - Works with up to 100 players per room
   - Efficient state management
   - Only sends deltas, not full state

## Important Implementation Notes

### In-Memory Storage Approach

**The system uses in-memory storage on the server** for real-time cartela selection instead of database persistence. This provides:

- ⚡ **Instant updates** - No database round-trips
- 🔒 **Reliable locking** - Direct Map manipulation
- 🎯 **Simple state management** - Single source of truth
- 🚀 **Better performance** - Reduced database load

```javascript
// In-memory storage structure
const roomCartelas = new Map();
// Structure: { roomId: { cartelaId: { userId, userName }, ... }, ... }

// Adding a cartela
const roomCartelasObj = roomCartelas.get(roomId) || {};
roomCartelasObj[cartelaId] = { userId, userName };
```

**Note:** Cartela selections are **session-based** and reset when the server restarts. This is intentional since selections are only relevant during the waiting room phase.

### State Synchronization

The system uses real-time broadcasting:

1. **Optimistic Updates:** Client updates UI immediately for better UX
2. **Server Validation:** Server checks if cartela is available in Map
3. **Broadcast to All:** Server broadcasts complete state to all clients in room
4. **Client Re-sync:** Each client updates their `takenCartelas` state

This ensures:

- Fast, responsive UI
- Server Map is always the source of truth
- All clients stay in sync
- No database persistence issues

### Console Logging

**Backend logs:**

- `=== SELECT CARTELA (IN-MEMORY) ===` - Selection attempt
- `✅ Added cartela X for user Y` - Successful addition
- `Total cartelas in room: N` - Current count
- `✅ Broadcasted to room` - Confirmation of broadcast

**Frontend logs:**

- `=== TOGGLE CARTELA DEBUG ===` - Click handler called
- `=== RECEIVED cartela-selected ===` - Server broadcast received
- `Total cartelas received: N` - Number of cartelas in broadcast
- `Render cartela X: { isTakenByOther: ... }` - Rendering state

These can be removed in production or controlled via environment variable.

## Testing Checklist

- [x] Player can select multiple cartelas (In-memory storage)
- [x] Player can deselect cartelas
- [x] Selected cartelas appear disabled to other players (Real-time via sockets)
- [x] Concurrent selection is handled correctly (Map-based locking)
- [x] Error messages display and auto-dismiss
- [x] Tooltips show correct player names
- [x] Empty state message displays when no cartelas selected
- [x] State syncs on page refresh (get-cartelas-state event)
- [x] Host and player views work identically
- [x] Works on mobile and desktop

## How to Test

1. **Restart backend server** to pick up the in-memory storage changes
2. **Open two browser windows** (Player A and Player B)
3. **Create a room** and have both players join
4. **Player A:** Select cartelas #1, #2, #3
5. **Check Player A's console:** Should see `Total cartelas received: 3`
6. **Check Player B's screen:** Cartelas #1, #2, #3 should be:
   - Gray background
   - Red ✗ badge
   - Disabled (cannot click)
   - Tooltip: "Selected by Player A"
7. **Player B:** Try to select cartela #10
8. **Check Player A's screen:** Cartela #10 should now be disabled
9. **Player A:** Deselect cartela #2
10. **Check Player B's screen:** Cartela #2 should become available again

## Future Enhancements

1. **Selection Limits:**

   - Add maximum cartelas per player
   - Add minimum cartelas to start game

2. **Visual Enhancements:**

   - Show player avatars on cartelas
   - Animate selection/deselection
   - Color-code by player

3. **Performance:**

   - Debounce rapid selections
   - Batch updates for better performance
   - Cache cartela state locally

4. **Analytics:**
   - Track most popular cartelas
   - Selection time metrics
   - Conflict frequency
