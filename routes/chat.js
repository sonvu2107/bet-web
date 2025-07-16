const express = require('express');
const router = express.Router();
const ChatMessage = require('../models/ChatMessage');

// Lấy tin nhắn mới nhất
router.get('/', async (req, res) => {
  const messages = await ChatMessage.find().sort({ timestamp: -1 }).limit(50);
  res.json(messages.reverse()); // đảo lại để tin mới nhất xuống dưới
});

// Gửi tin nhắn mới
router.post('/', async (req, res) => {
  const username = req.session?.user?.username || 'Ẩn danh';
  const message = req.body.message;

  if (!message || message.trim() === '') return res.status(400).json({ error: 'Tin nhắn rỗng' });

  const newMessage = new ChatMessage({ username, message });
  await newMessage.save();

  res.json({ success: true });
});

module.exports = router;