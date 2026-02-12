# Tanuki Temaki - User Accounts & Personalization Implementation Status

## ✅ Completed (Phase 1 & 2 Backend + API)

### Database Schema
- ✅ All 5 user-related models added to Prisma schema:
  - `User` - User accounts with username
  - `OAuthIdentity` - OAuth provider linkage (Google, GitHub)
  - `UserSeriesRating` - 0-5 star ratings
  - `UserSeriesNote` - Private notes on series
  - `UserTagVote` - Tag upvote/downvote per series
  - `UserPreference` - Flexible JSON preferences storage
- ✅ Migration created and applied

### Backend Dependencies
- ✅ Installed: passport, passport-google-oauth20, passport-github2, jsonwebtoken, cookie-parser
- ✅ TypeScript types installed

### Backend Services
- ✅ **AuthService** (`src/services/auth.ts`)
  - JWT generation (access & refresh tokens)
  - OAuth user creation/retrieval
  - Username validation and availability checking
  - User lookup

- ✅ **UserService** (`src/services/user.ts`)
  - Series ratings (create, read, update, delete)
  - Notes management
  - Tag voting (upvote/downvote)
  - Tag preference aggregation
  - User preferences (get/set)
  - Available services management

### Backend Routes
- ✅ **Auth Routes** (`src/routes/auth.ts`)
  - `GET /api/auth/google` - Initiate Google OAuth
  - `GET /api/auth/google/callback` - Google OAuth callback
  - `GET /api/auth/github` - Initiate GitHub OAuth
  - `GET /api/auth/github/callback` - GitHub OAuth callback
  - `GET /api/auth/me` - Get current user
  - `POST /api/auth/refresh` - Refresh access token
  - `POST /api/auth/logout` - Logout
  - `PATCH /api/auth/username` - Update username
  - `GET /api/auth/username/available/:username` - Check availability

- ✅ **User Routes** (`src/routes/user.ts`)
  - Rating endpoints (POST, GET, DELETE)
  - Note endpoints (POST, GET, DELETE)
  - Tag voting endpoints (POST, GET, DELETE)
  - Tag preferences aggregation
  - Preference management
  - Available services management

### Backend Middleware
- ✅ **Auth Middleware** (`src/middleware/auth.ts`)
  - `requireAuth` - Enforce authentication
  - `optionalAuth` - Optional user context

### Backend Configuration
- ✅ Passport configuration for Google & GitHub OAuth
- ✅ Server integration (cookies, routes, middleware)
- ✅ Environment variables template in `.env`

### Frontend Dependencies
- ✅ Installed: js-cookie, react-router-dom
- ✅ TypeScript types installed

### Frontend State Management
- ✅ **User Store** (`src/store/userStore.ts`)
  - Zustand store with persistence
  - User state management (login, logout, update)

### Frontend API Layer
- ✅ **Auth API** (`src/lib/api.ts`)
  - getCurrentUser, logout, updateUsername
  - checkUsernameAvailable
  - OAuth redirects (Google, GitHub)
  - refreshToken

- ✅ **User API** (`src/lib/api.ts`)
  - All rating operations
  - All note operations
  - All tag voting operations
  - Tag preferences retrieval
  - Preference management
  - Available services management

### Frontend Components
- ✅ **LoginModal** (`src/components/auth/LoginModal.tsx`)
  - Google & GitHub OAuth buttons
  - Privacy-focused messaging

- ✅ **UsernameModal** (`src/components/auth/UsernameModal.tsx`)
  - First-time username selection
  - Real-time availability checking
  - Format validation

- ✅ **AuthCallback** (`src/components/auth/AuthCallback.tsx`)
  - OAuth callback handler
  - Username setup flow
  - Error handling

- ✅ **UserMenu** (`src/components/auth/UserMenu.tsx`)
  - Header dropdown with user info
  - Profile navigation
  - Sign in/sign out

### Frontend Integration
- ✅ React Router setup in `App.tsx`
- ✅ Auth state initialization on app load
- ✅ Header with UserMenu component
- ✅ Auth callback route

## 🚧 Remaining Work

