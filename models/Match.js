const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    teams: {
        type: [String],
        validate: v => v.length === 2
    }
});

module.exports = mongoose.model('Match', matchSchema);
