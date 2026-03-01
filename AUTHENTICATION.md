# Authentication System

This document describes the **refactored** authentication system that separates **Players** and **Admins**.

## Overview

### Player Authentication (Telegram Only)
- **Web:** Login via Telegram Widget
- **Mini App:** Auto-login using Telegram `initData`
- Phone number verification required for new users

### Admin Authentication (Phone + PIN Only)
- Traditional phone number + 6-digit PIN
- Only for users with `admin` or `subadmin` roles

## Environment Variables

### Backend (`backend/.env`)
```env
# JWT Secret
JWT_SECRET=your-secret-key

# Telegram Bot Token (get from @BotFather)
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Environment
NODE_ENV=development
```

### Frontend (`frontend/.env`)
```env
# Telegram Bot Username (without @ symbol)
VITE_BOT_USERNAME=your_bot_username
```

## API Endpoints

### Admin Authentication

#### Admin Login
```
POST /api/auth/admin-login
```

**Request Body:**
```json
{
  "phoneNumber": "+251912345678",
  "pin": "123456"
}
```

**Response (Success):**
```json
{
  "message": "Login successful",
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "name": "Admin Name",
    "phoneNumber": "+251912345678",
    "role": "admin"
  }
}
```

**Response (Not Admin):**
```json
{
  "message": "Access denied. This login is for administrators only."
}
```

### Player Authentication (Telegram)

#### Telegram Web Login
```
POST /api/auth/telegram-web
```

**Request Body:**
```json
{
  "authData": {
    "id": 123456789,
    "first_name": "John",
    "last_name": "Doe",
    "username": "johndoe",
    "photo_url": "https://...",
    "auth_date": 1699999999,
    "hash": "signature_hash"
  }
}
```

**Response (Existing User):**
```json
{
  "status": "SUCCESS",
  "message": "Login successful",
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "phoneNumber": "+251912345678",
    "telegramId": "123456789",
    "balance": 100,
    "points": 500
  }
}
```

**Response (New User - Needs Phone):**
```json
{
  "status": "NEEDS_PHONE_VERIFICATION",
  "message": "Please verify your phone number to complete registration",
  "temp_token": "temporary_jwt_token",
  "telegramUser": {
    "firstName": "John",
    "lastName": "Doe",
    "username": "johndoe"
  }
}
```

#### Telegram Mini App Login
```
POST /api/auth/telegram-miniapp
```

**Request Body:**
```json
{
  "initData": "query_id=AAHdF6...&user=%7B%22id%22...&auth_date=...&hash=..."
}
```

**Response:** Same as Telegram Web Login

### Phone Verification (For New Telegram Users)

#### Step 1: Send OTP
```
POST /api/auth/telegram/send-phone-otp
```

**Request Body:**
```json
{
  "phoneNumber": "+251912345678",
  "temp_token": "temporary_jwt_token_from_telegram_login"
}
```

**Response:**
```json
{
  "message": "OTP sent successfully",
  "otp": "123456" // Only in development mode
}
```

#### Step 2: Verify Phone
```
POST /api/auth/telegram/verify-phone
```

**Request Body:**
```json
{
  "phoneNumber": "+251912345678",
  "otp": "123456",
  "temp_token": "temporary_jwt_token"
}
```

**Response:**
```json
{
  "status": "SUCCESS",
  "message": "Registration successful",
  "token": "jwt_token_here",
  "user": { ... }
}
```

#### Mini App: Link Phone (for request_contact)
```
POST /api/auth/telegram/link-phone
```

**Request Body:**
```json
{
  "phoneNumber": "+251912345678",
  "temp_token": "temporary_jwt_token"
}
```

### Protected Routes

#### Get Profile
```
GET /api/auth/profile
Authorization: Bearer jwt_token_here
```

## Database Schema

### User Model

```javascript
{
  name: String (required),
  phoneNumber: String (required, unique),
  telegramId: String (unique, sparse - null allowed),
  telegramUsername: String,
  pin: String (hashed, for admins),
  balance: Number,
  isActive: Boolean,
  isVerified: Boolean,
  points: Number,
  role: "user" | "admin" | "subadmin",
  authMethod: "telegram" | "pin" | "both",
  lastLogin: Date,
  // ... other fields
}
```

## Frontend Components

### Player Auth Flow (Web)
1. **AuthPage** - Shows Telegram Login Widget
2. **PhoneVerificationModal** - For new users needing phone verification
3. **ProtectedRoute** - Redirects unauthenticated users to AuthPage

### Admin Auth Flow
1. **Login** (`/admin/login`) - Phone + PIN form
2. Admin AuthContext verifies role on token validation

## Security Features

### Telegram Signature Verification
- Web Widget: HMAC-SHA256 with SHA256(bot_token)
- Mini App: HMAC-SHA256 with HMAC("WebAppData", bot_token)
- Auth data expires after 24 hours

### Role-Based Access
- Admin endpoints reject non-admin users
- Player endpoints work for any authenticated user
- Token includes role claim for fast verification

### Token Management
- Player tokens: stored as `token` in localStorage
- Admin tokens: stored as `bingo_admin_token` in localStorage
- Tokens expire after 7 days

## Testing

### Manual Testing

1. **Player Login (Web):**
   - Navigate to `/auth`
   - Click Telegram Login Widget
   - If new user, enter phone and verify OTP
   - Should redirect to `/systemGames`

2. **Admin Login:**
   - Navigate to `/admin/login` (admin panel)
   - Enter phone number and 6-digit PIN
   - Should see dashboard if credentials valid

### Development Mode
- OTP codes are logged to console and returned in responses
- Set `NODE_ENV=development` in backend `.env`

## Migration Notes

### For Existing Users
- Users with existing phone + PIN can still log in via admin endpoint (if admin role)
- Players must now use Telegram to log in
- Existing player accounts can be linked when they log in with Telegram using the same phone number

### Deprecated Endpoints
- `POST /api/auth/login` - Returns deprecation warning
- `POST /api/auth/send-otp` - Kept for admin creation
- `POST /api/auth/verify-otp` - Kept for admin creation
