const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  score: { type: Number, default: 1000 },
  level: { type: Number, default: 1 },
  winCount: { type: Number, default: 0 }
});

module.exports = mongoose.model('User', userSchema);