require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');const session = require('express-session');
const passport = require('passport');
const path = require('path');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const CodeFile = require('./models/CodeFile');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);
const io = new Server(server);

(async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error('MONGODB_URI not set');
      process.exit(1);
    }
    await mongoose.connect(uri, {
      maxPoolSize: 10,
      retryWrites: true
    });
    console.log('MongoDB Atlas connected');
  } catch (e) {
    console.error('MongoDB connection failed', e);
    process.exit(1);
  }
})();

require('./config/passport')(passport);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files middleware
// app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

// Body parsing middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Session configuration
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'edit-code-editor-secret-2025',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    name: 'editSessionId'
};

// Use MongoDB for session storage if available
if (process.env.MONGODB_URI) {
    sessionConfig.store = MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        touchAfter: 24 * 3600 // lazy session update
    });
}

app.use(session(sessionConfig));
app.use(passport.initialize());
app.use(passport.session());

// Global template variables
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.isAuthenticated = req.isAuthenticated();
    res.locals.currentYear = new Date().getFullYear();
    res.locals.appName = process.env.APP_NAME || 'Edit - Code Editor';
    res.locals.author = 'nr750001';
    res.locals.timestamp = new Date().toISOString();
    next();
});

// Logging middleware (development only)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        const user = req.user ? req.user.email : 'Guest';
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - User: ${user}`);
        next();
    });
}

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));
app.use(cors());

// ----- Gemini Client (single instance) -----
let geminiModelInstance;
let geminiModelName = process.env.GEMINI_INLINE_MODEL || 'gemini-1.5-flash-latest';
function getGeminiModel() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not set');
  }
  if (!geminiModelInstance) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    geminiModelInstance = genAI.getGenerativeModel({ model: geminiModelName });
  }
  return geminiModelInstance;
}

// ----- Save / Update Code -----
app.post('/save-code', async (req, res) => {
  try {
    const { code, filename, language, roomId } = req.body;
    if (!code || !filename) return res.status(400).json({ error: 'Code and filename are required' });

    const safeFilename = filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
    if (!safeFilename) return res.status(400).json({ error: 'Invalid filename' });

    const doc = await CodeFile.findOneAndUpdate(
      { filename: safeFilename },
      { code, language, roomId },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ message: 'File saved successfully', filename: doc.filename, updatedAt: doc.updatedAt });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save the file' });
  }
});

// ----- Load Code -----
app.get('/load-code', async (req, res) => {
  try {
    const { filename } = req.query;
    if (!filename) return res.status(400).json({ error: 'Filename is required' });
    const doc = await CodeFile.findOne({ filename });
    if (!doc) return res.status(404).json({ error: 'File not found' });
    res.json({ code: doc.code, filename: doc.filename, language: doc.language });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load the file' });
  }
});

// ----- List Files -----
app.get('/list-data', async (_req, res) => {
  try {
    const docs = await CodeFile.find({}, 'filename updatedAt').sort({ updatedAt: -1 });
    res.json({ files: docs.map(d => d.filename) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// ----- Judge0 Run -----
app.post('/editor', async (req, res) => {
  const { source_code, language_id, stdin } = req.body;
  if (!source_code || !language_id) {
    return res.status(400).json({ error: 'source_code and language_id are required' });
  }
  try {
    const response = await axios.post(
      `${process.env.JUDGE0_API_URL}/submissions?base64_encoded=false&wait=true`,
      { source_code, language_id, stdin },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-RapidAPI-Key': process.env.JUDGE0_API_KEY
        }
      }
    );
    res.json(response.data);
  } catch (e) {
    console.error('Judge0 error:', e.message);
    res.status(500).json({ error: 'Failed to compile the code' });
  }
});

// ----- Inline Code Completion (Gemini) -----
app.post('/ai/inline', async (req, res) => {
  try {
    const { prefix, language = 'JavaScript' } = req.body;
    if (!prefix) return res.status(400).json({ error: 'prefix required' });

    const MAX_CHARS = 8000;
    const truncated = prefix.slice(-MAX_CHARS);

    const instruction = `You are a ${language} code autocomplete engine.
Continue the code directly after the given snippet.
Return ONLY the continuation code (no backticks, no explanations).
Keep it concise and syntactically valid.
If no sensible continuation, return an empty string.`;

    const model = getGeminiModel();
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
            parts: [{
              text: instruction + "\n\n<CODE SNIPPET START>\n" + truncated + "\n<CODE SNIPPET END>\n\nContinuation:\n"
            }]
        }
      ],
      generationConfig: {
        maxOutputTokens: 80,
        temperature: 0.2
      }
    });

    const raw = result.response?.text?.() || '';
    const cleaned = raw
      .replace(/```[\s\S]*?```/g, '')
      .replace(/```/g, '')
      .trimStart();

    res.json({ suggestion: cleaned });
  } catch (e) {
    console.error('Gemini inline error', e);
    res.status(500).json({ error: 'inline completion failed' });
  }
});

// ----- Realtime Collaboration -----
io.on('connection', (socket) => {
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
  });
  socket.on('code-update', ({ roomId, content }) => {
    socket.to(roomId).emit('code-update', content);
  });
});

app.use((req, res, next) => {
    res.status(404).render('404', {
        title: 'Page Not Found - Edit',
        url: req.originalUrl,
        currentTime: new Date().toISOString()
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error(`[${new Date().toISOString()}] Application Error:`, err);
    
    const errorDetails = process.env.NODE_ENV === 'development' ? err : 'Something went wrong!';
    
    res.status(err.status || 500).render('error', {
        title: 'Error - Edit',
        error: errorDetails,
        currentTime: new Date().toISOString()
    });
});


app.listen(PORT, () => {
    console.log('=====================================');
    console.log(`🚀 Edit Code Editor Server Started`);
    console.log(`📅 Time: ${new Date().toISOString()}`);
    console.log(`🌐 URL: http://${HOST}:${PORT}`);
    console.log(`👤 Author: nr750001`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('=====================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log(`[${new Date().toISOString()}] SIGTERM received. Shutting down gracefully...`);
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log(`[${new Date().toISOString()}] SIGINT received. Shutting down gracefully...`);
    process.exit(0);
});