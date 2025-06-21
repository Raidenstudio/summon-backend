require("dotenv").config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const Message = require('./models/Message');
const contractRoutes = require('./routes/contractRoutes');
const path = require('path');


const app = express();
app.use(cors());
// ✅ Needed to parse JSON requests
app.use(express.json());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      'https://summon-ui.netlify.app', // frontend live URL
      'http://localhost:5173'          // local dev
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
  allowEIO3: true,
});

const MONGO_URI = 'mongodb+srv://summon:summon@summon.xfhyrzj.mongodb.net/summon';
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");
  })
  .catch(err => {
    console.error("❌ MongoDB Connection Error:", err);
  });

mongoose.connection.on('error', err => {
  console.error('❌ MongoDB Runtime Error:', err);
});

// for image
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/health', async (req, res) => {
  const count = await Message.countDocuments();
  res.json({ ok: true, count });
});

app.use("/api", contractRoutes)


io.on('connection', async (socket) => {
  console.log('✅ User connected:', socket.id);

  const history = await Message.find().sort({ time: 1 });
  socket.emit('chat_history', history);

  socket.on('send_message', async (data) => {
    const msg = new Message({
      text: data.text,
      time: new Date(data.time),
      sender: data.sender
    });
    await msg.save();

    io.emit('receive_message', msg);
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 2083;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
