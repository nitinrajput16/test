# Real-time Collaborative Code Editor

A powerful, real-time collaborative code editor built with Node.js, Socket.IO, and Monaco Editor. Features include simultaneous editing with Operational Transformation (OT), live cursor tracking, voice chat, an interactive whiteboard, and AI-powered code assistance.

## 🚀 Features

### 👨‍💻 User Features
- **Real-time Collaboration:**
  - **Simultaneous Editing:** Multiple users can edit the same file at the same time without conflicts, powered by an Operational Transformation (OT) algorithm.
  - **Live Presence:** See who is in the room, their cursor position, and their text selection in real-time.
  - **Active File Sync:** When a user opens a file, it automatically syncs for all other users in the room.
- **Code Editor:**
  - **Monaco Editor:** Full-featured code editor (VS Code core) with syntax highlighting for 70+ languages.
  - **Code Execution:** Run code directly in the browser (supports Python, JavaScript, C++, Java, and more) via Judge0 API.
  - **Autosave:** Changes are saved automatically every 5 seconds and when you leave the page.
- **Communication Tools:**
  - **Voice Chat:** Built-in WebRTC voice chat with mute controls and speaking indicators.
  - **Whiteboard:** Real-time interactive whiteboard for brainstorming (draw, shapes, text, undo/redo).
- **AI Assistance:**
  - **Inline AI:** Generate or explain code using Google Gemini AI integration.
- **File Management:**
  - Create, rename, delete, and search files.
  - Cloud storage for all your code snippets.
- **Authentication:**
  - Secure login via Google OAuth.

### 🛠 Developer Features
- **Architecture:** Built on a robust Node.js & Express backend with MongoDB for persistence.
- **Real-time Engine:** Custom Socket.IO implementation for room management, signaling, and event broadcasting.
- **OT Engine:** Server-authoritative Operational Transformation implementation to ensure document consistency across clients.
- **Modular Design:** Clean separation of concerns (Routes, Models, Middleware, Socket handlers).

---

## 📖 User Guide

### Getting Started
1. **Login:** Sign in using your Google account.
2. **Dashboard:** You will be redirected to the main editor interface.
3. **Join a Room:**
   - Enter a **Room ID** in the top bar and click "Join" (or use the default room).
   - Share the Room ID with colleagues to collaborate.

### Using the Editor
- **Writing Code:** Just type! Your changes are broadcast instantly.
- **Running Code:**
  1. Select your language from the dropdown.
  2. (Optional) Enter standard input (stdin) in the "Input" tab.
  3. Click **Run** to execute your code and see the output.
- **Managing Files:**
  - **New File:** Click the `+` button in the file toolbar.
  - **Save:** Click the "Save" button (or rely on Autosave).
  - **Open:** Click any file in the left sidebar to load it.
  - **Upload:** Upload existing code files from your computer.

### Collaboration Tools
- **Voice Chat:**
  - Click "Join Voice" to enter the audio channel.
  - Use "Mute" to toggle your microphone.
  - See who is speaking via the green indicators in the user list.
- **Whiteboard:**
  - Click the "Whiteboard" button to open the drawing canvas.
  - Use the toolbar to select pen, shapes, or text tools.
  - All drawings are synced in real-time with other users in the room.

---

## 💻 Developer Guide

### Prerequisites
- **Node.js** (v14+ recommended)
- **MongoDB** (Local or Atlas URI)
- **Google Cloud Console Project** (for OAuth)
- **RapidAPI Account** (for Judge0, optional for code execution)
- **Google Gemini API Key** (for AI features)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/your-repo-name.git
   cd your-repo-name
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   Create a `.env` file in the root directory with the following variables:
   ```env
   PORT=3000
   HOST=localhost
   MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/test
   SESSION_SECRET=your_super_secret_key
   
   # Google OAuth
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   
   # Code Execution (RapidAPI Judge0)
   JUDGE0_API_KEY=your_rapidapi_key
   
   # AI Integration
   GEMINI_API_KEY=your_gemini_api_key
   ```

4. **Run the application:**
   ```bash
   # Development mode (with nodemon)
   npm run dev
   
   # Production mode
   npm start
   ```

5. **Access the app:**
   Open `http://localhost:3000` in your browser.

### Project Structure

```
├── src/                # Source code
│   ├── config/         # Passport authentication config
│   ├── lib/            # Shared libraries (e.g., OT logic)
│   ├── middleware/     # Express middleware (Auth checks)
│   ├── models/         # Mongoose models (User, CodeFile)
│   ├── routes/         # Express routes
│   │   ├── api/        # API endpoints (Code, AI)
│   │   └── ...
│   ├── socket/         # Socket.IO event handlers
│   │   └── index.js    # Main socket logic (OT, Rooms, Voice)
│   ├── views/          # EJS templates
│   └── app.js          # Application entry point
├── public/             # Static assets (JS, CSS, Images)
│   ├── script.js       # Main frontend logic (Editor, Socket, UI)
│   ├── audioChat.js    # WebRTC voice chat logic
│   └── style2.css      # Main stylesheet
├── tests/              # Test files
│   └── connection_test.js
└── package.json        # Dependencies and scripts
```

### Key Technologies

- **Operational Transformation (OT):**
  - Implemented in `src/lib/ot.js` and `public/script.js`.
  - Handles `insert` and `delete` operations.
  - Ensures eventual consistency even with high latency.
- **Socket.IO Events:**
  - `join-room`: User joins a collaboration session.
  - `ot-operation`: Transmits code edits.
  - `cursor-position` / `selection-update`: Syncs user presence.
  - `voice:signal`: WebRTC signaling for voice chat.
  - `active-file`: Syncs the currently open file across the room.

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/code/list` | List all files for the logged-in user. |
| `GET` | `/api/code/load` | Load a specific file by filename. |
| `POST` | `/api/code/save` | Save code content to the database. |
| `POST` | `/api/code/run` | Execute code via Judge0. |
| `POST` | `/api/ai/generate` | Generate code using AI. |

---

## 🤝 Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
