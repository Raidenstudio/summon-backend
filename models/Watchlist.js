const mongoose = require('mongoose');

const watchlistSchema = new mongoose.Schema({
  user: {
    type: String,
    required: true,
    unique: true 
  },
  coins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coin',
    required: true
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

watchlistSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Watchlist', watchlistSchema);