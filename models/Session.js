const mongoose = require('mongoose');

const StreamSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  room: {
    type: String,
    required: true,
    unique: true,
  },
  hostIdentity: {
    type: String,
    required: true,
  },
  coin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coin',
    required: true,
  },
  token: {
    type: String,
    required: true,
  },
  isLive: {
    type: Boolean,
    default: true,
  },
  startedAt: {
    type: Date,
    default: Date.now,
  },
  endedAt: {
    type: Date,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Index for faster queries
StreamSchema.index({ coin: 1, isLive: 1 });
StreamSchema.index({ isLive: 1 });

module.exports = mongoose.model('Stream', StreamSchema);