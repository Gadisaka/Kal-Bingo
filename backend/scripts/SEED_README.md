# Database Seeding Guide

This guide explains how to seed your database with all necessary data, configurations, and settings for VPS deployment.

## Quick Start

Run the comprehensive seed script that sets up everything:

```bash
npm run seed:all
```

Or directly:

```bash
node scripts/seedAll.js
```

## What Gets Seeded

The `seedAll.js` script seeds the following:

### 1. Admin User
- Creates a default admin user with:
  - Name: `ADMIN_NAME` env var or "Admin"
  - Phone: `ADMIN_PHONE` env var or "0911223344"
  - PIN: `ADMIN_PIN` env var or "admin123"
  - Role: admin
  - Creates associated wallet

### 2. System Configuration
- Points system (per play, per win, registration, streaks)
- Spin configuration (cost, rewards, odds)
- Tier thresholds (Bronze, Silver, Gold, Platinum, Diamond)
- Leaderboard configuration (ranking criteria, prizes)

### 3. Application Settings
- System games settings (max players, stakes, intervals, win cut)
- User games settings (max players, stakes, host share)
- Deposit/Withdrawal limits
- Telebirr account configuration
- Spin and bonus feature flags

### 4. Bot Game Configurations
- Bot configurations for each game stake amount
- Bot win rates (adjusted by stake amount)
- Bot join delays
- Active/inactive status

## Environment Variables

Before running the seed script, make sure your `.env` file has:

```env
# Database
MONGO_URI=your_mongodb_connection_string

# Admin User (Optional - defaults provided)
ADMIN_NAME=Admin
ADMIN_PHONE=0911223344
ADMIN_PIN=admin123

# Telebirr Account (Optional)
TELEBIRR_ACCOUNT_NAME=Your Account Name
TELEBIRR_PHONE=0912345678
```

## Running on VPS

### Step 1: Navigate to backend directory
```bash
cd backend
```

### Step 2: Install dependencies (if not already done)
```bash
npm install
```

### Step 3: Ensure .env file is configured
```bash
# Make sure your .env file has MONGO_URI and other required variables
cat .env
```

### Step 4: Run the seed script
```bash
npm run seed:all
```

### Step 5: Verify the seed
The script will output a summary showing what was created/updated.

## Individual Seed Scripts

If you need to seed specific parts individually:

```bash
# Seed admin user only
npm run seed:admin

# Seed bot configurations only
npm run seed:bot-config

# Seed wallets for existing users
npm run seed:wallets

# Seed bot users
npm run seed:bots

# Seed spin configurations
npm run seed:spins
```

## Important Notes

1. **Admin PIN**: The default admin PIN is `admin123`. **CHANGE THIS IN PRODUCTION!**

2. **Idempotent**: The seed script is idempotent - you can run it multiple times safely. It will:
   - Skip existing admin users
   - Update missing configuration fields
   - Create missing bot configs
   - Clean up orphaned configurations

3. **Environment Variables**: The script uses environment variables for sensitive data. Make sure your `.env` file is properly configured before running.

4. **Database Connection**: Ensure MongoDB is running and accessible before seeding.

## Troubleshooting

### Error: "MongoDB Connection Error"
- Check your `MONGO_URI` in `.env`
- Ensure MongoDB is running
- Verify network connectivity

### Error: "Duplicate key error"
- This is normal if data already exists
- The script handles duplicates gracefully

### Error: "Cannot find module"
- Run `npm install` to install dependencies
- Ensure you're in the `backend` directory

## Post-Seed Checklist

After running the seed script:

- [ ] Change admin PIN from default
- [ ] Update Telebirr account details in admin panel
- [ ] Review bot configurations and adjust as needed
- [ ] Verify system configuration values
- [ ] Test admin login
- [ ] Review game settings and adjust stakes if needed

## Support

If you encounter issues:
1. Check the console output for specific error messages
2. Verify your `.env` configuration
3. Ensure MongoDB is accessible
4. Check that all dependencies are installed

