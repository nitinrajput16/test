const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  googleId: { type: String, trim: true, index: true },
  displayName: { type: String, trim: true },
  provider: { type: String, trim: true }, // 'google'
  avatar: { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);