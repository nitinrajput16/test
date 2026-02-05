const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  googleId: { type: String, trim: true, index: true },
  githubId: { type: String, trim: true, index: true },
  passwordHash: { type: String, trim: true },
  displayName: { type: String, trim: true },
  provider: { type: String, trim: true }, // 'google', 'github', 'local'
  avatar: { type: String, trim: true },
  role: { type: String, default: 'user', enum: ['user', 'admin'] }
}, { timestamps: true });

// Helper method to generate unique username from email
UserSchema.statics.generateUsername = async function(base) {
  const baseUsername = String(base).split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
  let username = baseUsername.slice(0, 20); // Max 20 chars
  let counter = 1;
  
  // Keep trying until we find a unique username
  while (await this.findOne({ username })) {
    username = `${baseUsername.slice(0, 16)}${counter}`;
    counter++;
  }
  
  return username;
};

module.exports = mongoose.model('User', UserSchema);