const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
 type: String, 
 packageId: String,
 address: String,
 coinName: String,
 coinSymbol: String,
 bondingCurveId: String,
 transactionDigest: String,
 sellQuantity: String,
 minReceived: String,   
 pathId: String,
}, { timestamps: true });

module.exports = mongoose.model("Transaction", transactionSchema);