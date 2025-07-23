const mongoose = require("mongoose");

const streamSchema = new mongoose.Schema({
  title: String,
  room: String,
  type: { type: String, enum: ["livekit", "youtube"], default: "livekit" },
  isLive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Stream", streamSchema);
