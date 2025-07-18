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
    mcap: String,
    volume24USD: String,
    totalVolume: String,
    mcapPercentage: String,
    volumePercentage: String,
    totalVolumePercentage: String,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Coin", coinSchema);
