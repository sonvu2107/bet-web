const mongoose = require('mongoose');
const TienLenGameSchema = new mongoose.Schema({
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  losers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  bet: Number,
  scoreChanges: Object,
  playedAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('TienLenGame', TienLenGameSchema, 'tienlen_games'); 