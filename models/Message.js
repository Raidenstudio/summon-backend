const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  text: String,
  time: Date,
  sender: String
});

module.exports = mongoose.model('Message', messageSchema);
