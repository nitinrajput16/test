/**
 * Quick check script to see EditorSession data
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function check() {
  try {
    const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected\n');

    const db = mongoose.connection.db;
    const sessions = db.collection('editorsessions');

    // Count total sessions
    const total = await sessions.countDocuments({});
    console.log(`Total EditorSessions: ${total}`);

    // Count with userId field
    const withUserId = await sessions.countDocuments({ userId: { $exists: true } });
    console.log(`With userId field: ${withUserId}`);

    // Count with googleId field (old)
    const withGoogleId = await sessions.countDocuments({ googleId: { $exists: true } });
    console.log(`With googleId field (old): ${withGoogleId}`);

    // Sample recent sessions
    const recent = await sessions.find({}).sort({ start: -1 }).limit(5).toArray();
    console.log('\nRecent 5 sessions:');
    recent.forEach(s => {
      console.log(`  - userId: ${s.userId || 'MISSING'}, date: ${s.date}, start: ${s.start}, end: ${s.end || 'open'}`);
    });

    // Check today's sessions
    const now = new Date();
    const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const dateStr = istNow.toISOString().slice(0,10);
    const todaySessions = await sessions.find({ date: dateStr }).toArray();
    console.log(`\nToday (${dateStr}) sessions: ${todaySessions.length}`);
    todaySessions.forEach(s => {
      console.log(`  - userId: ${s.userId}, start: ${s.start}, end: ${s.end || 'open'}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

check();
