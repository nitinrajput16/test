const mongoose = require('mongoose');
const { Schema } = mongoose;


const CodeFileSchema = new Schema({
  googleId: { type: String, required: true, index: true },
  filename: { type: String, required: true, trim: true },
  language: { type: String, trim: true, default: 'plaintext' },
  code: { type: String, default: '' },
  roomId: { type: String, trim: true },
  size: { type: Number, default: 0 },
  codeHash: { type: String, index: true }
}, { timestamps: true });

CodeFileSchema.index({ googleId: 1, filename: 1 }, { unique: true });

CodeFileSchema.statics.simpleHash = function (s) {
  let h = 0, i = 0;
  while (i < s.length) h = (Math.imul(31, h) + s.charCodeAt(i++)) | 0;
  return (h >>> 0).toString(36);
};

CodeFileSchema.pre('save', function (next) {
  if (this.isModified('code')) {
    this.size = this.code.length;
    this.codeHash = this.constructor.simpleHash(this.code);
  }
  next();
});

module.exports = mongoose.model('CodeFile', CodeFileSchema);