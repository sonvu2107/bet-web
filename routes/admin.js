const express = require('express');
const router = express.Router();
const Bet = require('../models/Bet');
const User = require('../models/User');

// Tạm lưu trận đấu ở server (nếu muốn có thể lưu DB sau)
let activeMatches = [
    { name: 'Match 1', teams: ['Team A', 'Team B'] },
    { name: 'Match 2', teams: ['Team C', 'Team D'] }
];

function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.username === 'admin') return next();
    return res.status(403).send('Bạn không có quyền truy cập!');
}

function calcLevelAndReward(user) {
    user.level = 1 + Math.floor(user.winCount / 3);
}

router.get('/', (req, res) => {
    res.send('Admin Panel - Coming soon!');
});

router.get('/result', async (req, res) => {
    const bets = await Bet.find();
    const matches = [...new Set(bets.map(b => b.match))];
    let teams = [];
    if (req.query.match) {
        teams = [...new Set(bets.filter(b => b.match === req.query.match).map(b => b.team))];
    }
    res.render('admin', { matches, teams, selectedMatch: req.query.match, success: req.query.success });
});

router.post('/result', async (req, res) => {
    const { match, winner } = req.body;
    const matchBets = await Bet.find({ match });

    for (const bet of matchBets) {
        bet.result = (bet.team === winner) ? 'win' : 'lose';
        await bet.save();
        const user = await User.findOne({ username: bet.username });
        if (!user) continue;
        if (bet.result === 'win') {
            user.score += bet.amount * 2;
        } else {
            user.score -= bet.amount;
        }
        await user.save();
    }

    const allUsers = await User.find();
    for (const user of allUsers) {
        const winCount = await Bet.countDocuments({ username: user.username, result: 'win' });
        user.winCount = winCount;
        calcLevelAndReward(user);
        await user.save();
    }

    res.redirect('/admin/result?success=1');
});

router.get('/matches', async (req, res) => {
    const bets = await Bet.find();
    const matchMap = {};
    bets.forEach(bet => {
        if (!matchMap[bet.match]) matchMap[bet.match] = {};
        if (!matchMap[bet.match][bet.team]) matchMap[bet.match][bet.team] = 0;
        matchMap[bet.match][bet.team]++;
    });
    const matches = Object.entries(matchMap).map(([match, teamsObj]) => ({
        match,
        teams: Object.entries(teamsObj).map(([team, count]) => ({ team, count }))
    }));
    res.render('matches', { matches });
});

router.get('/match', isAdmin, (req, res) => {
    res.render('admin_create_match', { error: null, success: null });
});

router.post('/match', isAdmin, (req, res) => {
    const { name, team1, team2 } = req.body;
    if (!name || !team1 || !team2) {
        return res.render('admin_create_match', { error: 'Vui lòng nhập đầy đủ thông tin!' });
    }
    activeMatches.push({ name, teams: [team1, team2] });
    res.render('admin_create_match', { success: 'Đã thêm trận đấu mới!' });
});

router.get('/users', isAdmin, async (req, res) => {
    const users = await User.find();
    res.render('admin_users', { users });
});

router.post('/users/delete', isAdmin, async (req, res) => {
    const { username } = req.body;
    if (username === 'admin') return res.status(400).send('Không thể xóa admin!');
    await User.deleteOne({ username });
    await Bet.deleteMany({ username });
    res.redirect('/admin/users');
});

router.post('/users/reset', isAdmin, async (req, res) => {
    const { username } = req.body;
    const user = await User.findOne({ username });
    if (user) {
        user.score = 1000;
        await user.save();
    }
    res.redirect('/admin/users');
});

router.post('/users/addpoint', isAdmin, async (req, res) => {
    const { username, amount } = req.body;
    const user = await User.findOne({ username });
    if (user && !isNaN(parseInt(amount))) {
        user.score += parseInt(amount);
        await user.save();
    }
    res.redirect('/admin/users');
});

module.exports = router;