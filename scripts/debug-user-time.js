/**
 * Debug a specific user's sessions today
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function debugUserSessions() {
  try {
    const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(MONGO_URI);
    
    const db = mongoose.connection.db;
    const sessions = db.collection('editorsessions');
    
    // Get today's date in IST
    const now = new Date();
    const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const dateStr = istNow.toISOString().slice(0,10);
    
    console.log(`Today's date: ${dateStr}\n`);
    
    // Get all users with sessions today
    const users = await sessions.distinct('userId', { date: dateStr });
    console.log(`Users with sessions today: ${users.join(', ')}\n`);
    
    // For each user, calculate total time
    for (const userId of users) {
      const userSessions = await sessions.find({ userId, date: dateStr }).toArray();
      console.log(`\n👤 User: ${userId}`);
      console.log(`   Sessions: ${userSessions.length}`);
      
      let total = 0;
      const MAX_SESSION_HOURS = 2;
      
      userSessions.forEach((s, i) => {
        const start = new Date(s.start);
        const end = s.end ? new Date(s.end) : null;
        
        let duration = 0;
        if (end) {
          duration = (end - start) / 1000;
        } else {
          const openDuration = (now - start) / 1000;
          duration = Math.min(openDuration, MAX_SESSION_HOURS * 3600);
        }
        
        total += duration;
        
        const h = Math.floor(duration / 3600);
        const m = Math.floor((duration % 3600) / 60);
        const sec = Math.floor(duration % 60);
        const durationStr = h > 0 ? `${h}h ${m}m ${sec}s` : (m > 0 ? `${m}m ${sec}s` : `${sec}s`);
        
        console.log(`   ${i+1}. Start: ${start.toLocaleTimeString()}, End: ${end ? end.toLocaleTimeString() : 'OPEN'}, Duration: ${durationStr}`);
      });
      
      const totalH = Math.floor(total / 3600);
      const totalM = Math.floor((total % 3600) / 60);
      console.log(`   ⏱️  Total: ${totalH}h ${totalM}m`);
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

debugUserSessions();
