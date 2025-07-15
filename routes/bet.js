const express = require('express');
const router = express.Router();
const Bet = require('../models/Bet');
const User = require('../models/User');

// Fake danh sách trận đấu (bạn có thể thay bằng lấy từ DB sau này)
const activeMatches = [
    { name: 'Match 1', teams: ['Team A', 'Team B'] },
    { name: 'Match 2', teams: ['Team C', 'Team D'] }
];

// Trang mặc định /bet (hiển thị giao diện đặt cược)
router.get('/', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const user = await User.findOne({ username: req.session.user.username });
    if (!user) return res.redirect('/login');

    const userBets = await Bet.find({ username: user.username });
    res.render('place_bet', { user, activeMatches, bets: userBets });
});

// Thông tin tài khoản
router.get('/account', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const user = await User.findOne({ username: req.session.user.username });
    if (!user) return res.redirect('/login');

    const milestones = [
        { level: 1, require: 0, reward: 0 },
        { level: 2, require: 3, reward: 100 },
        { level: 3, require: 6, reward: 150 },
        { level: 4, require: 10, reward: 250 },
        { level: 5, require: 15, reward: 400 }
    ];

    res.render('account', { user, milestones }); // 

// Trang đặt cược (cũng có thể dùng /bet thay cho route này)
router.get('/place', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const user = await User.findOne({ username: req.session.user.username });
    if (!user) return res.redirect('/login');

    const userBets = await Bet.find({ username: user.username });
    res.render('place_bet', { user, activeMatches, bets: userBets });
});

// Lịch sử cược
router.get('/history', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const user = await User.findOne({ username: req.session.user.username });
    if (!user) return res.redirect('/login');

    const bets = await Bet.find({ username: user.username });
    res.render('history', { user, bets });
});

// Bảng xếp hạng
router.get('/leaderboard', async (req, res) => {
    const users = await User.find().sort({ score: -1 }).limit(10);
    res.render('leaderboard', { users });
});

// Xử lý đặt cược
router.post('/', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const { match, team, amount } = req.body;
    const user = await User.findOne({ username: req.session.user.username });
    if (!user) return res.redirect('/login');

    const amt = parseInt(amount);

    if (!match || !team || isNaN(amt) || amt <= 0) {
        return res.redirect('/bet?error=1'); // Dữ liệu đầu vào không hợp lệ
    }

    if (user.score < amt) return res.redirect('/bet?error=2'); // Không đủ tiền

    const existing = await Bet.findOne({ username: user.username, match });
    if (existing) return res.redirect('/bet?error=3'); // Đã cược trận này rồi

    // Tạo và lưu cược mới
    const newBet = new Bet({ username: user.username, match, team, amount: amt });
    await newBet.save();

    user.score -= amt;
    await user.save();

    res.redirect('/bet?success=1');
});

module.exports = router;
