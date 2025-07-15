const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema({
  username: String,
  message: String,
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);
