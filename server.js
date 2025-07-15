require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();

const User = require('./models/User');

const authRoutes = require('./routes/auth');
const betRoutes = require('./routes/bet');
const adminRoutes = require('./routes/admin');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true
}));


mongoose.connect(process.env.MONGO_URL).then(() => console.log('✅ Đã kết nối MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

app.get('/', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const user = await User.findOne({ username: req.session.user.username });
    if (!user) return res.redirect('/login');

    res.render('dashboard', { user });
});

app.use('/', authRoutes);
app.use('/bet', betRoutes);
app.use('/admin', adminRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});