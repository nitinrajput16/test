/**
 * Delete invalid long-duration sessions (likely unclosed sessions that got auto-capped)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function cleanInvalidSessions() {
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

    // Find sessions with duration >= 1.5 hours (likely invalid/unclosed)
    const allSessions = await EditorSession.find({ end: { $exists: true } });
    const invalidSessions = [];

    for (const session of allSessions) {
      const duration = (session.end - session.start) / 1000 / 3600; // hours
      // Delete sessions that are exactly 1 or 2 hours (auto-capped sessions)
      if (duration >= 0.98 && duration <= 2.02) {
        invalidSessions.push(session);
      }
    }

    console.log(`Found ${invalidSessions.length} sessions with duration >= 1.5 hours\n`);

    for (const session of invalidSessions) {
      const duration = (session.end - session.start) / 1000 / 3600;
      console.log(`Deleting: userId=${session.userId}, date=${session.date}, duration=${duration.toFixed(2)}h`);
      await session.deleteOne();
    }

    console.log(`\n✅ Deleted ${invalidSessions.length} invalid long-duration sessions`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

cleanInvalidSessions();
