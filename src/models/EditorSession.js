const mongoose = require('mongoose');

const EditorSessionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  start: { type: Date, required: true },
  end: { type: Date },
  date: { type: String, required: true, index: true } // 'YYYY-MM-DD' IST
}, { timestamps: true });

module.exports = mongoose.model('EditorSession', EditorSessionSchema);