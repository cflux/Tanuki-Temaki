# Testing Guide - User Accounts & Personalization Features

## Setup Before Testing

### 1. Set Up OAuth Credentials

You need OAuth credentials to test authentication. Follow these steps:

#### Google OAuth
1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Enable "Google+ API"
4. Navigate to: Credentials → Create Credentials → OAuth 2.0 Client ID
5. Application type: **Web application**
6. Add authorized redirect URI: `http://localhost:3000/api/auth/google/callback`
7. Copy the **Client ID** and **Client Secret**

#### GitHub OAuth
1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: Tanuki Temaki (Dev)
   - **Homepage URL**: `http://localhost:5173`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/github/callback`
4. Copy the **Client ID** and **Client Secret**

### 2. Update Environment Variables

Edit `packages/backend/.env` and add your credentials:

```env
# OAuth - Google
GOOGLE_CLIENT_ID=your-actual-google-client-id-here
GOOGLE_CLIENT_SECRET=your-actual-google-client-secret-here

# OAuth - GitHub
GITHUB_CLIENT_ID=your-actual-github-client-id-here
GITHUB_CLIENT_SECRET=your-actual-github-client-secret-here

# JWT Secret (generate a random string)
JWT_SECRET=your-secure-random-secret-at-least-32-characters
```

**To generate JWT_SECRET (PowerShell):**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

### 3. Start the Application

```bash
# Terminal 1 - Backend
cd packages/backend
pnpm dev

# Terminal 2 - Frontend (separate terminal)
cd packages/web
pnpm dev
```

Frontend will be available at: **http://localhost:5173**

---

## Test Scenarios

### ✅ Test 1: Authentication Flow

**Goal**: Verify OAuth login works end-to-end

1. Navigate to `http://localhost:5173`
2. Click **"Sign In"** button in the header
3. Choose either **Google** or **GitHub**
4. Complete the OAuth flow in the popup
5. **Expected**: You should be redirected back and prompted to choose a username
6. Enter a username (3-20 characters, letters/numbers/underscores/hyphens)
7. **Expected**: Username availability is checked in real-time
8. Click **"Continue"**
9. **Expected**: You're logged in and your username shows in the header

**Verification**:
- ✅ Username appears in header
- ✅ Clicking username shows dropdown with "Profile" and "Sign Out"
- ✅ Page reload maintains login state

---

### ✅ Test 2: Series Ratings

**Goal**: Rate series and verify persistence

1. **While logged in**, search for a series (e.g., "Attack on Titan")
2. Click **"Trace Relationships"** or search by title
3. In the results table, find the **"Your Rating"** column
4. Click on stars to rate a series (1-5) or thumbs down (0)
5. **Expected**: Rating is saved and shows immediately
6. Click the same rating again
7. **Expected**: Rating is removed
8. Refresh the page and search for the same series
9. **Expected**: Your rating is still there

**Verification**:
- ✅ Clicking stars saves rating instantly
- ✅ Clicking same rating removes it
- ✅ Ratings persist across page reloads
- ✅ Anonymous users see "Sign in to rate" message

---

### ✅ Test 3: Private Notes

**Goal**: Add, edit, and delete notes on series

1. **While logged in**, in the results table, find a series
2. Click the **"▶ Details"** button to expand the row
3. Click **"Add note"** or **"Edit note"**
4. **Expected**: Textarea expands
5. Type a private note about the series
6. Click **"Save"**
7. **Expected**: "Saved" confirmation appears
8. Collapse and re-expand the row
9. **Expected**: Your note is still there
10. Click **"Delete"** to remove the note
11. **Expected**: Note is deleted

**Verification**:
- ✅ Notes can be added and edited
- ✅ Character count is shown
- ✅ "Save" button is disabled if no changes
- ✅ Notes persist across expand/collapse
- ✅ Delete button removes note

---

### ✅ Test 4: Tag Voting

**Goal**: Upvote/downvote tags to build preferences

1. **While logged in**, expand a series row (click "▶ Details")
2. Scroll to the **"Tag Preferences"** section
3. See all tags for the series with 👍 and 👎 buttons
4. Click 👍 on a tag you like (e.g., "action")
5. **Expected**: Tag turns green and saves
6. Click 👎 on a tag you dislike (e.g., "romance")
7. **Expected**: Tag turns red and saves
8. Click the same vote again
9. **Expected**: Vote is removed, tag turns gray
10. Go to your **Profile** page (click username → Profile)
11. **Expected**: See "Tags You Like" and "Tags You Dislike" sections
12. **Expected**: Your voted tags appear with vote counts

**Verification**:
- ✅ Upvoting turns tag green
- ✅ Downvoting turns tag red
- ✅ Clicking same vote removes it
- ✅ Profile page shows aggregated tag preferences
- ✅ Vote counts are accurate

---

### ✅ Test 5: Profile Page

**Goal**: View user statistics and preferences

1. **While logged in**, click your username in header
2. Click **"Profile"**
3. **Expected**: See profile page with:
   - Series rated count
   - Liked tags count
   - Disliked tags count
4. Scroll down to see:
   - **Tags You Like** (with vote counts)
   - **Tags You Dislike** (with vote counts)
   - **Your Ratings** (grouped by rating value)
