const mongoose = require("mongoose");

const ProcessedTokenSchema = new mongoose.Schema({
    name: String,
    ticker: String,
    tweetId: { type: String, unique: true },
}, { timestamps: true });

module.exports = mongoose.model("ProcessedToken", ProcessedTokenSchema);
