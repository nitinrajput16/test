/**
 * Close all open editor sessions older than 2 hours
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function closeOldSessions() {
  try {
    const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected\n');

    const EditorSession = mongoose.model('EditorSession', new mongoose.Schema({
      userId: String,
      start: Date,
      end: Date,
      date: String
    }));

    // Find all open sessions (no end time)
    const openSessions = await EditorSession.find({ end: { $exists: false } });
    console.log(`Found ${openSessions.length} open sessions\n`);

    let closed = 0;
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000); // Changed from 2 hours to 5 minutes

    for (const session of openSessions) {
      // Close sessions older than 5 minutes (reasonable timeout for active session)
      if (session.start < fiveMinutesAgo) {
        // Calculate reasonable end time: either 1 hour after start, or 5 minutes ago (whichever is earlier)
        const oneHourAfterStart = new Date(session.start.getTime() + 60 * 60 * 1000);
        const endTime = oneHourAfterStart < fiveMinutesAgo ? oneHourAfterStart : fiveMinutesAgo;
        session.end = endTime;
        await session.save();
        closed++;
        console.log(`Closed session: userId=${session.userId}, date=${session.date}, started=${session.start.toLocaleString()}, ended=${endTime.toLocaleString()}`);
      }
    }

    console.log(`\n✅ Closed ${closed} old open sessions`);
    console.log(`${openSessions.length - closed} recent sessions remain open`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

closeOldSessions();
