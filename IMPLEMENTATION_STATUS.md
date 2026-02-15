# Tanuki Temaki - User Accounts & Personalization Implementation Status

## ✅ Completed (Phases 1-4: Full User Experience)

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

**Authentication Components:**
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

**User Interaction Components:**
- ✅ **RatingWidget** (`src/components/user/RatingWidget.tsx`)
  - 0-5 star rating interface with thumbs down
  - Click same rating to remove
  - Real-time API updates
  - Shows "Sign in to rate" for anonymous users

- ✅ **NotesWidget** (`src/components/user/NotesWidget.tsx`)
  - Expandable textarea for private notes
  - Character counter
  - Save/delete functionality
  - Auto-save status indicator

- ✅ **TagVotingWidget** (`src/components/user/TagVotingWidget.tsx`)
  - Upvote/downvote buttons for tags
  - Visual feedback (green for upvote, red for downvote)
  - Toggle vote on/off
  - Shows plain tags for anonymous users

- ✅ **ServicePreferences** (`src/components/user/ServicePreferences.tsx`)
  - Platform selection (streaming/reading services)
  - Categorized service lists
  - Persistent preferences
  - Save status indicator

**Pages:**
- ✅ **ProfilePage** (`src/pages/ProfilePage.tsx`)
  - User statistics (ratings count, tag preferences)
  - Tag preferences display (liked/disliked with scores)
  - Ratings history grouped by rating value
  - Username editing functionality
  - Service preferences integration

### Frontend Integration
- ✅ React Router setup in `App.tsx`
- ✅ Auth state initialization on app load
- ✅ Header with UserMenu component
- ✅ Auth callback route
- ✅ Profile page route (`/profile`)
- ✅ RatingWidget, NotesWidget, TagVotingWidget integrated into `TableView.tsx`
- ✅ User data fetched alongside series data
- ✅ Real-time updates for all user interactions
- ✅ Multi-series selection modal for search disambiguation
- ✅ Fetch by AniList ID for exact series selection

## ✅ Completed (Phases 1-5)

### Phase 5: Personalized Recommendations - COMPLETE ✅
- ✅ **PersonalizedRecommendationService** - Algorithm implementation
  - ✅ Score nodes based on tag preferences
  - ✅ Smart expansion for 4-5 star rated series (depth +2 levels)
  - ✅ Expansion limited to top 5 series (prioritized by upvoted tags)
  - ✅ Filter expanded series by upvoted tags + shared tags with rated series
  - ✅ Service filtering based on user's available services
  - ✅ Result limiting (~200 max with hard cap)
  - ✅ Exclude disliked series (0-star rating) and their children
  - ✅ Boost highly rated series (5-star: +10, 4-star: +5)
- ✅ **Recommendations Routes** - API endpoints
  - ✅ POST /api/recommendations/personalized (requires auth)
  - ✅ Integrated with server.ts
- ✅ **Frontend recommendationApi** - Client functions
  - ✅ getPersonalizedRecommendations(seriesId, maxDepth)
- ✅ **DiscoveryPage** personalized mode toggle
  - ✅ Toggle in header (visible before searching)
  - ✅ Only visible when user is logged in
  - ✅ Automatically applies personalization after tracing relationships
  - ✅ Shows "Personalizing..." loading state
- ✅ **PersonalizedBadge** component
  - ✅ Shows personalization indicator on series cards
  - ✅ Color-coded by score (green for highly recommended, purple for personalized, red for not recommended)
- ✅ **RecommendationExplanation** component
  - ✅ Displays why a series was recommended
  - ✅ Shows matched tags from user preferences
  - ✅ Shows personalization score
  - ✅ Integrated into TableView

## ✅ Completed (Phase 6)

### Phase 6: Watchlist & History Views - COMPLETE ✅
- ✅ **Database Schema**
  - ✅ UserWatchlist model (userId, seriesId, status, addedAt)
  - ✅ Migration created and applied
