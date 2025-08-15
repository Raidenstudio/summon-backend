const mongoose = require("mongoose");

const coinSchema = new mongoose.Schema(
  {
    name: String,
    symbol: String,
    description: String,
    twitter: String,
    telegram: String,
    website: String,
    preBuy: String,
    walletAddress: String,
    packageId: String,
    treasuryCap: String,
    bondingCurve: String,
    txDigest: String,
    iconUrl: String,
    mcap: Number,
    ATH: { type: Number, default: 0 },

    // Market Cap OHLC history
    marketCapDetails: [
      {
        time: { type: Number, required: true },
        open: { type: Number, required: true },
        high: { type: Number, required: true },
        low: { type: Number, required: true },
        close: { type: Number, required: true }
      }
    ],

    // 24h change value in USD
    mcapChangeValue: { type: Number, default: 0 },  // <-- Added this
    mcapPercentage: String,

    volume24USD: String,
    totalVolume: String,
    volumePercentage: String,
    totalVolumePercentage: String,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Coin", coinSchema);
