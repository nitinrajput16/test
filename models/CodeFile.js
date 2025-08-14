const mongoose = require('mongoose');

const CodeFileSchema = new mongoose.Schema({
  filename: { type: String, required: true, unique: true, index: true },
  language: { type: String, default: 'javascript' },
  code: { type: String, default: '' },
  roomId: { type: String },
}, {
  timestamps: true
});

module.exports = mongoose.model('CodeFile', CodeFileSchema);