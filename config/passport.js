const GoogleStrategy = require('passport-google-oauth20').Strategy;

module.exports = function(passport) {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error('Google OAuth env vars missing.');
  }
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: '/auth/google/callback',
                scope: ['profile', 'email']
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    // Create user object from Google profile
                    const user = {
                        googleId: profile.id,
                        name: profile.displayName,
                        firstName: profile.name.givenName,
                        lastName: profile.name.familyName,
                        email: profile.emails[0].value,
                        image: profile.photos[0].value,
                        accessToken: accessToken,
                        refreshToken: refreshToken,
                        loginDate: new Date().toISOString(),
                        // Add timezone for your location (India - UTC+5:30)
                        loginTime: new Date().toLocaleString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                        })
                    };
                    
                    console.log(`[${new Date().toISOString()}] Google OAuth Success:`, {
                        name: user.name,
                        email: user.email,
                        id: user.googleId
                    });
                    
                    return done(null, user);
                } catch (error) {
                    console.error(`[${new Date().toISOString()}] Google OAuth Error:`, error);
                    return done(error, null);
                }
            }
        )
    );

    // Serialize user for session storage
    passport.serializeUser((user, done) => {
        done(null, user);
    });

    // Deserialize user from session
    passport.deserializeUser((user, done) => {
        done(null, user);
    });
};