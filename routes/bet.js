const express = require('express');
const router = express.Router();
const Bet = require('../models/Bet');
const User = require('../models/User');

const activeMatches = [
    { name: 'Match 1', teams: ['Team A', 'Team B'] },
    { name: 'Match 2', teams: ['Team C', 'Team D'] }
];

router.get('/', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const user = await User.findOne({ username: req.session.user.username });
    if (!user) return res.redirect('/login');

    const userBets = await Bet.find({ username: user.username });
    res.render('place_bet', { user, activeMatches, bets: userBets });
});

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

    res.render('account', { user, milestones }); // ✅ đã đóng dấu ngoặc
});

router.get('/place', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const user = await User.findOne({ username: req.session.user.username });
    if (!user) return res.redirect('/login');

    const userBets = await Bet.find({ username: user.username });
    res.render('place_bet', { user, activeMatches, bets: userBets });
});

router.get('/history', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const user = await User.findOne({ username: req.session.user.username });
    if (!user) return res.redirect('/login');

    const bets = await Bet.find({ username: user.username });
    res.render('history', { user, bets });
});

router.get('/leaderboard', async (req, res) => {
    const users = await User.find().sort({ score: -1 }).limit(10);
    res.render('leaderboard', { users });
});

router.post('/', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const { match, team, amount } = req.body;
    const user = await User.findOne({ username: req.session.user.username });
    if (!user) return res.redirect('/login');

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
