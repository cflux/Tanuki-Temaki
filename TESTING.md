# Testing Tanuki Temaki Backend

This guide explains how to test the backend without the browser extension using mock data.

## Prerequisites

- Node.js >= 20
- pnpm >= 8
- PostgreSQL 16+ running

## Setup Steps

### 1. Install Dependencies

```bash
# From project root
pnpm install
```

### 2. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env and set your PostgreSQL password
# DATABASE_URL=postgresql://tanuki:YOUR_PASSWORD@localhost:5432/tanuki_temaki
```

### 3. Start PostgreSQL

**Option A: Using Docker**
```bash
docker run -d \
  --name tanuki-postgres \
  -e POSTGRES_USER=tanuki \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=tanuki_temaki \
  -p 5432:5432 \
  postgres:16-alpine
```

**Option B: Local PostgreSQL**
```sql
CREATE DATABASE tanuki_temaki;
CREATE USER tanuki WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE tanuki_temaki TO tanuki;
```

### 4. Run Database Migrations

```bash
cd packages/backend
pnpm prisma:migrate
```

This creates the `series`, `tags`, and `relationships` tables.

### 5. Seed Mock Data

```bash
pnpm test:seed
```

This will:
- Clear existing data
- Insert 6 popular anime series (SPY x FAMILY, Demon Slayer, etc.)
- Generate tags for each series using the TagGenerator
- Create mock relationships between similar series

**Expected output:**
```
Created series: SPY x FAMILY with 15 tags
Created series: Demon Slayer: Kimetsu no Yaiba with 18 tags
Created series: My Hero Academia with 12 tags
...
Database seed complete!
Summary: { totalSeries: 6, totalTags: 89, totalRelationships: 7 }
```

### 6. Start the Backend Server

```bash
# Terminal 1: Backend
pnpm dev
```

**Expected output:**
```
HTTP server listening on port 3000
WebSocket server initialized on port 8765
Environment: development
```

### 7. Test API Endpoints

```bash
# Terminal 2: Run tests
pnpm test:endpoints
```

**Or test manually with curl:**

```bash
# Health check
curl http://localhost:3000/api/health

# Get cache statistics
curl http://localhost:3000/api/series/stats

# Search for series
curl "http://localhost:3000/api/series/search?q=spy"

# Get specific series (replace ID with actual ID from search)
curl http://localhost:3000/api/series/SERIES_ID_HERE
```

## What Gets Tested

### ✅ Working Without Extension

1. **Health Check**: `/api/health`
   - Verifies server is running
   - Checks database connection

2. **Cache Stats**: `/api/series/stats`
   - Returns total series, tags, relationships
   - Shows breakdown by provider

3. **Search**: `/api/series/search?q=query`
   - Searches cached series by title
   - Returns matching series with tags

4. **Get Series by ID**: `/api/series/:id`
   - Returns full series details
   - Includes all generated tags

5. **Tag Generation**
   - Runs on all mock data during seeding
   - Extracts tags from genres, descriptions, content advisories
   - You can see the generated tags in the response

6. **Database Operations**
   - All CRUD operations work
   - Relationships are persisted
   - Cache lookups function properly

### ❌ Not Working Without Extension

1. **Fetch New Series**: `POST /api/series/fetch`
   - Requires extension to extract data from Crunchyroll
   - Will timeout waiting for extension response

2. **Trace Relationships**: `POST /api/series/:id/trace`
   - Needs extension to fetch "More like this" data
   - Will fail to discover new related series

## Mock Data Included

The test database includes these series:

1. **SPY x FAMILY** - Action, Comedy, Shounen
2. **Demon Slayer** - Action, Adventure, Supernatural
3. **My Hero Academia** - Action, Adventure, Shounen
4. **Jujutsu Kaisen** - Action, Supernatural, Shounen
5. **Kaguya-sama: Love is War** - Comedy, Romance, School
6. **Chainsaw Man** - Action, Supernatural, Shounen

## Example Test Session

```bash
# 1. Seed database
$ pnpm test:seed
✓ Created 6 series with 89 total tags

# 2. Start server
$ pnpm dev
✓ Server running on port 3000

# 3. Test endpoints (in another terminal)
$ curl http://localhost:3000/api/health
{"status":"ok","timestamp":"2024-01-15T10:30:00Z","database":"connected"}

$ curl "http://localhost:3000/api/series/search?q=spy"
[{
  "id": "...",
  "title": "SPY x FAMILY",
  "tags": [
    {"value": "action", "source": "genre", "confidence": 1.0},
    {"value": "comedy", "source": "genre", "confidence": 1.0},
    {"value": "spy", "source": "description", "confidence": 0.9},
    ...
  ]
}]

$ pnpm test:endpoints
✓ Health Check (45ms)
✓ Get Cache Stats (123ms)
✓ Search Series (89ms)
✓ Get Series by ID (67ms)

Test Summary: Passed 4/4
```

## Next Steps

Once the browser extension is built, you can:
1. Test real Crunchyroll data extraction
2. Fetch new series and see tags auto-generated
3. Trace actual relationship graphs
4. Build the full discovery workflow

## Troubleshooting

**Database connection error:**
```bash
# Check PostgreSQL is running
docker ps  # or
pg_isadmin -U tanuki

# Verify DATABASE_URL in .env is correct
```

**"Module not found" errors:**
```bash
# Rebuild shared types
cd ../../shared
pnpm build

# Rebuild backend
cd ../packages/backend
pnpm build
```

**Port already in use:**
```bash
# Change PORT in .env
PORT=3001
WS_PORT=8766
```

## Clean Up

```bash
# Stop backend
Ctrl+C

# Stop PostgreSQL container
docker stop tanuki-postgres
docker rm tanuki-postgres

# Or clear database data
pnpm prisma migrate reset
```
