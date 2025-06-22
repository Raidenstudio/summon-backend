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
const server = http.createServer(app);

// ✅ Apply CORS before anything else
app.use(cors({
  origin: (origin, callback) => {
    callback(null, origin); // Allow all origins
  },
  methods: ["GET", "POST"],
  credentials: true
}));

// ✅ Needed to parse JSON body
app.use(express.json());

// ✅ Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ MongoDB Connect
const MONGO_URI = 'mongodb+srv://summon:summon@summon.xfhyrzj.mongodb.net/summon';
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

mongoose.connection.on('error', err => {
  console.error('❌ MongoDB Runtime Error:', err);
});

// ✅ API Routes
app.use("/api", contractRoutes);

// ✅ Health Check
app.get('/health', async (req, res) => {
  const count = await Message.countDocuments();
  res.json({ ok: true, count });
});

// ✅ Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, origin);
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  allowEIO3: true
});

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

// ✅ Start Server
const PORT = 2083;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});