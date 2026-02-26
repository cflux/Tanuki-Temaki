# Tanuki Temaki - Refactor Plan

## Phase 1: Critical Security Fixes ✅ COMPLETED

### 1.1 ✅ Remove/protect destructive endpoints
- Added `requireAuth, requireAdmin` middleware to `DELETE /api/series/clear`
- Added `requireAuth, requireAdmin` middleware to `GET /api/series/debug-anilist/:anilistId`

### 1.2 ✅ Fail on missing JWT_SECRET
- Replaced fallback string with an IIFE that throws `Error('JWT_SECRET environment variable is required')` if not set

### 1.3 ✅ Separate access and refresh token signing
- Added `type: 'access' | 'refresh'` to `TokenPayload` interface
- `generateAccessToken` now embeds `type: 'access'`, `generateRefreshToken` embeds `type: 'refresh'`
- `verifyToken` accepts optional `expectedType` param and rejects mismatches
- `requireAuth`/`optionalAuth` middleware passes `'access'`
- `/refresh` endpoint passes `'refresh'`

### 1.4 ✅ Protect test/debug routes
- Wrapped `/api/test` registration with `if (process.env.NODE_ENV !== 'production')`
- Debug endpoint protected via admin auth (see 1.1)

### 1.5 ✅ Use Prisma singleton everywhere
- Replaced `new PrismaClient()` in 5 files with `import { prisma } from '../lib/prisma.js'`:
  - `services/auth.ts`, `services/user.ts`, `services/scheduler.ts`, `services/recommendations.ts`, `routes/admin.ts`

---

## Phase 2: High Severity Bug Fixes ✅ COMPLETED

### 2.1 ✅ Fix TagSearchService broken DI
- Replaced dynamic `await import()` and throwaway instance creation with shared `seriesCache` singleton from `index.ts`
- Removed creation of empty `AdapterRegistry` (no registered adapters) in favor of the properly configured singleton

### 2.2 ✅ Fix TagSearchService loading all series into memory
- `searchTags()` — now uses `prisma.tag.groupBy()` with case-insensitive `contains` filter
- `getAllTags()` — now uses `prisma.tag.groupBy()` ordered by count
- `getTopSeriesForTag()` — now queries through `prisma.tag.findMany()` with series join instead of loading all series
- `getSeriesCountForTag()` — now uses `prisma.tag.count()`

### 2.3 ✅ Fix N+1 queries
- Replaced `Promise.all(seriesIds.map(...getWatchlistStatus))` in `routes/user.ts` with a single `prisma.userWatchlist.findMany({ where: { seriesId: { in: seriesIds } } })`
- Created `UserService.getNotesMap(userId, seriesIds)` that fetches all notes in one query
- Replaced two N+1 `Promise.all(seriesIds.map(...getNote))` patterns in `routes/series.ts` with `UserService.getNotesMap()`

### 2.4 ✅ Fix graceful shutdown race condition
- Wrapped `server.close()` in a promise and `await` it before calling `prisma.$disconnect()`

### 2.5 ✅ Fix infinite recursion in getChildrenIds
- Added `visited: Set<string>` parameter with cycle detection to `getChildrenIds()` in `personalizedRecommendations.ts`

### 2.6 ✅ Add React Error Boundary
- Created `packages/web/src/components/ErrorBoundary.tsx` with fallback UI and reload button
- Wrapped `<App />` in `<ErrorBoundary>` in `main.tsx`

### 2.7 ✅ Add AbortController to SSE streams
- **Frontend:** Added optional `signal?: AbortSignal` parameter to `traceRelationshipsStream`, `seedFromPopularStream`, `getRecommendationsFromTagWithProgress`, `expandDatabaseStream` and passed to `fetch()`
- **Backend:** Added `req.on('close')` abort handler to all 4 SSE endpoints (`series.ts`, `recommendations.ts`, `admin.ts` x2) with `aborted` flag checked in `sendProgress`
- Also removed dead `Authorization` header from `getRecommendationsFromTagWithProgress` (was using `localStorage.getItem('token')` — app uses cookie auth)

