const mongoose = require('mongoose');
const TienLenGameSchema = new mongoose.Schema({
  players: [String],
  winner: String,
  losers: [String],
  bet: Number,
  scoreChanges: Object,
  playedAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('TienLenGame', TienLenGameSchema, 'tienlen_games'); 