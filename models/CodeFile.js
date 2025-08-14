const mongoose = require('mongoose');

const CodeFileSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true, unique: true, index: true },
    code: { type: String, required: true },
    language: { type: String },
    roomId: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model('CodeFile', CodeFileSchema);