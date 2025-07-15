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
    res.render('place_bet', { user, activeMatches, bets: userBets });
});

router.get('/account', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const user = await User.findOne({ username: req.session.user.username });
    res.render('account', { user });
});

router.get('/place', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const user = await User.findOne({ username: req.session.user.username });
    const userBets = await Bet.find({ username: user.username });
    res.render('place_bet', { user, activeMatches, bets: userBets });
});

router.get('/history', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const user = await User.findOne({ username: req.session.user.username });
    const userBets = await Bet.find({ username: user.username });
    res.render('history', { user, bets: userBets });
});

router.get('/leaderboard', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const topUsers = await User.find().sort({ score: -1 }).limit(10);
    res.render('leaderboard', { users: topUsers });
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

module.exports = router;