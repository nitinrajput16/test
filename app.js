require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const mongoose = require('mongoose');

const { initSocket } = require('./socket');

// ---------- BASIC INIT ----------
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

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

// ---------- CORE MIDDLEWARE ----------
app.use((req, _res, next) => {
  next();
});
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: '1mb' }));
app.use(cors());

// ---------- SESSION ----------
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'edit-code-editor-secret-2025',
  resave: false,
  saveUninitialized: false,
  name: 'editSessionId',
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
app.use('/auth', require('./routes/auth'));
app.use('/api/code', require('./routes/api/code'));
app.use('/api/ai', require('./routes/api/ai'));
app.use('/profile', require('./routes/api/profile'));
app.use('/api/editor', require('./routes/api/editor'));

// ---------- STATIC (AFTER PROTECTION) ----------
app.use(express.static(path.join(__dirname, 'public')));

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
server.listen(PORT, () => {
  console.log('=====================================');
  console.log(`🌐 URL: http://${HOST}:${PORT}`);
  console.log(`👤 Author: nr750001`);
  console.log('=====================================');
});

// ---------- SHUTDOWN ----------
// ['SIGINT', 'SIGTERM'].forEach(sig => {
//   process.on(sig, () => {
//     process.exit(0);
//   });
// });