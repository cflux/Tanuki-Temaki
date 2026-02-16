# Deployment Guide - Tanuki Temaki

## Quick Start Deployment

### 1. Prerequisites

Ensure your Docker server has:
- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 2GB RAM available
- At least 5GB disk space

 # Clone the repository
  git clone <your-repo-url>
  cd Tanuki-Temaki

### 2. Setup Environment Variables

Create a `.env` file in the project root:

```bash
# Generate a secure JWT secret
openssl rand -base64 32

# Copy the example
cp .env.example .env

# Edit with your values
nano .env  # or vi .env
```

**Required settings for deployment:**

```env
# Host Configuration - Use your server's IP or hostname
HOST=192.168.1.100  # Replace with your server's IP

# Database - CHANGE THE PASSWORD!
POSTGRES_PASSWORD=your-very-secure-password-here

# Server Configuration
NODE_ENV=production
PORT=3000
FRONTEND_PORT=80

# OAuth - Google (Get from https://console.cloud.google.com/)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# JWT Authentication - CHANGE THIS!
JWT_SECRET=paste-the-output-from-openssl-rand-command-here

# Admin Users - Set to your OAuth username
ADMIN_USERNAMES=your_google_username
```

### 3. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Application type: Web application
6. Add authorized redirect URI:
   - `http://your-server-ip:3000/api/auth/google/callback`
   - Example: `http://192.168.1.100:3000/api/auth/google/callback`
7. Copy Client ID and Client Secret to your `.env` file

### 4. Build and Deploy

```bash
# Build all images
docker compose build

# Start all services
docker compose up -d

# Check logs
docker compose logs -f

# Wait for migrations to complete (you'll see "HTTP server listening on port 3000")
```

### 5. Verify Deployment

1. **Check all containers are running:**
   ```bash
   docker ps
   ```
   You should see: `tanuki-postgres`, `tanuki-backend`, `tanuki-frontend`

2. **Test the frontend:**
   - Open: `http://your-server-ip`
   - You should see the Tanuki Temaki interface

3. **Test the backend:**
   ```bash
   curl http://your-server-ip:3000/api/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

4. **Test OAuth login:**
   - Click "SIGN IN" on the website
   - Complete Google OAuth flow
   - Should redirect back and log you in

### 6. Troubleshooting

#### Containers won't start
```bash
# Check logs for specific service
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres

# Restart all services
docker-compose restart
```

#### OAuth fails with "redirect_uri_mismatch"
- Double-check your Google OAuth console has the correct callback URL
- Make sure HOST in .env matches your server's IP
- The callback URL must be: `http://YOUR_HOST:3000/api/auth/google/callback`

#### "Invalid or expired token" errors
- Make sure JWT_SECRET is set in .env
- Make sure JWT_SECRET is at least 32 characters
- Restart backend: `docker-compose restart backend`

#### Database connection errors
- Check postgres is running: `docker ps | grep postgres`
- Check DATABASE_URL matches POSTGRES_PASSWORD
- Restart postgres: `docker-compose restart postgres`

#### Frontend shows "Network Error"
- Check backend is running: `curl http://localhost:3000/api/health`
- Check HOST variable in .env is correct
- Rebuild frontend: `docker-compose build frontend && docker-compose up -d frontend`

### 7. Maintenance Commands

```bash
# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove all data (DESTRUCTIVE!)
docker-compose down -v

# Restart a specific service
docker-compose restart backend

# Rebuild and restart after code changes
docker-compose build backend
docker-compose up -d backend

# Access database directly
docker exec -it tanuki-postgres psql -U tanuki -d tanuki_temaki

# Backup database
docker exec tanuki-postgres pg_dump -U tanuki tanuki_temaki > backup.sql

# Restore database
docker exec -i tanuki-postgres psql -U tanuki tanuki_temaki < backup.sql
```

### 8. Updating the Application

When you pull new code:

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose build
docker-compose up -d

# Check logs for any errors
docker-compose logs -f
```

### 9. Production Hardening (Optional)

For a production deployment, consider:

1. **Use HTTPS:**
   - Add a reverse proxy (nginx, Traefik, Caddy)
   - Get SSL certificate (Let's Encrypt)
   - Update HOST to use your domain

2. **Secure the Database:**
   - Don't expose port 5432 externally (remove from docker-compose ports)
   - Use a stronger password
   - Regular backups

3. **Add Monitoring:**
   - Set up log aggregation
   - Add health check monitoring
   - Set up alerts for container failures

4. **Resource Limits:**
   Add to docker-compose.yml:
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '1.0'
         memory: 1G
       reservations:
         cpus: '0.5'
         memory: 512M
   ```

## Architecture

```
                          ┌─────────────┐
                          │   Browser   │
                          └──────┬──────┘
                                 │ HTTP :80
                    ┌────────────▼─────────────┐
                    │  Frontend (Nginx)        │
                    │  Static React App        │
                    └────────────┬─────────────┘
                                 │ API calls :3000
                    ┌────────────▼─────────────┐
                    │  Backend (Node.js)       │
                    │  Express + Prisma        │
                    └────────────┬─────────────┘
                                 │ PostgreSQL
                    ┌────────────▼─────────────┐
                    │  Database (PostgreSQL)   │
                    │  Persistent Storage      │
                    └──────────────────────────┘
```

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| HOST | Yes | Server IP or hostname | `192.168.1.100` |
| POSTGRES_PASSWORD | Yes | Database password | `secure-password-123` |
| GOOGLE_CLIENT_ID | Yes | Google OAuth Client ID | `xxx.apps.googleusercontent.com` |
| GOOGLE_CLIENT_SECRET | Yes | Google OAuth Secret | `GOCSPX-xxx` |
| JWT_SECRET | Yes | Secret for JWT tokens (32+ chars) | `openssl rand -base64 32` |
| ADMIN_USERNAMES | Yes | Comma-separated admin usernames | `alice,bob` |
| NODE_ENV | No | Environment mode | `production` (default: `development`) |
| PORT | No | Backend port | `3000` (default) |
| FRONTEND_PORT | No | Frontend port | `80` (default) |
| GITHUB_CLIENT_ID | No | GitHub OAuth Client ID (optional) | Leave empty if not using |
| GITHUB_CLIENT_SECRET | No | GitHub OAuth Secret (optional) | Leave empty if not using |

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review the logs: `docker-compose logs -f`
3. Ensure all environment variables are set correctly
4. Verify OAuth callback URLs match your HOST setting
