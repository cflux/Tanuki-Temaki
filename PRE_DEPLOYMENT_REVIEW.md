# Pre-Deployment Review - Tanuki Temaki

## ✅ Good Practices Found
- ✅ Centralized environment configuration with HOST variable
- ✅ OAuth token exchange pattern for cross-domain auth
- ✅ Proper error handling in most places
- ✅ Using logger instead of console in most backend code
- ✅ Environment variables properly defaulted with fallbacks
- ✅ Docker healthchecks configured
- ✅ Database migrations in place
- ✅ No TODO/FIXME comments left in code
- ✅ Good separation of concerns with monorepo structure

## 🔧 Issues to Fix Before Deployment

### 1. Missing Environment Variables in docker-compose.yml
**Priority: HIGH**

The docker-compose.yml is missing several required environment variables for the backend:

**Missing:**
- `HOST` - Should be set to your server's hostname/IP
- `GOOGLE_CLIENT_ID` - Required for OAuth
- `GOOGLE_CLIENT_SECRET` - Required for OAuth
- `JWT_SECRET` - Required for authentication
- `ADMIN_USERNAMES` - Required for admin access
- `FRONTEND_PORT` - Used by backend to construct URLs
- `GITHUB_CLIENT_ID` - If using GitHub OAuth
- `GITHUB_CLIENT_SECRET` - If using GitHub OAuth

**Current Issues:**
- Line 37: `CORS_ORIGIN` should be `FRONTEND_URL`
- Missing HOST variable which all URLs are derived from

### 2. Debug Console.log in Production Code
**Priority: MEDIUM**

File: `packages/backend/src/services/auth.ts` (lines 154-158)

```typescript
console.log('[Admin Check]', {
  username: user.username,
  adminUsernames: Array.from(ADMIN_USERNAMES),
  isAdmin,
});
```

**Recommendation:** Replace with `logger.debug()` or remove entirely.

### 3. Missing .dockerignore File
**Priority: MEDIUM**

No `.dockerignore` file exists, which means Docker builds may be copying unnecessary files (node_modules, .git, etc.) increasing build times and image sizes.

**Recommendation:** Create `.dockerignore` files at the root level.

### 4. Frontend Build Args May Not Pass Through Correctly
**Priority: MEDIUM**

In docker-compose.yml lines 57-59, the build args are being passed but the frontend needs HOST to derive the API URL via vite.config.ts. The current approach might not work correctly.

**Current:**
```yaml
args:
  VITE_API_URL: ${VITE_API_URL:-http://localhost:3000}
  VITE_WS_URL: ${VITE_WS_URL:-ws://localhost:8765}
```

**Issue:** These need to be set in your environment or the defaults will be used (localhost).

### 5. No .env File Validation
**Priority: LOW**

There's no check to ensure required environment variables are set before starting the server.

## 📝 Recommended Fixes

### Fix 1: Update docker-compose.yml

Add the following to the backend service environment section:

```yaml
backend:
  environment:
    NODE_ENV: production
    HOST: ${HOST}
    DATABASE_URL: postgresql://tanuki:${POSTGRES_PASSWORD}@postgres:5432/tanuki_temaki
    PORT: 3000
    FRONTEND_PORT: ${FRONTEND_PORT:-80}
    WS_PORT: 8765
    GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
    GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
    JWT_SECRET: ${JWT_SECRET}
    ADMIN_USERNAMES: ${ADMIN_USERNAMES}
    GITHUB_CLIENT_ID: ${GITHUB_CLIENT_ID:-}
    GITHUB_CLIENT_SECRET: ${GITHUB_CLIENT_SECRET:-}
```

And update frontend build args:
```yaml
frontend:
  build:
    args:
      HOST: ${HOST}
```

### Fix 2: Remove Debug Console.log

Replace the console.log in `packages/backend/src/services/auth.ts` with:
```typescript
logger.debug('Admin check', {
  username: user.username,
  isAdmin,
});
```

### Fix 3: Create .dockerignore

Create `D:\claude\Tanuki Temaki\.dockerignore`:
```
node_modules
.git
.env
.env.*
!.env.example
*.log
logs
coverage
dist
build
.vscode
.idea
*.swp
*.swo
.DS_Store
Thumbs.db
```

### Fix 4: Create Deployment .env

Create a `.env` file for your Docker server with actual values:

```bash
# Host Configuration
HOST=your-server-ip-or-hostname

# Database
POSTGRES_PASSWORD=your-secure-password-here
DATABASE_URL=postgresql://tanuki:your-secure-password-here@postgres:5432/tanuki_temaki

# Server Configuration
NODE_ENV=production
PORT=3000
FRONTEND_PORT=80

# OAuth - Google
GOOGLE_CLIENT_ID=your-actual-google-client-id
GOOGLE_CLIENT_SECRET=your-actual-google-client-secret

# JWT Authentication
JWT_SECRET=your-very-secure-random-secret-key-min-32-chars

# Admin Users
ADMIN_USERNAMES=your_username_here

# Optional: GitHub OAuth (can leave empty if not using)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

## 🚀 Deployment Checklist

- [ ] Create `.env` file with production values
- [ ] Update docker-compose.yml with all required environment variables
- [ ] Create `.dockerignore` file
- [ ] Fix the debug console.log in auth.ts
- [ ] Ensure Google OAuth console has correct callback URL: `http://your-server-ip:3000/api/auth/google/callback`
- [ ] Ensure database password is secure (not dev123)
- [ ] Ensure JWT_SECRET is a strong random string (at least 32 characters)
- [ ] Set ADMIN_USERNAMES to your actual username(s)
- [ ] Test build locally: `pnpm build:all`
- [ ] Test Docker build: `docker-compose build`
- [ ] Run database migrations: Will happen automatically on first start
- [ ] Verify all containers start: `docker-compose up -d`
- [ ] Check logs: `docker-compose logs -f`
- [ ] Test OAuth login flow
- [ ] Verify admin access works

## 📊 Code Quality Notes

**Strengths:**
- Clean separation of concerns
- Good use of TypeScript
- Consistent error handling patterns
- Proper use of environment variables
- Good logging practices (mostly)

**Minor Improvements Possible (Post-Deployment):**
- Add environment variable validation on startup
- Add more comprehensive error messages for common deployment issues
- Consider adding a setup script to guide first-time deployment
- Add Docker health check endpoints that verify OAuth credentials are configured

## 🔒 Security Notes

**Good:**
- No hardcoded secrets in code
- Using httpOnly cookies for auth
- JWT with proper expiry
- Environment variable based configuration

**Verify:**
- [ ] Database password is strong
- [ ] JWT_SECRET is cryptographically random (use: `openssl rand -base64 32`)
- [ ] OAuth secrets are kept secure
- [ ] .env file is in .gitignore (it is)

## 📦 Build Size Notes

The Docker images will include:
- Backend: Node.js runtime + compiled TypeScript + node_modules
- Frontend: Nginx + static build files
- Database: PostgreSQL 16 Alpine (lightweight)

Total disk usage will be approximately 500MB-1GB depending on dependencies.