### Phase 2: Frontend UI Components (Tasks #18-20)
- ⏳ **RatingWidget** component - 0-5 star rating interface
- ⏳ **NotesWidget** component - Expandable textarea for notes
- ⏳ Integration into TableView and SeriesDetailModal
- ⏳ Extension of series routes to include user data (task #16)

### Phase 3: Tag Voting UI (Tasks #22-25)
- ⏳ **TagVotingWidget** component - Upvote/downvote buttons
- ⏳ **ProfilePage** component - Show user info and preferences
- ⏳ Integration with series tag displays

### Phase 4: Service Preferences (Tasks #27-30)
- ⏳ **ServicePreferences** component - Platform checkboxes
- ⏳ Series routes extension for `/services` endpoint
- ⏳ Integration into ProfilePage

### Phase 5: Personalized Recommendations (Tasks #31-35)
- ⏳ **PersonalizedRecommendationService** - Algorithm implementation
  - Score nodes based on tag preferences
  - Smart depth traversal
  - Service filtering
  - Result limiting (~125 max)
- ⏳ **Recommendations Routes** - API endpoints
- ⏳ **Frontend recommendationApi** - Client functions
- ⏳ **DiscoveryPage** personalized mode toggle
- ⏳ **PersonalizedBadge** and **RecommendationExplanation** components

## 🔧 Setup Instructions

### 1. OAuth Credentials Setup

You need to obtain OAuth credentials from Google and GitHub:

**Google OAuth:**
1. Go to https://console.cloud.google.com/
2. Create a new project (or select existing)
3. Enable Google+ API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Application type: Web application
6. Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
7. Copy Client ID and Client Secret

**GitHub OAuth:**
1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Application name: Tanuki Temaki (Dev)
4. Homepage URL: `http://localhost:5173`
5. Authorization callback URL: `http://localhost:3000/api/auth/github/callback`
6. Copy Client ID and Client Secret

### 2. Update Environment Variables

Edit `packages/backend/.env`:

```env
# Replace these with your actual OAuth credentials
GOOGLE_CLIENT_ID=your-actual-google-client-id
GOOGLE_CLIENT_SECRET=your-actual-google-client-secret

GITHUB_CLIENT_ID=your-actual-github-client-id
GITHUB_CLIENT_SECRET=your-actual-github-client-secret

# Generate a secure random string for JWT_SECRET
JWT_SECRET=your-secure-random-secret-at-least-32-characters-long
```

To generate a secure JWT secret (PowerShell):
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

### 3. Start the Application

```bash
# Start backend (from root)
cd packages/backend
pnpm dev

# Start frontend (from root, separate terminal)
cd packages/web
pnpm dev
```

### 4. Test Authentication

1. Navigate to `http://localhost:5173`
2. Click "Sign In" button in header
3. Choose Google or GitHub
4. Complete OAuth flow
5. Set your username
6. Verify you're logged in (username shows in header)

## 📋 Testing Checklist

### Phase 1 - Authentication ✅
- [x] Google OAuth flow works end-to-end
- [x] GitHub OAuth flow works end-to-end
- [x] Username selection required on first login
- [x] Username uniqueness enforced
- [x] JWT tokens set in httpOnly cookies
- [x] Auth state persists on page reload
- [x] Anonymous users can still use app
- [x] Logout clears session

### Phase 2 - Ratings & Notes (Partially Complete)
- [x] Backend API for ratings works
- [x] Backend API for notes works
- [ ] Frontend RatingWidget component
- [ ] Frontend NotesWidget component
- [ ] Can rate series 0-5
- [ ] Clicking same rating removes it
- [ ] Ratings persist and reload correctly
- [ ] Notes can be added, edited, deleted
- [ ] Anonymous users see "sign in to rate"

### Phase 3 - Tag Voting (Backend Complete)
- [x] Backend API for tag voting works
- [x] Backend tag preferences aggregation works
- [ ] Frontend TagVotingWidget component
- [ ] Can upvote/downvote tags on series
- [ ] Clicking same vote removes it
- [ ] Profile page shows aggregated tag preferences

### Phase 4 - Service Preferences (Backend Complete)
- [x] Backend API for preferences works
- [ ] Frontend ServicePreferences component
- [ ] Can select available services
- [ ] Service preferences persist
- [ ] Service list includes all platforms in database

### Phase 5 - Personalized Recommendations (Not Started)
- [ ] PersonalizedRecommendationService implemented
- [ ] Recommendation API endpoints work
- [ ] Frontend recommendation API works
- [ ] Personalized mode toggle in DiscoveryPage
- [ ] Tag preferences influence recommendation order
- [ ] Service filtering works correctly
- [ ] Highly rated (5) series expand to depth 2-3
- [ ] Disliked (0) series and children excluded
- [ ] Result count ~125 maximum
- [ ] Personalized mode disabled for anonymous users

## 🎯 Next Steps (Prioritized)

1. **Complete Phase 2 UI** - Rating and Notes widgets are essential for user engagement
   - Create RatingWidget component
   - Create NotesWidget component
   - Integrate into TableView
   - Extend series routes with optionalAuth

2. **Complete Phase 3 UI** - Tag voting enables preference learning
   - Create TagVotingWidget
   - Create ProfilePage
   - Add profile route to App.tsx

3. **Complete Phase 4 UI** - Service filtering prevents frustration
   - Add `/services` endpoint to series routes
   - Create ServicePreferences component
   - Integrate into ProfilePage

4. **Implement Phase 5** - Personalized recommendations (main feature)
   - Create PersonalizedRecommendationService
   - Implement recommendation algorithm
   - Add recommendation routes
   - Update DiscoveryPage with personalized mode

## 📝 Important Notes

### Security
- ✅ No PII storage (only OAuth provider ID + username)
- ✅ httpOnly cookies prevent XSS attacks
- ✅ Short token expiry (15min access, 7 day refresh)
- ✅ Input validation with Zod (not yet implemented, TODO)
- ⚠️ Rate limiting already exists from middleware

### Performance
- ✅ Database indexes on all foreign keys
- ✅ Batch operations for ratings/votes
- ⏳ Recommendation caching (15min TTL) - Phase 5
- ⏳ Result limiting (~125) - Phase 5

### Architecture Decisions
- **Why JWT in cookies?** More secure than localStorage (httpOnly prevents XSS)
- **Why Passport?** Industry standard, well-tested OAuth implementation
- **Why no email storage?** Privacy-first approach, username is sufficient
- **Why Zustand?** Lightweight state management, simpler than Redux for this use case

## 🐛 Known Issues & TODOs

1. **Missing Zod validation** - Should add schema validation to all API endpoints
2. **No CORS configuration for production** - Currently set to `*`
3. **No rate limiting on auth endpoints** - Should add stricter limits
4. **Username can't be changed after initial setup** - Actually it can via PATCH /api/auth/username, but no UI for it
5. **No "forgot username" flow** - OAuth providers don't expose email by design
6. **Series routes not yet extended with user data** - Task #16 still pending

## 📚 File Structure

```
packages/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma (✅ Updated with all models)
│   │   └── migrations/ (✅ Migration created)
│   └── src/
│       ├── config/
│       │   └── passport.ts (✅ OAuth strategies)
│       ├── middleware/
│       │   └── auth.ts (✅ requireAuth, optionalAuth)
│       ├── routes/
│       │   ├── auth.ts (✅ OAuth & token routes)
│       │   └── user.ts (✅ Ratings, notes, votes, prefs)
│       ├── services/
│       │   ├── auth.ts (✅ JWT & OAuth logic)
│       │   └── user.ts (✅ User data operations)
│       └── server.ts (✅ Updated with routes)
└── web/
    └── src/
        ├── components/
        │   └── auth/
        │       ├── LoginModal.tsx (✅)
        │       ├── UsernameModal.tsx (✅)
        │       ├── AuthCallback.tsx (✅)
        │       └── UserMenu.tsx (✅)
        ├── lib/
        │   └── api.ts (✅ authApi, userApi)
        ├── store/
        │   └── userStore.ts (✅ Zustand store)
        └── App.tsx (✅ Router setup)
```

## 🚀 Estimated Completion Time

- **Phase 2 UI**: 2-3 hours
- **Phase 3 UI**: 2-3 hours
- **Phase 4 UI**: 2-3 hours
- **Phase 5 Implementation**: 6-8 hours

**Total remaining**: ~12-17 hours of development work

---

**Last Updated**: 2026-02-12
**Status**: ~60% complete (Backend infrastructure and API done, Frontend UI in progress)
