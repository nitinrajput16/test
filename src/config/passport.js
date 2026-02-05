const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');

module.exports = function (passport) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error('Google OAuth env vars missing.');
  }

  const User = require('../models/users');
  
  // ---------- GOOGLE STRATEGY ----------
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/auth/google/callback',
      scope: ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        
        if (!email || typeof email !== 'string' || !email.includes('@')) {
          console.error('[AUTH] Invalid or missing email from Google OAuth:', profile.id);
          return done(new Error('Email required from OAuth provider'));
        }
        
        if (!profile.id) {
          console.error('[AUTH] Missing profile ID from Google OAuth');
          return done(new Error('Invalid OAuth profile'));
        }
        
        let user = await User.findOne({ email });
        if (!user) {
          // Auto-generate username for new user
          const username = await User.generateUsername(email);
          console.log('[AUTH] Creating new Google user:', email, '→', username);
          user = await User.create({
            username,
            email,
            googleId: profile.id,
            displayName: profile.displayName,
            provider: 'google',
            avatar: profile.photos?.[0]?.value
          });
        } else {
          // Existing user - link Google account and ensure username exists
          if (!user.googleId) {
            console.log('[AUTH] Linking Google account to existing user:', email);
            user.googleId = profile.id;
          }
          if (!user.username) {
            user.username = await User.generateUsername(email);
            console.log('[AUTH] Added username to existing user:', user.username);
          }
          await user.save();
        }
        return done(null, user);
      } catch (err) {
        console.error('[AUTH] Google OAuth error:', err.message);
        return done(err);
      }
    }
  ));

  // ---------- GITHUB STRATEGY ----------
  const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
  const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
  const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || (process.env.APP_URL ? `${process.env.APP_URL.replace(/\/$/, '')}/auth/github/callback` : 'http://localhost:3000/auth/github/callback');

  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    console.warn('GitHub OAuth env vars missing; GitHub strategy disabled.');
  } else {
    passport.use(new GitHubStrategy(
      {
        clientID: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
        callbackURL: GITHUB_CALLBACK_URL,
        scope: ['user:email']
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let email = profile.emails?.[0]?.value;
          
          if (!profile.id) {
            console.error('[AUTH] Missing profile ID from GitHub OAuth');
            return done(new Error('Invalid OAuth profile'));
          }
          
          if (email && (typeof email !== 'string' || !email.includes('@'))) {
            console.error('[AUTH] Invalid email format from GitHub OAuth:', profile.id);
            email = null;
          }

          let user = null;
          if (email) {
            user = await User.findOne({ email });
          }
          if (!user) {
            user = await User.findOne({ githubId: profile.id });
          }
          if (!user) {
            // Auto-generate username for new user
            const usernameBase = email || profile.username || profile.login || 'user';
            const username = await User.generateUsername(usernameBase);
            console.log('[AUTH] Creating new GitHub user:', usernameBase, '→', username);
            user = await User.create({
              username,
              email: email,
              githubId: profile.id,
              displayName: profile.displayName || profile.username,
              provider: 'github',
              avatar: profile.photos?.[0]?.value
            });
          } else {
            // Existing user - link GitHub and ensure username
            if (!user.githubId) {
              console.log('[AUTH] Linking GitHub account to existing user:', email);
              user.githubId = profile.id;
            }
            if (!user.username) {
              user.username = await User.generateUsername(email || user.email);
              console.log('[AUTH] Added username to existing user:', user.username);
            }
            await user.save();
          }
          return done(null, user);
        } catch (err) {
          console.error('[AUTH] GitHub OAuth error:', err.message);
          return done(err);
        }
      }
    ));
  }

  // ---------- LOCAL STRATEGY (Email/Password) ----------
  passport.use(new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password'
    },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
          return done(null, false, { message: 'Invalid email or password' });
        }
        
        if (!user.passwordHash) {
          return done(null, false, { 
            message: 'This account uses social login. Please sign in with Google or GitHub.' 
          });
        }
        
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        
        if (!isMatch) {
          return done(null, false, { message: 'Invalid email or password' });
        }
        
        console.log('[AUTH] Local login successful:', user.email);
        return done(null, user);
      } catch (err) {
        console.error('[AUTH] Local strategy error:', err.message);
        return done(err);
      }
    }
  ));

  passport.serializeUser((user, done) => done(null, user._id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id).lean();
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
};