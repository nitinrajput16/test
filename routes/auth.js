const express = require('express');
const passport = require('passport');
const router = express.Router();

// @desc    Initiate Google OAuth
// @route   GET /auth/google
router.get('/google', 
    passport.authenticate('google', { 
        scope: ['profile', 'email'] 
    })
);

// @desc    Google OAuth callback
// @route   GET /auth/google/callback
router.get('/google/callback',
    passport.authenticate('google', { 
        failureRedirect: '/login-error',
        failureMessage: true 
    }),
    (req, res) => {
        // Successful authentication
        console.log(`[${new Date().toISOString()}] OAuth callback successful for user:`, req.user.email);
        res.redirect('/editor');
    }
);

// @desc    Logout user
// @route   GET /auth/logout
router.get('/logout', (req, res, next) => {
    const userEmail = req.user ? req.user.email : 'Unknown';
    
    req.logout((err) => {
        if (err) {
            console.error(`[${new Date().toISOString()}] Logout error:`, err);
            return next(err);
        }
        
        req.session.destroy((err) => {
            if (err) {
                console.error(`[${new Date().toISOString()}] Session destroy error:`, err);
                return next(err);
            }
            
            res.clearCookie('connect.sid');
            console.log(`[${new Date().toISOString()}] User logged out successfully:`, userEmail);
            res.redirect('/?message=logged_out');
        });
    });
});

// @desc    Check authentication status API
// @route   GET /auth/status
router.get('/status', (req, res) => {
    res.json({
        authenticated: req.isAuthenticated(),
        timestamp: new Date().toISOString(),
        user: req.isAuthenticated() ? {
            name: req.user.name,
            email: req.user.email,
            image: req.user.image,
            loginTime: req.user.loginTime
        } : null
    });
});

module.exports = router;