### 2.8 ✅ Run Docker containers as non-root
- **Backend Dockerfile:** Added `appuser`/`appgroup` non-root user with `USER appuser`
- **Frontend Dockerfile:** Switched to `nginxinc/nginx-unprivileged:alpine`, updated port to 8080
- **nginx.conf:** Changed `listen 80` to `listen 8080`
- **docker-compose.yml:** Updated frontend port mapping to `8080`, removed deprecated `version: '3.8'`

---

## Phase 3: Medium Severity Fixes ✅ COMPLETED

### 3.1 ✅ Share a single AniListAdapter instance
- Added `export const anilistAdapter = new AniListAdapter()` singleton to `adapters/anilist.ts`
- Updated all consumers to use the singleton: `anilistMatcher.ts`, `tagSearch.ts`, `routes/test.ts`, `routes/admin.ts`
- Rate-limit state (`lastRequestTime`, `rateLimitRemaining`) is now shared across all call sites

### 3.2 ✅ Bound in-memory caches
- `relationshipTracer.ts`: Added `MAX_CACHE_ENTRIES = 500` with oldest-entry eviction before `graphCache.set()`
- `tokenExchange.ts`: Added `setInterval` cleanup every 60s (`.unref()`), `MAX_TOKENS = 10_000` cap, rejects new tokens when full

### 3.3 ✅ Consistent error handling in routes
- Wrapped `auth.ts` login handler in try/catch with error logging
- All `user.ts` handlers already had manual try/catch; the two using `asyncHandler` retain it for consistency

### 3.4 ✅ Add ProtectedRoute wrapper
- Created `packages/web/src/components/ProtectedRoute.tsx` with loading spinner and `<Navigate>` redirect
- Wrapped `/profile`, `/watchlist`, `/rated`, `/noted`, `/admin/maintenance` routes in `<ProtectedRoute>` in `App.tsx`
- Removed duplicate auth redirect `useEffect` and `useNavigate` from `WatchlistPage`, `RatedSeriesPage`, `NotedSeriesPage`, `ProfilePage`

### 3.5 ✅ Remove user from localStorage persistence
- Removed `user` from `partialize` in `userStore.ts` — only preferences are persisted now
- `initAuth()` in `App.tsx` already re-fetches user data on load

### 3.6 ✅ Fix dead auth code
- `Authorization: Bearer ${localStorage.getItem('token')}` header was already removed in Phase 2.7

### 3.7 ✅ Fix database schema
- Added `@@unique([seriesId, value])` to `Tag` model
- Converted `UserWatchlist.status` from `String` to `enum WatchlistStatus`
- Removed redundant `@@index([username])` and `@@index([email])` from `User`
- Removed redundant `@@unique([key])` from `Configuration`
- Note: `UserTagVote.vote` validated at application level (see 3.11) rather than DB enum
- **Migration required:** Run `npx prisma migrate dev` to apply schema changes

### 3.8 ✅ Fix Docker build issues
- Changed builder stage `--no-frozen-lockfile` to `--frozen-lockfile`
- Production stage: `pnpm install --prod --frozen-lockfile`, copy `.prisma` client from builder instead of re-generating
- `docker-compose.yml`: `version: '3.8'` removed (Phase 2), postgres port bound to `127.0.0.1`, `condition: service_healthy` already present

### 3.9 ✅ Add security headers
- Added `helmet` to `package.json` dependencies
- Added `import helmet from 'helmet'` and `app.use(helmet())` before CORS in `server.ts`
- **Action required:** Run `pnpm install` to install the `helmet` package

### 3.10 ✅ Fix shared types
- `Series.provider` → simplified to `string` (removed redundant union with string literal + string)
- `Series.fetchedAt`/`updatedAt` → changed from `Date` to `string` (JSON serialization)
- `UserTagVote.vote` → narrowed from `number` to `1 | -1`
- `ExtensionResponse.data` → changed from `any` to `Record<string, unknown>`
- Added `UserWatchlist` and `UserPreference` interfaces to `shared/types/user.ts`

### 3.11 ✅ Add input validation
- Added Zod UUID validation for `seriesId` params on notes and watchlist endpoints
- Added `WATCHLIST_STATUSES` allowlist validation on watchlist POST
- Added `MAX_NOTE_LENGTH = 10_000` character limit on notes
- Added `ALLOWED_PREFERENCE_KEYS` allowlist and `MAX_PREFERENCE_VALUE_SIZE` limit on preferences

