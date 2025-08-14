const GoogleStrategy = require('passport-google-oauth20').Strategy;

module.exports = function (passport) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error('Google OAuth env vars missing.');
  }

  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/auth/google/callback',
      scope: ['profile', 'email']
    },
    (accessToken, refreshToken, profile, done) => {
      const user = {
        id: profile.id,
        googleId: profile.id,
        email: profile.emails?.[0]?.value,
        name: profile.displayName,
        firstName: profile.name?.givenName,
        lastName: profile.name?.familyName,
        image: profile.photos?.[0]?.value,
        loginAt: new Date().toISOString()
      };
      return done(null, user);
    }
  ));

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((obj, done) => done(null, obj));
};