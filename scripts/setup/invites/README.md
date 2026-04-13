# Invite Scripts

## Setup

Create `invite.config.ts` (added to `.gitignore`) with your connection settings and user lists:

```typescript
export const AUTH_TOKEN = 'your-auth-token';
export const PROJECT_ID = 'your-project-id';

export const DEMO_USERS = [
  { email: 'demo@example.com', firstName: 'Demo', lastName: 'User', password: 'your-password' },
];

export const E2E_USERS = [
  { email: 'e2e@example.com', firstName: 'E2E', lastName: 'User', password: 'your-password' },
];

export const DEVELOPERS = [
  { email: 'dev@example.com', firstName: 'FirstName' },
];

export const REGULAR_USERS = [
  {
    email: 'user@example.com',
    firstName: 'FirstName',
    lastName: 'LastName',
    roles: ['staff', 'provider', 'manager', 'admin', 'customer-support'],
  },
];
```

Valid role keywords: `staff`, `provider`, `manager`, `admin`, `customer-support`.

## Commands

```bash
npm run invite:demo    # Invite demo user + set password via browser
npm run invite:e2e     # Invite E2E user + set password via browser
npm run invite:devs    # Invite all DEVELOPERS (full platform access, no roles)
npm run invite:users   # Invite all REGULAR_USERS
```
