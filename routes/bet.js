const express = require('express');
const router = express.Router();
const Bet = require('../models/Bet');
const User = require('../models/User');

// Fake trận đấu hiện tại (có thể sửa lại thành lấy từ DB sau)
const activeMatches = [
    { name: 'Match 1', teams: ['Team A', 'Team B'] },
    { name: 'Match 2', teams: ['Team C', 'Team D'] }
];

router.get('/', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const user = await User.findOne({ username: req.session.user.username });
    const userBets = await Bet.find({ username: user.username });
    res.render('bet', { user, activeMatches, bets: userBets });
});

router.post('/', async (req, res) => {
    const { match, team, amount } = req.body;
    const user = await User.findOne({ username: req.session.user.username });
    const amt = parseInt(amount);

    if (!match || !team || isNaN(amt) || amt <= 0) {
        return res.redirect('/bet?error=1');
    }

    if (user.score < amt) return res.redirect('/bet?error=2');

    const existing = await Bet.findOne({ username: user.username, match });
    if (existing) return res.redirect('/bet?error=3');

    const newBet = new Bet({ username: user.username, match, team, amount: amt });
    await newBet.save();
    user.score -= amt;
    await user.save();
    res.redirect('/bet?success=1');
});

router.get('/dashboard', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const user = await User.findOne({ username: req.session.user.username });
    const bets = await Bet.find({ username: user.username });
    const totalBets = bets.length;
    const winCount = bets.filter(b => b.result === 'win').length;
    const winRate = totalBets > 0 ? ((winCount / totalBets) * 100).toFixed(1) : 0;
    res.render('dashboard', { user, totalBets, winRate });
});

router.get('/account', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const user = await User.findOne({ username: req.session.user.username });
    const bets = await Bet.find({ username: user.username }).sort({ _id: 1 });
    let history = [];
    let score = 1000; // hoặc user.score khởi tạo ban đầu
    history.push({ score, time: bets[0] ? bets[0]._id.getTimestamp() : new Date() });
    bets.forEach(bet => {
        if (bet.result === 'win') {
            score += bet.amount * 2;
        } else if (bet.result === 'lose') {
            score -= bet.amount;
        }
        history.push({ score, time: bet._id.getTimestamp() });
    });
    res.render('account', { user, history });
});

router.get('/place', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    // Lấy danh sách trận đấu đang mở cược
    // Ví dụ: lấy từ activeMatches hoặc từ DB nếu có
    res.render('place_bet', { user: req.session.user /*, matches: activeMatches */ });
});

router.get('/history', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const bets = await Bet.find({ username: req.session.user.username });
    res.render('history', { user: req.session.user, bets });
});

router.get('/leaderboard', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    // Lấy top 10 user có điểm cao nhất
    const users = await User.find().sort({ score: -1 }).limit(10);
    res.render('leaderboard', { users });
});

module.exports = router;