- ✅ **Backend Endpoints**
  - ✅ POST /api/user/watchlist (add to watchlist)
  - ✅ PUT /api/user/watchlist/:seriesId (update status)
  - ✅ DELETE /api/user/watchlist/:seriesId (remove from watchlist)
  - ✅ GET /api/user/watchlist (get all watchlist items with series details)
  - ✅ GET /api/user/watchlist/:seriesId (get watchlist status for series)
  - ✅ GET /api/user/rated (get all rated series with details)
  - ✅ GET /api/user/noted (get all series with notes)
- ✅ **Frontend Components**
  - ✅ WatchlistButton (add/remove from watchlist, shows status)
  - ✅ WatchlistPage (grid view, remove capability)
  - ✅ RatedSeriesPage (grid view, filter by rating)
  - ✅ NotedSeriesPage (list view with note preview)
- ✅ **Integration**
  - ✅ Watchlist button added to TableView series cards
  - ✅ Navigation links added to UserMenu dropdown
  - ✅ Routes added to App.tsx
  - ✅ userApi updated with all watchlist/history methods

## ✅ Completed (Phase 7)

### Phase 7: Genre/Tag Search & Recommendations - COMPLETE ✅
- ✅ **TagSearchService** (`src/services/tagSearch.ts`)
  - Search tags by name (partial match, case-insensitive)
  - Get all unique tags from database
  - Get top-rated series for a specific tag (sorted by averageScore, popularity)
  - Get series count for a tag
- ✅ **Tag Routes** (`src/routes/tags.ts`)
  - GET /api/tags/search?q=action - Search for tags
  - GET /api/tags - Get all tags
  - GET /api/tags/:tagValue/series - Get top series for tag
  - GET /api/tags/:tagValue/count - Get series count for tag
- ✅ **Recommendation Endpoint**
  - POST /api/recommendations/from-tag - Generate recommendations from tag
  - Supports personalized mode
  - Merges relationship graphs from multiple top series
- ✅ **Frontend API** (`src/lib/api.ts`)
  - tagApi.searchTags() - Search for tags
  - tagApi.getAllTags() - Get all tags
  - tagApi.getTopSeriesForTag() - Get top series for tag
  - recommendationApi.getRecommendationsFromTag() - Get tag-based recommendations
- ✅ **DiscoveryPage Updates**
  - Search mode toggle (Series / Tag)
  - Tag-based discovery with handleTagDiscovery()
  - Dynamic placeholder based on search mode
  - Personalized recommendations support for tag search

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

### Phase 2 - Ratings & Notes ✅ (Ready for Testing)
- [x] Backend API for ratings works
- [x] Backend API for notes works
- [x] Frontend RatingWidget component
- [x] Frontend NotesWidget component
- [ ] **TEST:** Can rate series 0-5
- [ ] **TEST:** Clicking same rating removes it
- [ ] **TEST:** Ratings persist and reload correctly
- [ ] **TEST:** Notes can be added, edited, deleted
- [ ] **TEST:** Anonymous users see "sign in to rate"

### Phase 3 - Tag Voting ✅ (Ready for Testing)
- [x] Backend API for tag voting works
- [x] Backend tag preferences aggregation works
- [x] Frontend TagVotingWidget component
- [x] ProfilePage component
- [ ] **TEST:** Can upvote/downvote tags on series
- [ ] **TEST:** Clicking same vote removes it
- [ ] **TEST:** Profile page shows aggregated tag preferences

### Phase 4 - Service Preferences ✅ (Ready for Testing)
- [x] Backend API for preferences works
- [x] Frontend ServicePreferences component
- [x] Integration into ProfilePage
- [ ] **TEST:** Can select available services
- [ ] **TEST:** Service preferences persist
- [ ] **TEST:** Service list includes all platforms in database

