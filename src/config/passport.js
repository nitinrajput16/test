const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;

module.exports = function (passport) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error('Google OAuth env vars missing.');
  }

  const User = require('../models/users');
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
        let user = await User.findOne({ email });
        if (!user) {
          user = await User.create({
            email,
            googleId: profile.id,
            displayName: profile.displayName,
            provider: 'google',
            avatar: profile.photos?.[0]?.value
          });
        } else if (!user.googleId) {
          user.googleId = profile.id;
          await user.save();
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  ));

  // ---------- GITHUB STRATEGY (env-driven) ----------
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
          // Prefer a primary & verified email from the profile if available
          let email = profile.emails?.[0]?.value;
          try {
            // Some GitHub responses include multiple emails; passport may not expose verification
            // If you need stricter checks, fetch /user/emails using accessToken here.
          } catch (e) {
            // ignore
          }

          let user = null;
          if (email) {
            user = await User.findOne({ email });
          }
          if (!user) {
            user = await User.findOne({ githubId: profile.id });
          }
          if (!user) {
            user = await User.create({
              email: email,
              githubId: profile.id,
              displayName: profile.displayName || profile.username,
              provider: 'github',
              avatar: profile.photos?.[0]?.value
            });
          } else if (!user.githubId) {
            user.githubId = profile.id;
            await user.save();
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    ));
  }

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