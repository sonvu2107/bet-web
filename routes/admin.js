const express = require('express');
const router = express.Router();
const { bets, users, calcLevelAndReward, activeMatches } = require('./bet'); // Import dữ liệu cược và user từ bet.js

// Middleware kiểm tra admin
function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.username === 'admin') return next();
    return res.status(403).send('Bạn không có quyền truy cập!');
}

router.get('/', (req, res) => {
    res.send('Admin Panel - Coming soon!');
});

// Trang nhập kết quả cho admin
router.get('/result', (req, res) => {
    // Lấy danh sách trận đấu đã có người cược
    const matches = [...new Set(bets.map(b => b.match))];
    // Nếu có query match, chỉ lấy các đội đã cược cho trận đó
    let teams = [];
    if (req.query.match) {
        teams = [...new Set(bets.filter(b => b.match === req.query.match).map(b => b.team))];
    }
    res.render('admin', { matches, teams, selectedMatch: req.query.match, success: req.query.success });
});

// Xử lý nhập kết quả
router.post('/result', (req, res) => {
    const { match, winner } = req.body;
    // Đánh dấu kết quả cho các cược liên quan
    bets.forEach(bet => {
        if (bet.match === match) {
            bet.result = (bet.team === winner) ? 'win' : 'lose';
        }
    });
    // Tính toán thưởng/phạt cho từng user
    bets.filter(bet => bet.match === match).forEach(bet => {
        const user = users.find(u => u.username === bet.username);
        if (!user) return;
        if (bet.result === 'win') {
            user.score += bet.amount; // Thưởng gấp đôi (đã trừ khi đặt cược)
        } else if (bet.result === 'lose') {
            user.score -= bet.amount; // Trừ số tiền đã cược
        }
    });
    // Cập nhật winCount và level cho từng user
    users.forEach(user => {
        user.winCount = bets.filter(b => b.username === user.username && b.result === 'win').length;
        calcLevelAndReward(user);
    });
    res.redirect('/admin/result?success=1');
});

// Hiển thị danh sách các trận đấu đang có cược
router.get('/matches', (req, res) => {
    // Gom nhóm các trận đấu và các đội đã cược
    const matchMap = {};
    bets.forEach(bet => {
        if (!matchMap[bet.match]) matchMap[bet.match] = {};
        if (!matchMap[bet.match][bet.team]) matchMap[bet.match][bet.team] = 0;
        matchMap[bet.match][bet.team]++;
    });
    // Chuyển thành mảng để render
    const matches = Object.entries(matchMap).map(([match, teamsObj]) => ({
        match,
        teams: Object.entries(teamsObj).map(([team, count]) => ({ team, count }))
    }));
    res.render('matches', { matches });
});

// Hiển thị form tạo trận đấu mới
router.get('/match', isAdmin, (req, res) => {
    res.render('admin_create_match', { error: null, success: null });
});

// Xử lý tạo trận đấu mới
router.post('/match', isAdmin, (req, res) => {
    const { name, team1, team2 } = req.body;
    if (!name || !team1 || !team2) {
        return res.render('admin_create_match', { error: 'Vui lòng nhập đầy đủ thông tin!' });
    }
    activeMatches.push({ name, teams: [team1, team2] });
    res.render('admin_create_match', { success: 'Đã thêm trận đấu mới!' });
});

// Quản lý user - chỉ admin
router.get('/users', isAdmin, (req, res) => {
    res.render('admin_users', { users });
});

router.post('/users/delete', isAdmin, (req, res) => {
    const { username } = req.body;
    if (username === 'admin') return res.status(400).send('Không thể xóa admin!');
    const idx = users.findIndex(u => u.username === username);
    if (idx !== -1) users.splice(idx, 1);
    res.redirect('/admin/users');
});

router.post('/users/reset', isAdmin, (req, res) => {
    const { username } = req.body;
    const user = users.find(u => u.username === username);
    if (user) user.score = 1000;
    res.redirect('/admin/users');
});

router.post('/users/addpoint', isAdmin, (req, res) => {
    const { username, amount } = req.body;
    const user = users.find(u => u.username === username);
    if (user && !isNaN(parseInt(amount))) user.score += parseInt(amount);
    res.redirect('/admin/users');
});

module.exports = router;