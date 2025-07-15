const express = require('express');
const router = express.Router();

let bets = [];
let users = [
    { username: 'admin', password: 'admin123', score: 1000 },
    { username: 'player1', password: 'player1', score: 800 },
    { username: 'player2', password: 'player2', score: 700 }
];

// Danh sách trận đấu đang mở cược
let activeMatches = [
    { name: 'Man City vs Real', teams: ['Man City', 'Real Madrid'] },
    { name: 'MU vs Liverpool', teams: ['MU', 'Liverpool'] }
];

// Tính cấp độ và cộng thưởng nếu lên level
function calcLevelAndReward(user) {
    let level = 1;
    let need = 5;
    let total = 0;
    while (user.winCount >= total + need) {
        total += need;
        need += 5;
        level++;
    }
    if (level > (user.level || 1)) {
        const up = level - (user.level || 1);
        user.score += up * 200;
    }
    user.level = level;
}

// Dashboard
router.get('/', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const user = users.find(u => u.username === req.session.user.username);
    if (user) {
        user.winCount = bets.filter(b => b.username === user.username && b.result === 'win').length;
        const total = bets.filter(b => b.username === user.username).length;
        user.winRate = total > 0 ? ((user.winCount / total) * 100).toFixed(1) : '0.0';
    }
    res.render('dashboard', { user: user || req.session.user });
});

// Hiển thị giao diện chọn trận đấu để cược
router.get('/place', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const matches = activeMatches.map(m => m.name);
    res.render('place_bet', {
        matches,
        selectedMatch: null,
        teams: []
    });
});

// Khi người dùng chọn trận
router.post('/place/select', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const { match } = req.body;
    const selected = activeMatches.find(m => m.name === match);
    res.render('place_bet', {
        matches: activeMatches.map(m => m.name),
        selectedMatch: match,
        teams: selected ? selected.teams : []
    });
});

// Người dùng gửi cược
router.post('/place_bet', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const { match, winner, amount } = req.body;
    bets.push({
        username: req.session.user.username,
        match,
        team: winner,
        amount: parseInt(amount),
        result: null
    });
    res.redirect('/bet/history');
});

// Lịch sử cược
router.get('/history', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const userBets = bets.filter(b => b.username === req.session.user.username);
    const user = users.find(u => u.username === req.session.user.username) || { score: 0 };
    res.render('history', { bets: userBets, user });
});

// Bảng xếp hạng
router.get('/leaderboard', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const userStats = users.map(user => {
        const userBets = bets.filter(b => b.username === user.username);
        const winCount = userBets.filter(b => b.result === 'win').length;
        const total = userBets.length;
        const winRate = total > 0 ? ((winCount / total) * 100).toFixed(1) : '0.0';
        return {
            username: user.username,
            score: user.score,
            winCount,
            total,
            winRate
        };
    });
    userStats.sort((a, b) => b.score - a.score);
    const top10 = userStats.slice(0, 10);
    res.render('leaderboard', { users: top10 });
});

// Trang tài khoản
router.get('/account', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const user = users.find(u => u.username === req.session.user.username);
    if (user) {
        user.winCount = bets.filter(b => b.username === user.username && b.result === 'win').length;
        const total = bets.filter(b => b.username === user.username).length;
        user.winRate = total > 0 ? ((user.winCount / total) * 100).toFixed(1) : '0.0';
        if (typeof user.score !== 'number' || isNaN(user.score)) user.score = 0;
    }
    let level = user && user.level ? user.level : 1;
    let need = 5, totalWin = 0;
    let milestones = [];
    for (let i = 1; i <= 10; i++) {
        totalWin += need;
        milestones.push({ level: i + 1, require: totalWin, reward: i * 200 });
        need += 5;
    }
    res.render('account', { user: user || req.session.user, milestones });
});

module.exports = { router, bets, users, calcLevelAndReward, activeMatches };
