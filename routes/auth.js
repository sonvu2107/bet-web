const express = require('express');
const router = express.Router();
const { users } = require('./bet');

router.get('/login', (req, res) => {
    res.render('login');
});

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        req.session.user = { username: user.username };
        res.redirect('/bet');
    } else {
        res.render('login', { error: 'Sai tên đăng nhập hoặc mật khẩu!' });
    }
});

router.get('/register', (req, res) => {
    res.render('register');
});

router.post('/register', (req, res) => {
    // Thêm user mới với 1000 điểm, level 1, winCount 0 và lưu password
    users.push({ username: req.body.username, password: req.body.password, score: 1000, level: 1, winCount: 0 });
    res.redirect('/login');
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

module.exports = router;