### 3.12 ✅ Add 404 catch-all route
- Created `packages/web/src/pages/NotFoundPage.tsx` with cyberpunk-styled 404 page
- Added `<Route path="*" element={<NotFoundPage />} />` as last route in `App.tsx`

---

## Phase 4: Code Quality Improvements ✅ COMPLETED

### 4.1 ⏳ Break up god components (DEFERRED)
- **Deferred** — DiscoveryPage (1317 lines) and TreeView (1218 lines) are large refactors with high regression risk. Best done as a dedicated follow-up PR with visual regression testing.

### 4.2 ✅ Create shared CyberButton component
- Created `packages/web/src/components/ui/CyberButton.tsx` with `primary`, `secondary`, `danger` variants and `sm`/`md` sizes
- Encapsulates the 3-div clipPath nesting pattern into a single component
- Applied to MaintenancePage (4 buttons replaced, ~60 lines removed)
- Other files can adopt incrementally

### 4.3 ✅ Remove console.log from production code
- Replaced `console.log`/`console.error` in `server.ts`, `env.ts`, `config/constants.ts` with `logger.*` calls
- Removed debug `console.log` calls in `ServicePreferences.tsx`

### 4.4 ✅ Deduplicate code
- Extracted `normalizeServiceName` into `packages/backend/src/utils/services.ts`
- Updated `routes/series.ts` and `services/user.ts` to import from shared utility
- Merged `recommendationsApi` into `recommendationApi` in `packages/web/src/lib/api.ts`
- Updated `HomePage.tsx` import

### 4.5 ✅ Fix array mutation
- Changed `series.tags.sort(...)` to `[...series.tags].sort(...)` in `SeriesPage.tsx`

### 4.6 ✅ Replace alert() with toast notifications
- Created `packages/web/src/components/Toast.tsx` with `useToastStore`, `toast()` helper, and `ToastContainer`
- Added `ToastContainer` to `App.tsx`
- Replaced all 4 `alert()` calls in `MaintenancePage.tsx` with `toast(msg, 'error')`

### 4.7 ✅ Fix remaining type safety issues
- Added `UserRatingWithSeries`, `UserWatchlistWithSeries`, `UserNoteWithSeries` interfaces to `shared/types/user.ts`
- Updated `api.ts` return types: `getWatchlist()`, `getRatedSeries()`, `getNotedSeries()`
- Updated `HomePage.tsx`, `WatchlistPage.tsx`, `RatedSeriesPage.tsx`, `NotedSeriesPage.tsx` to use typed state instead of `any[]`
- Removed explicit `any` type annotations from filter/sort callbacks

### 4.8 ✅ Fix MaintenancePage state explosion
- Consolidated 14 schedule-related `useState` calls into 2 grouped state objects (`expandSchedule`, `refreshSchedule`)
- Created `applyScheduleResponse()` helper to replace 12+ repeated setter calls per API response
- Reduced from 28 to 16 `useState` calls

### 4.9 ✅ Fix stale closure in DiscoveryPage
- Wrapped `performDiscovery` in `useCallback` with proper dependency array
- Added `performDiscovery` to `handleExplore`'s dependency array

### 4.10 ✅ Move SectionSpinner outside component
- Moved `SectionSpinner` definition outside `HomePage` function

### 4.11 ✅ Fix duplicate state
- Removed `resultsMediaFilter` and `setResultsMediaFilter` from `discoveryStore.ts`
- Updated `DiscoveryPage.tsx` to read `resultsMediaFilter` directly from `userStore`
- Removed the two sync effects that bridged the stores

### 4.12 ✅ Fix IsAdultTestPage relative URL
- Added `API_BASE_URL` constant and used it in `fetch()` call

### 4.13 ✅ Fix Promise constructor anti-pattern
- Refactored 3 `new Promise(async (resolve, reject) => { ... })` patterns in `api.ts`:
  - `traceRelationshipsStream` — plain async with while loop
  - `seedFromPopularStream` — plain async with while loop
  - `expandDatabaseStream` — plain async with while loop
- Also refactored `getRecommendationsFromTagWithProgress` from recursive `readStream()` to while loop

