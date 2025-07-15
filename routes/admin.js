const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const Bet = require('../models/Bet');
const User = require('../models/User');

// Middleware admin (giữ nguyên nếu đã có)
function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.username === 'admin') return next();
    return res.redirect('/login');
}

// GET: Form tạo trận
router.get('/match', isAdmin, (req, res) => {
    res.render('admin_create_match', { error: null, success: null });
});

// POST: Xử lý tạo trận
router.post('/match', isAdmin, async (req, res) => {
    const { name, team1, team2 } = req.body;

    if (!name || !team1 || !team2) {
        return res.render('admin_create_match', {
            error: 'Vui lòng nhập đầy đủ thông tin!',
            success: null
        });
    }

    try {
        await Match.create({ name, teams: [team1, team2] });
        res.render('admin_create_match', {
            success: 'Tạo trận thành công!',
            error: null
        });
    } catch (err) {
        res.render('admin_create_match', {
            error: 'Trận đấu đã tồn tại!',
            success: null
        });
    }
});

// GET: Chọn kết quả
router.get('/result', isAdmin, async (req, res) => {
    const matches = await Match.find();
    const selectedMatch = req.query.match;

    let teams = [];
    if (selectedMatch) {
        const match = await Match.findOne({ name: selectedMatch });
        if (match) teams = match.teams;
    }

    res.render('admin_result', {
        matches: matches.map(m => m.name),
        teams,
        selectedMatch,
        success: req.query.success
    });
});

// POST: Ghi nhận đội thắng
router.post('/result', isAdmin, async (req, res) => {
    const { match, winner } = req.body;

    if (!match || !winner) return res.redirect('/admin/result?error=1');

    const bets = await Bet.find({ match });
    for (const bet of bets) {
        if (bet.team === winner) {
            bet.result = 'win';
            const user = await User.findOne({ username: bet.username });
            if (user) {
                const reward = bet.amount * 2;
                user.score += reward;
                user.winCount = (user.winCount || 0) + 1;
                user.level = 1 + Math.floor(user.winCount / 3);
                await user.save();
            }
        } else {
            bet.result = 'lose';
        }
        await bet.save();
    }

    res.redirect('/admin/result?success=1');
});

module.exports = router;
