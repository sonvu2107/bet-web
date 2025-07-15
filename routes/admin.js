// routes/admin.js
const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const Bet = require('../models/Bet');
const User = require('../models/User');

// Middleware kiểm tra admin
function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.username === 'admin') return next();
    return res.redirect('/login');
}

// GET: Hiển thị form tạo trận đấu mới
router.get('/match', isAdmin, (req, res) => {
    res.render('admin_create_match', { error: null, success: null });
});

// POST: Xử lý tạo trận đấu
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
            error: 'Trận đấu đã tồn tại hoặc lỗi hệ thống!',
            success: null
        });
    }
});

// GET: Nhập kết quả trận đấu
router.get('/result', isAdmin, async (req, res) => {
    try {
        const matches = await Match.find();
        const selectedMatch = req.query.match;

        let teams = [];
        let error = null;

        if (selectedMatch) {
            const match = await Match.findOne({ name: selectedMatch });
            if (match) {
                teams = match.teams;
            } else {
                error = '⚠️ Trận đấu không tồn tại!';
            }
        }

        res.render('admin', {
            matches: matches.map(m => m.name),
            teams,
            selectedMatch,
            success: req.query.success,
            error
        });
    } catch (err) {
        console.error('Lỗi /admin/result:', err);
        res.status(500).send('Lỗi hệ thống khi hiển thị kết quả.');
    }
});

// POST: Ghi nhận đội thắng và xử lý kết quả
router.post('/result', isAdmin, async (req, res) => {
    const { match, winner } = req.body;

    if (!match || !winner) return res.redirect('/admin/result?error=1');

    try {
        const bets = await Bet.find({ match });
        for (const bet of bets) {
            const user = await User.findOne({ username: bet.username });
            if (!user) continue;

            const isWin = bet.team === winner;
            bet.result = isWin ? 'win' : 'lose';

            // Tổng số lần cược
            user.totalBets = (user.totalBets || 0) + 1;

            // Nếu thắng, cộng thưởng và số trận thắng
            if (isWin) {
                const reward = bet.amount * 2;
                user.score += reward;
                user.winCount = (user.winCount || 0) + 1;
            }

            // Cập nhật level và winRate
            user.level = 1 + Math.floor((user.winCount || 0) / 3);
            const total = user.totalBets || 1;
            user.winRate = ((user.winCount || 0) / total * 100).toFixed(1);

            await user.save();
            await bet.save();
        }

        res.redirect('/admin/result?success=1');
    } catch (err) {
        console.error('Lỗi khi ghi nhận kết quả:', err);
        res.status(500).send('Lỗi khi cập nhật kết quả.');
    }
});

module.exports = router;