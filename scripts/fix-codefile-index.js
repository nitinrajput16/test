#!/usr/bin/env node
/**
 * fix-codefile-index.js
 * One-time migration to fix the CodeFile unique index.
 *
 * Problem: An old index on { parentPath, filename } (without googleId) causes
 * different users to conflict when creating files/folders with the same name.
 *
 * Solution: Drop any indexes that enforce uniqueness without googleId, and
 * ensure the correct compound index { googleId, parentPath, filename } exists.
 *
 * Usage:
 *   node scripts/fix-codefile-index.js
 *
 * Make sure MONGODB_URI is set in your environment or .env file.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('Connected.');

  const db = mongoose.connection.db;
  const collection = db.collection('codefiles');

  // List current indexes
  const indexes = await collection.indexes();
  console.log('\nCurrent indexes on codefiles:');
  indexes.forEach((idx, i) => {
    console.log(`  ${i + 1}. ${idx.name}`, JSON.stringify(idx.key), idx.unique ? '(unique)' : '');
  });

  // Find problematic indexes: unique indexes that include filename/parentPath but NOT googleId
  const badIndexes = indexes.filter(idx => {
    if (!idx.unique) return false;
    const keys = Object.keys(idx.key);
    const hasFilename = keys.includes('filename');
    const hasParentPath = keys.includes('parentPath');
    const hasGoogleId = keys.includes('googleId');
    // If it's unique on filename/parentPath without googleId, it's bad
    return (hasFilename || hasParentPath) && !hasGoogleId;
  });

  if (badIndexes.length === 0) {
    console.log('\n✅ No problematic indexes found.');
  } else {
    console.log(`\n⚠️  Found ${badIndexes.length} problematic index(es):`);
    for (const idx of badIndexes) {
      console.log(`  Dropping: ${idx.name}`, JSON.stringify(idx.key));
      try {
        await collection.dropIndex(idx.name);
        console.log(`    ✅ Dropped ${idx.name}`);
      } catch (err) {
        console.error(`    ❌ Failed to drop ${idx.name}:`, err.message);
      }
    }
  }

  // Ensure the correct index exists
  const correctIndexName = 'googleId_1_parentPath_1_filename_1';
  const hasCorrectIndex = indexes.some(idx => idx.name === correctIndexName);

  if (hasCorrectIndex) {
    console.log(`\n✅ Correct index "${correctIndexName}" already exists.`);
  } else {
    console.log(`\nCreating correct index: { googleId: 1, parentPath: 1, filename: 1 } (unique)...`);
    try {
      await collection.createIndex(
        { googleId: 1, parentPath: 1, filename: 1 },
        { unique: true, name: correctIndexName }
      );
      console.log('  ✅ Index created.');
    } catch (err) {
      console.error('  ❌ Failed to create index:', err.message);
      // This can happen if there are duplicate documents; list them
      if (err.code === 11000) {
        console.log('\n  ⚠️  Duplicate documents exist. Finding duplicates...');
        const pipeline = [
          {
            $group: {
              _id: { googleId: '$googleId', parentPath: '$parentPath', filename: '$filename' },
              count: { $sum: 1 },
              ids: { $push: '$_id' }
            }
          },
          { $match: { count: { $gt: 1 } } },
          { $limit: 20 }
        ];
        const dupes = await collection.aggregate(pipeline).toArray();
        if (dupes.length) {
          console.log('  Duplicates (first 20):');
          dupes.forEach(d => {
            console.log(`    googleId=${d._id.googleId}, parentPath=${d._id.parentPath}, filename=${d._id.filename}, count=${d.count}`);
          });
          console.log('\n  Please resolve duplicates manually, then re-run this script.');
        }
      }
    }
  }

  // Final index list
  const finalIndexes = await collection.indexes();
  console.log('\nFinal indexes on codefiles:');
  finalIndexes.forEach((idx, i) => {
    console.log(`  ${i + 1}. ${idx.name}`, JSON.stringify(idx.key), idx.unique ? '(unique)' : '');
  });

  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
