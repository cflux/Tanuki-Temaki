import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { AuthService } from '../services/auth.js';
import { GOOGLE_CALLBACK_URL, GITHUB_CALLBACK_URL } from './constants.js';

// Configure Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const result = await AuthService.findOrCreateOAuthUser({
          provider: 'google',
          providerId: profile.id,
        });

        done(null, result);
      } catch (error) {
        done(error as Error);
      }
    }
  )
);

// Configure GitHub OAuth Strategy
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      callbackURL: GITHUB_CALLBACK_URL,
    },
    async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      try {
        const result = await AuthService.findOrCreateOAuthUser({
          provider: 'github',
          providerId: profile.id,
        });

        done(null, result);
      } catch (error) {
        done(error as Error);
      }
    }
  )
);

// Serialize user for session (not used with JWT, but required by passport)
passport.serializeUser((user: any, done) => {
  done(null, user);
});

// Deserialize user from session (not used with JWT, but required by passport)
passport.deserializeUser((user: any, done) => {
  done(null, user);
});

export default passport;
