const express = require('express');
const router = express.Router();
const Bet = require('../models/Bet');
const User = require('../models/User');
const Match = require('../models/Match');

// Trang chính (đặt cược)
router.get('/', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const user = await User.findOne({ username: req.session.user.username });
    if (!user) return res.redirect('/login');

    const activeMatches = await Match.find();
    const userBets = await Bet.find({ username: user.username });

    const selectedMatchName = req.query.match || (activeMatches[0] && activeMatches[0].name);
    const selectedMatch = activeMatches.find(m => m.name === selectedMatchName);
    const teams = selectedMatch ? selectedMatch.teams : [];
    const selectedTeam = (req.query.team && teams.includes(req.query.team)) ? req.query.team : (teams[0] || '');

    // --- Tính tỉ lệ thắng cho từng đội ---
    let teamWinRates = {};
    if (selectedMatch) {
        const bets = await Bet.find({ match: selectedMatch.name });
        teams.forEach(team => {
            const total = bets.filter(b => b.team === team).length;
            const win = bets.filter(b => b.team === team && b.result === 'win').length;
            teamWinRates[team] = total > 0 ? win / total : 0;
        });
    }
    // --------------------------------------

    res.render('place_bet', {
        user,
        activeMatches,
        bets: userBets,
        selectedMatchName,
        teams,
        teamWinRates,
        selectedTeam,
        success: req.query.success,
        error: req.query.error
    });
});

// Chuyển hướng từ /place sang /
router.get('/place', async (req, res) => {
    return res.redirect('/bet');
});

// Thông tin tài khoản
router.get('/account', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const user = await User.findOne({ username: req.session.user.username });
    if (!user) return res.redirect('/login');

    const bets = await Bet.find({ username: user.username });
    const totalBets = bets.length;
    const winBets = bets.filter(b => b.result === 'win').length;
    const winRate = totalBets > 0 ? ((winBets / totalBets) * 100).toFixed(1) : '0.0';

    const milestones = [
        { level: 1, require: 0, reward: 0 },
        { level: 2, require: 3, reward: 100 },
        { level: 3, require: 6, reward: 150 },
        { level: 4, require: 10, reward: 250 },
        { level: 5, require: 15, reward: 400 }
    ];

    // Tính level dựa trên tổng số trận thắng
    let level = 1;
    for (let i = milestones.length - 1; i >= 0; i--) {
        if (winBets >= milestones[i].require) {
            level = milestones[i].level;
            break;
        }
    }

    res.render('account', { user, milestones, totalBets, winRate, level });
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

    // Tính tổng cược và tỉ lệ thắng cho từng user
    const usersWithStats = await Promise.all(users.map(async user => {
        const bets = await Bet.find({ username: user.username });
        const totalBets = bets.length;
        const winBets = bets.filter(b => b.result === 'win').length;
        const winRate = totalBets > 0 ? ((winBets / totalBets) * 100).toFixed(1) : '0.0';
        return {
            ...user.toObject(),
            totalBets,
            winRate
        };
    }));

    res.render('leaderboard', { users: usersWithStats });
});

// Xử lý đặt cược
router.post('/', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const { match, team, amount } = req.body;
    const user = await User.findOne({ username: req.session.user.username });
    if (!user) return res.redirect('/login');

    const amt = parseInt(amount);
    if (!match || !team || isNaN(amt) || amt <= 0) return res.redirect('/bet?error=1');
    if (user.username !== 'admin' && user.score < amt) return res.redirect('/bet?error=2');

    const existing = await Bet.findOne({ username: user.username, match });
    if (existing) return res.redirect('/bet?error=3');

    // Kiểm tra kết quả trận đấu
    const matchObj = await Match.findOne({ name: match });
    let betResult = null;
    let reward = 0;
    if (matchObj && matchObj.result) {
        // Đã có kết quả, xác định luôn win/thua
        betResult = (team === matchObj.result) ? 'win' : 'lose';
        if (betResult === 'win') reward = amt * 2;
    }

    await Bet.create({ username: user.username, match, team, amount: amt, result: betResult });

    if (user.username !== 'admin') {
        user.score -= amt;
        if (betResult === 'win') user.score += reward;
        await user.save();
    }

    // Cập nhật lại tổng cược và tỉ lệ thắng cho user
    const bets = await Bet.find({ username: user.username });
    const totalBets = bets.length;
    const winBets = bets.filter(b => b.result === 'win').length;
    user.totalBets = totalBets;
    user.winCount = winBets;
    user.winRate = totalBets > 0 ? ((winBets / totalBets) * 100).toFixed(1) : '0.0';
    await user.save();

    res.redirect('/bet?success=1');
});

// Dashboard
router.get('/dashboard', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const user = await User.findOne({ username: req.session.user.username });
    if (!user) return res.redirect('/login');

    const bets = await Bet.find({ username: user.username });
    const totalBets = bets.length;
    const winBets = bets.filter(b => b.result === 'win').length;
    const winRate = totalBets > 0 ? ((winBets / totalBets) * 100).toFixed(1) : '0.0';

    res.render('dashboard', { user, totalBets, winRate });
});

// Route cho admin xem lịch sử cược của user bất kỳ
router.get('/admin/history/:username', async (req, res) => {
    if (!req.session.user || req.session.user.username !== 'admin') return res.redirect('/login');
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).send('User không tồn tại');
    const bets = await Bet.find({ username: user.username });
    res.render('history', { user, bets, isAdminView: true });
});

module.exports = router;