### 4.14 ✅ Env validation at startup
- Added Zod schema validation to `packages/backend/src/env.ts`
- Validates required vars (`JWT_SECRET`, `DATABASE_URL`) and optional vars with defaults
- Fails fast with clear formatted error messages on invalid env

### 4.15 ✅ TSConfig fixes
- Changed `packages/backend/tsconfig.json`: `module`/`moduleResolution` to `Node16`
- Removed `allowJs: true` from root `tsconfig.json`

### 4.16 ✅ Clean up unused dependencies
- Removed `esbuild` from devDependencies (build uses `tsc`)
- Removed `ws` and `@types/ws` (WebSocket library — unused, app uses SSE)
- Kept `passport-github2` (used in `config/passport.ts`)

### 4.17 ✅ Accessibility improvements
- **UserMenu:** Added Escape key close, ArrowUp/ArrowDown navigation, `role="menu"`/`role="menuitem"`, `aria-expanded`, `aria-haspopup`, focus styles
- **ThemeSwitcher:** Added Escape key close, ArrowUp/ArrowDown navigation, `role="menu"`/`role="menuitemradio"`, `aria-checked`, `aria-expanded`, `aria-haspopup`
- **LogoMenu (App.tsx):** Added Escape key close
- **LoginModal:** Added Escape key close, `role="dialog"`, `aria-modal`
- **UsernameModal:** Added `role="dialog"`, `aria-modal`
- **SeriesSelectionModal:** Added `role="dialog"`, `aria-modal`

---

## Phase 5: Break Up God Components

> `DiscoveryPage.tsx` (1304 lines) and `TreeView.tsx` (1217 lines)

### 5.1 Extract DiscoveryPage custom hooks

Extract logic-heavy hooks from DiscoveryPage into `packages/web/src/features/discovery/hooks/`:

- **`useDiscovery.ts`** — Core discovery logic (~150 lines)
  - `performDiscovery` (the `useCallback`), `handleExplore`, `handleNodeClick`
  - SSE streaming orchestration (trace, seed, expand flows)
  - Consumes `discoveryStore` and `userStore`

- **`useNavigationDiscovery.ts`** — URL-driven discovery (~40 lines)
  - `useEffect` that reads `?series=` and `?anilistId=` from URL search params
  - Triggers `performDiscovery` on mount when params present

- **`useMobileViewMode.ts`** — Mobile view state (~20 lines)
  - `mobileViewMode` state + `setMobileViewMode` setter
  - Breakpoint detection logic

- **`useUserServicesLoader.ts`** — Load user streaming services (~30 lines)
  - `useEffect` that calls `userApi.getPreferences()` to load service list
  - Populates `enabledServices` / `availableServices` state

### 5.2 Extract DiscoveryPage sub-components

Extract presentational components into `packages/web/src/features/discovery/components/`:

- **`SearchHeader.tsx`** — Search input bar + submit button (~60 lines)
  - Props: `searchQuery`, `onSearchChange`, `onSubmit`, `isLoading`

- **`SearchModeToggle.tsx`** — Toggle between search modes (~30 lines)
  - Props: `mode`, `onModeChange`

- **`MediaTypeToggle.tsx`** — Anime/Manga/Both toggle (~40 lines)
  - Props: `mediaType`, `onMediaTypeChange`

- **`ResultsMediaFilter.tsx`** — Filter results by media type (~30 lines)
  - Props: `filter`, `onFilterChange`

- **`DiscoverySidebar.tsx`** — Left sidebar container (~80 lines)
  - Composes `StatsPanel`, `ServiceFilterPanel`, `TagFilterPanel`
  - Props: `graph`, `filters`, `onFilterChange`

- **`StatsPanel.tsx`** — Graph statistics display (~40 lines)
  - Props: `nodeCount`, `edgeCount`, `animeCount`, `mangaCount`

- **`ServiceFilterPanel.tsx`** — Streaming service checkboxes (~50 lines)
  - Props: `services`, `enabledServices`, `onToggle`

- **`TagFilterPanel.tsx`** — Tag filtering controls (~50 lines)
  - Props: `tags`, `selectedTags`, `tagFilterMode`, `onTagToggle`, `onModeChange`