5. **Expected**: All your data is displayed correctly

**Verification**:
- ✅ Statistics are accurate
- ✅ Tags show correct vote counts
- ✅ Ratings are grouped by rating value (5 stars, 4 stars, etc.)
- ✅ Most recent activities appear first

---

### ✅ Test 6: Service Preferences

**Goal**: Set available streaming/reading platforms

1. Go to **Profile** page
2. Scroll to **"Service Preferences"** section
3. **Expected**: See checkboxes for available platforms (if any series have been cached)
4. Check platforms you have access to (e.g., Netflix, Crunchyroll)
5. Click **"Save Preferences"**
6. **Expected**: "Saved!" confirmation appears
7. Refresh the page
8. **Expected**: Your selected services are still checked

**Note**: Services only appear after browsing series that have streaming/reading platform metadata.

**Verification**:
- ✅ Can select multiple services
- ✅ Save button works
- ✅ Preferences persist across page reloads
- ✅ Selected service count is shown

---

### ✅ Test 7: Anonymous User Experience

**Goal**: Verify app works without login

1. **Sign out** (click username → Sign Out)
2. Search for a series
3. **Expected**: Results show normally
4. **Expected**: "Your Rating" column shows "Sign in to rate"
5. Expand a series row (click "▶ Details")
6. **Expected**: No notes section appears
7. **Expected**: Tags show without voting buttons (just gray badges)

**Verification**:
- ✅ App fully functional without login
- ✅ Search and explore work
- ✅ Rating/notes/voting features show login prompts
- ✅ No errors in console

---

### ✅ Test 8: Session Persistence

**Goal**: Verify login persists across browser sessions

1. **While logged in**, note your username in header
2. Close the browser tab completely
3. Open a new tab and go to `http://localhost:5173`
4. **Expected**: You're still logged in (username in header)
5. Click username → **"Sign Out"**
6. Refresh the page
7. **Expected**: You're logged out (shows "Sign In" button)
8. Close tab and reopen
9. **Expected**: Still logged out

**Verification**:
- ✅ Login persists across tabs/windows
- ✅ Login persists after browser restart
- ✅ Logout clears session properly
- ✅ Logged-out state persists

---

### ✅ Test 9: Username Validation

**Goal**: Verify username rules are enforced

1. **Sign out**, then **Sign in** with a different OAuth provider (or delete your account from database first)
2. At username selection:
   - Try username less than 3 characters → **Expected**: Error message
   - Try username more than 20 characters → **Expected**: Error message
   - Try username with special characters (!@#$) → **Expected**: Error message
   - Try username starting with underscore (_test) → **Expected**: Error message
   - Try valid username (e.g., "TestUser123") → **Expected**: Accepted
3. Try username that's already taken → **Expected**: "Username already taken"

**Verification**:
- ✅ Length validation works (3-20 chars)
- ✅ Format validation works (alphanumeric, _, - only)
- ✅ Must start with letter or number
- ✅ Uniqueness check works in real-time

---

### ✅ Test 10: Data Integration

**Goal**: Verify user data shows in series results

1. **While logged in**, rate several series
2. Add notes to some series
3. Vote on tags
4. Search for a series you've interacted with
5. **Expected**: Your rating shows in "Your Rating" column
6. Expand the row
7. **Expected**: Your note shows (if you added one)
8. **Expected**: Your tag votes show with correct colors

**Verification**:
- ✅ Ratings load with series data
- ✅ Notes load with series data
- ✅ Tag votes load with series data
- ✅ No duplicate API calls in network tab

---

## Common Issues & Solutions

### Issue: "Invalid or expired token" after some time
**Solution**: This is expected! Access tokens expire after 15 minutes. Refresh the page to get a new token automatically.

### Issue: No OAuth credentials configured
**Solution**: Make sure you've added `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, and `GITHUB_CLIENT_SECRET` to `packages/backend/.env`

### Issue: "Username already taken" when trying to use your previous username
**Solution**: You can only have one account per OAuth provider. If testing, delete the user from the database: `psql -d tanuki_temaki -c "DELETE FROM users WHERE username = 'your-username';"`

### Issue: Services list is empty in Service Preferences
**Solution**: This is normal if you haven't browsed any series yet. Series need to be cached first with their streaming/reading platform metadata.

### Issue: Tag voting buttons don't show
**Solution**: Make sure you're logged in. Anonymous users see tags as plain badges without voting buttons.

---

## Database Inspection (Optional)

To see your data in the database:

```bash
# Connect to database
psql -d tanuki_temaki

# View your user
SELECT * FROM users;

# View your ratings
SELECT * FROM user_series_ratings;

# View your tag votes
SELECT * FROM user_tag_votes;

# View your notes
SELECT * FROM user_series_notes;

# View your preferences
SELECT * FROM user_preferences;
```

---

## Next Steps After Testing

Once you've verified everything works:

1. **Report any bugs** you find
2. **Test edge cases** (very long notes, many ratings, etc.)
3. **Test across browsers** (Chrome, Firefox, Edge)
4. **Ready for Phase 5**: Personalized Recommendations Algorithm 🚀

---

**Last Updated**: 2026-02-12
**Testing Status**: Ready for comprehensive testing
