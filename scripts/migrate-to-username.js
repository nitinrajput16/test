/**
 * Migration Script: Add username to existing users and migrate googleId to userId
 * 
 * Run this script ONCE after deploying the new authentication system.
 * 
 * Usage: node scripts/migrate-to-username.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

// Load .env from project root
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Connect to MongoDB
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/codeplat';

async function migrate() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // 1. Migrate Users - Add username if missing
    console.log('\n📦 Migrating Users collection...');
    const usersCollection = db.collection('users');
    const users = await usersCollection.find({}).toArray();
    
    let usersMigrated = 0;
    for (const user of users) {
      if (!user.username) {
        // Generate username from email or googleId
        let baseUsername;
        if (user.email) {
          baseUsername = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '');
        } else if (user.googleId) {
          baseUsername = `user_${user.googleId.slice(-8)}`;
        } else if (user.githubId) {
          baseUsername = `user_${user.githubId.slice(-8)}`;
        } else {
          baseUsername = `user_${user._id.toString().slice(-8)}`;
        }

        // Ensure uniqueness
        let username = baseUsername;
        let counter = 1;
        while (await usersCollection.findOne({ username })) {
          username = `${baseUsername}${counter}`;
          counter++;
        }

        await usersCollection.updateOne(
          { _id: user._id },
          { $set: { username } }
        );
        console.log(`  ✅ User ${user.email || user._id}: assigned username "${username}"`);
        usersMigrated++;
      }
    }
    console.log(`  📊 ${usersMigrated} users migrated`);

    // 2. Migrate CodeFiles - Convert googleId to userId
    console.log('\n📦 Migrating CodeFiles collection...');
    const codeFilesCollection = db.collection('codefiles');
    
    // First, drop old googleId index if it exists
    try {
      const indexes = await codeFilesCollection.indexes();
      for (const idx of indexes) {
        if (idx.name.includes('googleId')) {
          console.log(`  🗑️ Dropping old index: ${idx.name}`);
          await codeFilesCollection.dropIndex(idx.name);
        }
      }
    } catch (e) {
      console.log('  ⚠️ Could not drop old indexes:', e.message);
    }
    
    // Find all documents with googleId field
    const codeFilesWithGoogleId = await codeFilesCollection.find({ googleId: { $exists: true } }).toArray();
    
    let codeFilesMigrated = 0;
    for (const codeFile of codeFilesWithGoogleId) {
      // Find the user with this googleId
      const user = await usersCollection.findOne({ googleId: codeFile.googleId });
      
      if (user?.username) {
        await codeFilesCollection.updateOne(
          { _id: codeFile._id },
          { 
            $set: { userId: user.username },
            $unset: { googleId: "" }
          }
        );
        codeFilesMigrated++;
      } else {
        console.log(`  ⚠️ CodeFile ${codeFile._id}: No user found for googleId ${codeFile.googleId}`);
      }
    }
    console.log(`  📊 ${codeFilesMigrated} code files migrated`);

    // 3. Migrate EditorSessions - Convert googleId to userId
    console.log('\n📦 Migrating EditorSessions collection...');
    const editorSessionsCollection = db.collection('editorsessions');
    
    const sessionsWithGoogleId = await editorSessionsCollection.find({ googleId: { $exists: true } }).toArray();
    
    let sessionsMigrated = 0;
    for (const session of sessionsWithGoogleId) {
      const user = await usersCollection.findOne({ googleId: session.googleId });
      
      if (user?.username) {
        await editorSessionsCollection.updateOne(
          { _id: session._id },
          { 
            $set: { userId: user.username },
            $unset: { googleId: "" }
          }
        );
        sessionsMigrated++;
      }
    }
    console.log(`  📊 ${sessionsMigrated} editor sessions migrated`);

    // 4. Create indexes
    console.log('\n📦 Creating indexes...');
    await usersCollection.createIndex({ username: 1 }, { unique: true, sparse: true });
    await codeFilesCollection.createIndex({ userId: 1 });
    await editorSessionsCollection.createIndex({ userId: 1 });
    console.log('  ✅ Indexes created');

    console.log('\n✅ Migration complete!');
    console.log('\n📋 Summary:');
    console.log(`   - Users migrated: ${usersMigrated}`);
    console.log(`   - Code files migrated: ${codeFilesMigrated}`);
    console.log(`   - Editor sessions migrated: ${sessionsMigrated}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

migrate();
