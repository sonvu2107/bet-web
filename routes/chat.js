const express = require('express');
const router = express.Router();
const ChatMessage = require('../models/ChatMessage');

// Gửi tin nhắn mới
router.post('/', async (req, res) => {
  const username = req.session?.user?.username || 'Ẩn danh';
  const message = req.body.message;

  // ⚠️ Kiểm tra tin nhắn hợp lệ
  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Tin nhắn rỗng' });
  }

  const newMessage = new ChatMessage({ username, message });
  await newMessage.save();
  res.json({ success: true });
});
