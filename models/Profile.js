const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema(
  {
    walletAddress: { type: String, required: true, unique: true },
    profileName: String,
    profileImageUrl: String,
    emailId: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Profile", profileSchema);
