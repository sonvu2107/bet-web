const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
  username: { type: String, required: true },
  match: { type: String, required: true },
  team: { type: String, required: true },
  amount: { type: Number, required: true },
  result: { type: String, enum: ['win', 'lose', null], default: null }
});

module.exports = mongoose.model('Bet', betSchema);