- **`DiscoveryErrorBanner.tsx`** — Error display banner (~20 lines)
  - Props: `error`, `onDismiss`

### 5.3 Extract DiscoveryPage utilities

Extract into `packages/web/src/features/discovery/utils/`:

- **`platformIcons.ts`** — `getPlatformIcon()` function and streaming service icon map (~30 lines)
- **`documentTitle.ts`** — `useDocumentTitle()` hook or `setDocumentTitle()` helper (~10 lines)
- **`discoveryTagUtils.ts`** — Tag filtering/sorting logic used by sidebar (~20 lines)

### 5.4 Extract TreeView custom hooks

Extract from `TreeView.tsx` into `packages/web/src/features/discovery/hooks/`:

- **`useTreeLayout.ts`** — Core tree layout computation (~490 lines)
  - Takes `graph`, `selectedSeries`, `filters` as input
  - Returns `nodes`, `edges`, `viewport` config
  - Contains `buildTagTree()`, layout positioning, edge routing, node/edge collection
  - This is the largest extraction — may be further split (see 5.6)

- **`useNodeHover.ts`** — Shared hover state management (~20 lines)
  - `hoveredNode` state, `onNodeMouseEnter`, `onNodeMouseLeave`
  - Used by both `TagLabelNode` and `SeriesCardNode`

### 5.5 Extract TreeView sub-components

Extract into `packages/web/src/features/discovery/components/`:

- **`TagLabelNode.tsx`** — Custom ReactFlow node for tag labels (~80 lines)
  - Renders tag name, count badge, expand/collapse toggle
  - Props from ReactFlow `NodeProps` + custom data

- **`SeriesCardNode.tsx`** — Custom ReactFlow node for series cards (~120 lines)
  - Renders series cover image, title, media type badge, rating
  - Click handler navigates to series page
  - Props from ReactFlow `NodeProps` + custom data

- **`GapEdge.tsx`** — Custom ReactFlow edge with gap/dash styling (~40 lines)
  - Renders connection lines between nodes with custom path

### 5.6 Extract TreeView utilities

Extract into `packages/web/src/features/discovery/utils/`:

- **`tagColors.ts`** — `getTagColor()` function and color palette (~30 lines)
  - Deterministic tag-to-color mapping

- **`treeConstants.ts`** — Layout constants (~20 lines)
  - `NODE_WIDTH`, `NODE_HEIGHT`, `GAP_X`, `GAP_Y`, `TAG_LABEL_WIDTH`, etc.

- **`tagTreeBuilder.ts`** — Tree data structure construction (~80 lines)
  - `buildTagTree()` — groups series by tags into a hierarchical structure
  - Input: flat series list + tag filter config
  - Output: tree nodes with parent/child relationships

- **`treeLayout.ts`** — Position calculation (~120 lines)
  - `computeTreeLayout()` — assigns x/y coordinates to tree nodes
  - Handles column stacking, vertical spacing, centering

- **`nodeEdgeCollector.ts`** — ReactFlow node/edge generation (~100 lines)
  - `collectNodesAndEdges()` — converts positioned tree into ReactFlow elements
  - Creates `TagLabelNode`, `SeriesCardNode`, and `GapEdge` elements

- **`seriesFilter.ts`** — Series filtering logic (~40 lines)
  - `filterSeriesByServices()`, `filterSeriesByTags()`, `filterSeriesByMediaType()`
  - Used by both TreeView and DiscoverySidebar

### 5.7 Integrate and verify

- Update `DiscoveryPage.tsx` to import extracted hooks, components, and utils
- Update `TreeView.tsx` to import extracted hooks, components, and utils
- Verify no circular dependencies between extracted modules
- Run `tsc --noEmit` to confirm type safety
- Manual smoke test: search, tree rendering, filtering, mobile view

### Execution notes

- **Order:** Extract utilities (5.3, 5.6) first since they have no dependencies, then hooks (5.1, 5.4), then components (5.2, 5.5), then integrate (5.7)
- **Risk mitigation:** Each extraction should be a single commit so regressions are easy to bisect
- **Target:** DiscoveryPage should be ~200-300 lines (composition + layout), TreeView should be ~150-250 lines (ReactFlow setup + composition)
