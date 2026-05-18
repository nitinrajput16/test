const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const http = require('http');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;

const { initSocket } = require('./socket');

// ---------- BASIC INIT ----------
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
// Bind to 0.0.0.0 by default so cloud hosts (Render, Heroku, etc.) can reach the server
const HOST = process.env.HOST || '0.0.0.0';

const isProduction = process.env.NODE_ENV === 'production';

// If running behind a reverse proxy (Render, Railway, Nginx, etc.),
// trust the proxy so secure cookies work correctly.
if (isProduction || process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

// ---------- DATABASE ----------
(async () => {
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
    await mongoose.connect(process.env.MONGODB_URI, { maxPoolSize: 10 });
    console.log('MongoDB Atlas connected');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
})();

// ---------- PASSPORT CONFIG ----------
require('./config/passport')(passport);

// ---------- VIEW ENGINE ----------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ---------- SECURITY MIDDLEWARE ----------
// Helmet adds security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for Monaco Editor CDN
  crossOriginEmbedderPolicy: false // Allow external resources
}));

function getClientAddress(req) {
  if (typeof req.ip === 'string' && req.ip.trim()) {
    return req.ip.trim();
  }

  if (typeof req.socket?.remoteAddress === 'string' && req.socket.remoteAddress.trim()) {
    return req.socket.remoteAddress.trim();
  }

  if (typeof req.connection?.remoteAddress === 'string' && req.connection.remoteAddress.trim()) {
    return req.connection.remoteAddress.trim();
  }

  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }

  const cloudflareIp = req.headers['cf-connecting-ip'];
  if (typeof cloudflareIp === 'string' && cloudflareIp.trim()) {
    return cloudflareIp.trim();
  }

  return '';
}

function rateLimitKeyGenerator(req) {
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }

  const clientAddress = getClientAddress(req);
  if (clientAddress) {
    return `ip:${ipKeyGenerator(clientAddress)}`;
  }

  return `unknown:${req.method}:${req.originalUrl || req.url || 'request'}`;
}

// Rate limiting for authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKeyGenerator,
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per minute
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKeyGenerator,
});

function parseCorsOrigins(value) {
  return String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN);
const corsOptions = {
  origin: corsOrigins.length > 0 ? corsOrigins : (isProduction ? false : true),
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
};

// ---------- CORE MIDDLEWARE ----------
app.use((req, _res, next) => {
  next();
});
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: '1mb' }));
app.use(cors(corsOptions));

// ---------- SESSION ----------
if (!process.env.SESSION_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ SECURITY ERROR: SESSION_SECRET must be set in production');
    process.exit(1);
  } else {
    console.warn('⚠️  WARNING: Using insecure default SESSION_SECRET in development');
    // console.warn('⚠️  Generate a secure secret with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))")"');
  }
}

const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'dev-insecure-session-secret',
  resave: false,
  saveUninitialized: false,
  name: 'editSessionId',
  proxy: process.env.TRUST_PROXY === '1',
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
};
if (process.env.MONGODB_URI) {
  sessionConfig.store = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600
  });
}
const sessionMiddleware = session(sessionConfig);
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

// ---------- LOCALS ----------
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.isAuthenticated = req.isAuthenticated && req.isAuthenticated();
  res.locals.appName = process.env.APP_NAME || 'Edit - Code Editor';
  res.locals.author = 'nr750001';
  res.locals.currentYear = new Date().getFullYear();
  next();
});

// ---------- ROUTES (BEFORE STATIC) ----------
app.use('/', require('./routes/index'));
app.use('/auth', authLimiter, require('./routes/auth')); // Apply rate limiting to auth routes
app.use('/api/code', apiLimiter, require('./routes/api/code'));
app.use('/api/ai', apiLimiter, require('./routes/api/ai'));
app.use('/profile', apiLimiter, require('./routes/api/profile'));
app.use('/api/editor', apiLimiter, require('./routes/api/editor'));

// ---------- STATIC (AFTER PROTECTION) ----------
app.use('/monaco-editor', express.static(path.join(__dirname, '../node_modules/monaco-editor')));
app.use('/vendor/fontawesome', express.static(path.join(__dirname, '../node_modules/@fortawesome/fontawesome-free')));
app.use(express.static(path.join(__dirname, '../public')));

// ---------- SOCKET.IO ----------
initSocket(server, { sessionMiddleware });

// ---------- 404 ----------
app.use((req, res) => {
  res.status(404).render('404', {
    title: 'Page Not Found',
    url: req.originalUrl
  });
});

// ---------- ERROR HANDLER ----------
app.use((err, req, res, _next) => {
  res.status(err.status || 500).render('error', {
    title: 'Error',
    message: err.message || 'An unexpected error occurred.',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// ---------- START ----------
server.listen(PORT, HOST, () => {
  console.log('=====================================');
  console.log(`🌐 Listening on port ${PORT} (bound to ${HOST})`);
  if (process.env.APP_URL) console.log(`🔗 Public URL: ${process.env.APP_URL}`);
  console.log(`👤 Author: nitin...`);
  console.log('=====================================');
});