### Phase 5 - Personalized Recommendations ✅ (Ready for Testing)
- [x] PersonalizedRecommendationService implemented
- [x] Recommendation API endpoints work
- [x] Frontend recommendation API works
- [x] Personalized mode toggle in DiscoveryPage
- [ ] **TEST:** Tag preferences influence recommendation order
- [ ] **TEST:** Service filtering works correctly
- [ ] **TEST:** Highly rated (5-star) series get boosted scores
- [ ] **TEST:** Disliked (0-star) series and children excluded
- [ ] **TEST:** Result count ~125 maximum
- [ ] **TEST:** Personalized mode disabled for anonymous users
- [ ] **TEST:** PersonalizedBadge displays correctly on series cards
- [ ] **TEST:** RecommendationExplanation shows matched tags and reasons

## 🎯 Next Steps (Prioritized)

**All implementation is complete!** The focus now is on testing.

1. **Test Phases 2-5** - Verify all user features work correctly
   - ✅ Test 1: Authentication Flow (Complete)
   - ⏳ Test 2: Series Ratings
   - ⏳ Test 3: Private Notes
   - ⏳ Test 4: Tag Voting (genres and tags)
   - ⏳ Test 5: Profile Page
   - ⏳ Test 6: Service Preferences
   - ⏳ Test 7: Personalized Recommendations
   - ⏳ Test 8: Multi-series selection (search disambiguation)
   - ⏳ Test 9-10: Edge cases and integration tests

2. **Phase 7: Genre/Tag Search & Recommendations** (planned next)
   - Search by genre/tag name
   - Get top-rated series for that genre/tag
   - Generate recommendations from top series
   - Personalized mode: prioritize series with most upvoted tags

3. **Optional Enhancements** (future work)
   - Add more detailed personalization explanations
   - Add ability to adjust personalization strength
   - Add recommendation caching (15min TTL)
   - Export/import user preferences
   - Social features (share recommendations)

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
4. **No "forgot username" flow** - OAuth providers don't expose email by design (low priority)

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
│       │   ├── user.ts (✅ Ratings, notes, votes, prefs)
│       │   └── recommendations.ts (✅ Personalized recommendations)
│       ├── services/
│       │   ├── auth.ts (✅ JWT & OAuth logic)
│       │   ├── user.ts (✅ User data operations)
│       │   └── personalizedRecommendations.ts (✅ Personalization algorithm)
│       └── server.ts (✅ Updated with all routes)
└── web/
    └── src/
        ├── components/
        │   ├── auth/
        │   │   ├── LoginModal.tsx (✅)
        │   │   ├── UsernameModal.tsx (✅)
        │   │   ├── AuthCallback.tsx (✅)
        │   │   └── UserMenu.tsx (✅)
        │   ├── user/
        │   │   ├── RatingWidget.tsx (✅)
        │   │   ├── NotesWidget.tsx (✅)
        │   │   ├── TagVotingWidget.tsx (✅)
        │   │   └── ServicePreferences.tsx (✅)
        │   ├── PersonalizedBadge.tsx (✅ Personalization indicator)
        │   ├── RecommendationExplanation.tsx (✅ Why series was recommended)
        │   ├── SeriesSelectionModal.tsx (✅ Multi-series disambiguation)
        │   └── views/
        │       └── TableView.tsx (✅ Integrated with all user widgets)
        ├── features/
        │   └── discovery/
        │       └── DiscoveryPage.tsx (✅ Personalized mode toggle)
        ├── pages/
        │   └── ProfilePage.tsx (✅)
        ├── lib/
        │   └── api.ts (✅ authApi, userApi, recommendationApi)
        ├── store/
        │   └── userStore.ts (✅ Zustand store)
        └── App.tsx (✅ Router setup with profile route)
```

## 🚀 Estimated Testing Time

- **Testing Phases 2-4**: 2-3 hours
- **Testing Phase 5**: 1-2 hours

**Total testing**: ~3-5 hours to fully test all features

---

**Last Updated**: 2026-02-14
**Status**: 🎉 **Phase 7 Complete!** All phases (1-7) fully implemented. Genre/Tag search and recommendations now available!
