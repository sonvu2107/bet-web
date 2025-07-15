require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');

const app = express();

// 🧠 MODELS
const User = require('./models/User');

// 🛣️ ROUTES
const authRoutes = require('./routes/auth');
const betRoutes = require('./routes/bet');
const adminRoutes = require('./routes/admin');
const chatRoutes = require('./routes/chat');

// ✅ MIDDLEWARE
app.use(express.urlencoded({ extended: true }));    // hỗ trợ form
app.use(express.json());                            // hỗ trợ JSON (fetch API)
app.use(express.static(path.join(__dirname, 'public'))); // file tĩnh
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 🔐 SESSION
app.use(session({
    secret: 'secret-key', 
    resave: false,
    saveUninitialized: true
}));

// 🌐 DATABASE
mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log('✅ Đã kết nối MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// 🔁 ROUTING
app.get('/', (req, res) => {
    res.redirect('/bet/dashboard');
});

app.use('/', authRoutes);
app.use('/bet', betRoutes);
app.use('/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/bet', express.static('public')); 

//  API: Trả lại username từ session (dùng cho chat)
app.get('/get-username', (req, res) => {
    res.json({ username: req.session?.user?.username || 'Ẩn danh' });
});

// 🚀 START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
