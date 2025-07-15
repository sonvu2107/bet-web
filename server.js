const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();

const authRoutes = require('./routes/auth');
const bet = require('./routes/bet');
const adminRouter = require('./routes/admin');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true
}));

// ✅ Thêm route gốc chuyển về login
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Routes
app.use('/', authRoutes);
app.use('/bet', bet.router);
app.use('/admin', adminRouter);

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
